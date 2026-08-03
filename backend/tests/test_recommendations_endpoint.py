"""Endpoint tests for POST /api/users/{id}/recommendations/refresh.

The unit tests cover the pure prompt builder; these cover the endpoint's actual
integration work: gathering the user's free-text intent + each candidate event's
`why`, filtering hallucinated event ids out of the model's reply, and caching the
result. Gemini is stubbed (both the recommender and the create-time guardrail), so
these are hermetic. Isolation comes from conftest's `db_isolation` fixture.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import events as events_router
from app.routers import users as users_router


@pytest.fixture(autouse=True)
def _stub_guardrail(monkeypatch):
    # Events are created approved without calling Gemini.
    monkeypatch.setattr(
        events_router,
        "review_event",
        lambda *a, **k: {"status": "approved", "summary": "ok", "reason": ""},
    )


def _signup():
    c = TestClient(app)
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    r = c.post("/api/auth/signup", json={"email": email, "username": email.split("@")[0], "password": "password123"})
    assert r.status_code == 201, r.text
    return c, r.json()["user_id"]


def _make_event(client, title, why):
    body = {
        "title": title, "event_description": "come hang out", "why": why,
        "event_date": "2027-01-01T18:00:00Z", "event_end_date": "2027-01-01T20:00:00Z",
        "location": "Washington Square Park", "event_zip_code": 10012, "event_capacity": 20,
        "event_image_url": "/images/default_event.png", "latitude": 40.7308, "longitude": -73.9973, "tag_ids": [],
    }
    r = client.post("/api/events", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_refresh_passes_intent_and_why_then_caches(db_isolation, monkeypatch):
    host, _ = _signup()
    event = _make_event(host, "Sunrise Hike", "help new-to-town folks meet people outdoors")

    captured = {}

    def fake_generate(interests, events, intent=None):
        captured["intent"] = intent
        captured["events"] = events
        # recommend our specific event (deterministic regardless of candidate order)
        ids = {e["event_id"] for e in events}
        if event["event_id"] in ids:
            return [{"eventId": event["event_id"], "reason": "fits what you're looking for"}]
        return []

    monkeypatch.setattr(users_router, "generate_recommendations", fake_generate)

    viewer, vid = _signup()
    viewer.post(
        "/api/profiles",
        json={"display_name": "V", "bio": "hi", "home_zip_code": "10012", "intent": "just moved here, want to meet people"},
    )

    r = viewer.post(f"/api/users/{vid}/recommendations/refresh")
    assert r.status_code == 200
    recs = r.json()

    # the user's free-text intent reached the recommender
    assert captured["intent"] == "just moved here, want to meet people"
    # the candidate carried the host's "why"
    assert any(e["event_id"] == event["event_id"] and e["why"] == "help new-to-town folks meet people outdoors"
               for e in captured["events"])
    # the recommendation was cached + returned with its reason
    assert any(rec["event_id"] == event["event_id"] and rec["reason"] == "fits what you're looking for" for rec in recs)
    # and a follow-up GET returns the cached result
    cached = viewer.get(f"/api/users/{vid}/recommendations").json()
    assert any(rec["event_id"] == event["event_id"] for rec in cached)


def test_refresh_drops_hallucinated_event_ids(db_isolation, monkeypatch):
    host, _ = _signup()
    _make_event(host, "Real Event", "a genuine reason")
    # model returns an id that isn't among the candidates
    monkeypatch.setattr(
        users_router, "generate_recommendations",
        lambda interests, events, intent=None: [{"eventId": 10**9, "reason": "hallucinated"}],
    )
    viewer, vid = _signup()
    r = viewer.post(f"/api/users/{vid}/recommendations/refresh")
    assert r.status_code == 200
    assert r.json() == []  # hallucinated id filtered out, nothing cached


def test_refresh_is_self_only(db_isolation):
    a, _ = _signup()
    _b, bid = _signup()
    assert a.post(f"/api/users/{bid}/recommendations/refresh").status_code == 403
