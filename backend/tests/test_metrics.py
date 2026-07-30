"""Tests for the recommendation-conversion success metric.

Gemini is stubbed; RSVPs are made through the API and check-ins are simulated by
stamping checked_in_at directly (the real check-in flow is time-gated to an hour
before the event). Isolation via conftest's db_isolation.
"""
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import settings
from app.main import app
from app.models.recommendation_log import RecommendationLog
from app.models.rsvp import Rsvp
from app.routers import events as events_router
from app.routers import users as users_router


@pytest.fixture(autouse=True)
def _stub_guardrail(monkeypatch):
    monkeypatch.setattr(
        events_router, "review_event", lambda *a, **k: {"status": "approved", "summary": "", "reason": ""}
    )


@pytest.fixture
def admin_email(monkeypatch):
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    monkeypatch.setattr(settings, "admin_emails", email)
    return email


def _signup(email=None):
    c = TestClient(app)
    email = email or f"user-{uuid.uuid4().hex[:8]}@example.com"
    r = c.post("/api/auth/signup", json={"email": email, "username": email.split("@")[0], "password": "password123"})
    assert r.status_code == 201, r.text
    return c, r.json()["user_id"]


def _make_event(client, title):
    body = {
        "title": title, "event_description": "d", "why": "connect",
        "event_date": "2027-01-01T18:00:00Z", "event_end_date": "2027-01-01T20:00:00Z",
        "location": "Washington Square Park", "event_zip_code": 10012, "event_capacity": 20,
        "event_image_url": "/images/default_event.png", "latitude": 40.7308, "longitude": -73.9973, "tag_names": [],
    }
    r = client.post("/api/events", json=body)
    assert r.status_code == 201, r.text
    return r.json()["event_id"]


def _recommend(monkeypatch, event_ids):
    monkeypatch.setattr(
        users_router, "generate_recommendations",
        lambda interests, events, intent=None: [{"eventId": e, "reason": "fits"} for e in event_ids],
    )


def test_conversion_metric_counts_funnel_and_comparison(db_isolation, admin_email, monkeypatch):
    session = db_isolation
    host, _ = _signup()
    e1, e2, e3 = _make_event(host, "E1"), _make_event(host, "E2"), _make_event(host, "E3")

    viewer, vid = _signup()
    _recommend(monkeypatch, [e1, e2])  # e1, e2 recommended; e3 is not
    assert viewer.post(f"/api/users/{vid}/recommendations/refresh").status_code == 200

    # RSVP to e1 (recommended) and e3 (not recommended); check in to e1 only.
    assert viewer.post(f"/api/events/{e1}/rsvps").status_code == 201
    assert viewer.post(f"/api/events/{e3}/rsvps").status_code == 201
    r1 = session.execute(select(Rsvp).where(Rsvp.user_id == vid, Rsvp.event_id == e1)).scalar_one()
    r1.checked_in_at = datetime.now(timezone.utc)
    session.flush()

    admin, _ = _signup(email=admin_email)
    m = admin.get("/api/metrics/recommendation-conversion").json()

    funnel = m["funnel"]
    assert funnel["recommended"] == 2   # e1, e2 logged
    assert funnel["rsvped"] == 1        # only e1 (e2 recommended-not-rsvped; e3 rsvped-not-recommended)
    assert funnel["checked_in"] == 1    # e1 checked in
    assert funnel["rsvp_rate"] == 0.5
    assert funnel["checkin_rate"] == 0.5

    comp = m["comparison"]
    # Recommended side is exact (derived from the fresh, isolated recommendation_log).
    assert comp["recommended_rsvps"] == 1 and comp["recommended_checkin_rate"] == 1.0
    # The "other" bucket is global (all non-recommended RSVPs), so it may include
    # pre-existing rows in a shared dev DB — assert only that our e3 landed in it.
    assert comp["other_rsvps"] >= 1


def test_metric_admin_only(db_isolation):
    user, _ = _signup()
    assert user.get("/api/metrics/recommendation-conversion").status_code == 403
    assert TestClient(app).get("/api/metrics/recommendation-conversion").status_code == 401  # anon


def test_refresh_appends_to_log_once(db_isolation, monkeypatch):
    session = db_isolation
    host, _ = _signup()
    e1 = _make_event(host, "E1")
    viewer, vid = _signup()
    _recommend(monkeypatch, [e1])

    viewer.post(f"/api/users/{vid}/recommendations/refresh")
    count = lambda: session.scalar(
        select(func.count()).select_from(RecommendationLog).where(RecommendationLog.user_id == vid)
    )
    assert count() == 1
    viewer.post(f"/api/users/{vid}/recommendations/refresh")  # re-refresh
    assert count() == 1  # ON CONFLICT DO NOTHING — no duplicate log row
