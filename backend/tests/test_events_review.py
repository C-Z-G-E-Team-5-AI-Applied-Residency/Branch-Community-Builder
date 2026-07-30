"""Endpoint tests for the mission guardrail: visibility rules, admin gating, the
approve/reject flow, and edit-time re-checking.

Moderation is stubbed (no live Gemini) so the tests are hermetic and deterministic.
They DO require the app's Postgres database to be reachable — they exercise the real
routers/DB via TestClient. Isolation comes from the `db_isolation` fixture (see
conftest.py): each test runs in a transaction that is rolled back at teardown, so
nothing is committed to the database regardless of pass/fail.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routers import events as events_router


def _fake_review(title, description, why, tags):
    """Deterministic stand-in for the Gemini guardrail: anything mentioning crypto
    is held, everything else is approved."""
    text = f"{title} {description} {why or ''}".lower()
    if "crypto" in text:
        return {"status": "pending", "summary": "A paid crypto solicitation.", "reason": "off-mission: promotion"}
    return {"status": "approved", "summary": "A local community event.", "reason": ""}


@pytest.fixture(autouse=True)
def stub_moderation(monkeypatch):
    # Never call Gemini from tests. update_event reads the same module global, so
    # edit-time re-checks are stubbed too.
    monkeypatch.setattr(events_router, "review_event", _fake_review)


@pytest.fixture
def admin_email(monkeypatch):
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    monkeypatch.setattr(settings, "admin_emails", email)
    return email


@pytest.fixture
def users(db_isolation):
    """Factory for signed-in TestClients. No manual cleanup needed — everything
    these clients write is rolled back by db_isolation at the end of the test."""

    def make(email=None):
        c = TestClient(app)
        email = email or f"user-{uuid.uuid4().hex[:8]}@example.com"
        r = c.post(
            "/api/auth/signup",
            json={"email": email, "username": email.split("@")[0], "password": "password123"},
        )
        assert r.status_code == 201, r.text
        return c

    return make


_EVENT_BASE = {
    "event_date": "2027-01-01T18:00:00Z",
    "event_end_date": "2027-01-01T20:00:00Z",
    "location": "Washington Square Park",
    "event_zip_code": 10012,
    "event_capacity": 20,
    "event_image_url": "/images/default_event.png",
    "latitude": 40.7308,
    "longitude": -73.9973,
    "tag_ids": [],
}


def make_event(client, title, desc, why="bring the community together"):
    r = client.post("/api/events", json={**_EVENT_BASE, "title": title, "event_description": desc, "why": why})
    assert r.status_code == 201, r.text
    return r.json()


def test_create_sets_review_status_from_guardrail(users):
    host = users()
    assert make_event(host, "Book Club", "read together")["review_status"] == "approved"
    assert make_event(host, "Crypto Course", "join my paid webinar")["review_status"] == "pending"


def test_pending_hidden_from_public_but_visible_to_host(users):
    host = users()
    bad = make_event(host, "Crypto Course", "join my paid webinar")
    good = make_event(host, "Book Club", "read together")
    anon = TestClient(app)
    anon_ids = {e["event_id"] for e in anon.get("/api/events").json()}
    assert good["event_id"] in anon_ids
    assert bad["event_id"] not in anon_ids
    host_ids = {e["event_id"] for e in host.get("/api/events").json()}
    assert bad["event_id"] in host_ids  # host still sees their own held event


def test_get_event_404s_pending_for_non_host(users):
    host = users()
    bad = make_event(host, "Crypto Course", "join my paid webinar")
    assert TestClient(app).get(f"/api/events/{bad['event_id']}").status_code == 404  # anon
    assert users().get(f"/api/events/{bad['event_id']}").status_code == 404  # other signed-in user
    assert host.get(f"/api/events/{bad['event_id']}").status_code == 200  # host allowed


def test_public_listing_omits_moderator_fields(users):
    host = users()
    make_event(host, "Book Club", "read together")
    for e in TestClient(app).get("/api/events").json():
        assert "review_summary" not in e
        assert "review_reason" not in e


def test_admin_gating_and_queue_contents(admin_email, users):
    host = users()
    bad = make_event(host, "Crypto Course", "join my paid webinar")
    good = make_event(host, "Book Club", "read together")

    nonadmin = users()
    assert nonadmin.get("/api/me/is-admin").json()["is_admin"] is False
    assert nonadmin.get("/api/events/pending-review").status_code == 403

    admin = users(email=admin_email)
    assert admin.get("/api/me/is-admin").json()["is_admin"] is True
    q = admin.get("/api/events/pending-review")
    assert q.status_code == 200
    qids = {e["event_id"] for e in q.json()}
    assert bad["event_id"] in qids
    assert good["event_id"] not in qids
    # queue rows carry the moderator-facing fields
    assert any(e["event_id"] == bad["event_id"] and "review_summary" in e for e in q.json())
    # admin (not the host) may open a held event
    assert admin.get(f"/api/events/{bad['event_id']}").status_code == 200


def test_non_admin_cannot_decide(users):
    host = users()
    bad = make_event(host, "Crypto Course", "join my paid webinar")
    assert users().patch(f"/api/events/{bad['event_id']}/review", json={"decision": "approve"}).status_code == 403


def test_approve_makes_event_public(admin_email, users):
    host = users()
    bad = make_event(host, "Crypto Course", "join my paid webinar")
    admin = users(email=admin_email)
    r = admin.patch(f"/api/events/{bad['event_id']}/review", json={"decision": "approve", "note": "checked, it's fine"})
    assert r.status_code == 200
    assert r.json()["review_status"] == "approved"
    anon_ids = {e["event_id"] for e in TestClient(app).get("/api/events").json()}
    assert bad["event_id"] in anon_ids


def test_editing_approved_into_offmission_reholds_it(users):
    host = users()
    good = make_event(host, "Book Club", "read together")
    assert good["review_status"] == "approved"

    r = host.patch(
        f"/api/events/{good['event_id']}",
        json={"event_description": "actually, join my paid crypto webinar"},
    )
    assert r.status_code == 200
    assert r.json()["review_status"] == "pending"
    # and it drops back out of the public listing
    anon_ids = {e["event_id"] for e in TestClient(app).get("/api/events").json()}
    assert good["event_id"] not in anon_ids


def test_editing_noncontent_field_does_not_rerun_guardrail(users):
    host = users()
    good = make_event(host, "Book Club", "read together")
    # changing capacity (not title/description/why) must not re-moderate/flip status
    r = host.patch(f"/api/events/{good['event_id']}", json={"event_capacity": 99})
    assert r.status_code == 200
    assert r.json()["review_status"] == "approved"
