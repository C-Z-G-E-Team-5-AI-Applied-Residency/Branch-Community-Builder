"""Endpoint tests for the RSVP + check-in flow — the core "did they show up?" path.

Event creation is stubbed past the mission guardrail (no Gemini). Isolation via
conftest's db_isolation.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import events as events_router


@pytest.fixture(autouse=True)
def _stub_guardrail(monkeypatch):
    monkeypatch.setattr(
        events_router, "review_event", lambda *a, **k: {"status": "approved", "summary": "", "reason": ""}
    )


def _signup():
    c = TestClient(app)
    u = uuid.uuid4().hex[:8]
    r = c.post("/api/auth/signup", json={"email": f"u{u}@example.com", "username": f"user_{u}", "password": "password123"})
    return c, r.json()["user_id"]


def _make_event(host, *, start=None, end=None):
    now = datetime.now(timezone.utc)
    start = start or now + timedelta(minutes=30)   # check-in already open (opens 1h before start)
    end = end or now + timedelta(hours=3)
    r = host.post("/api/events", json={
        "title": "Test Event", "event_description": "desc", "why": "connect",
        "event_date": start.isoformat(), "event_end_date": end.isoformat(),
        "location": "New York, NY", "event_zip_code": 10012, "event_capacity": 20,
        "event_image_url": "/images/default_event.png", "latitude": 40.73, "longitude": -73.99, "tag_names": [],
    })
    assert r.status_code == 201, r.text
    return r.json()  # host response includes check_in_code


def test_rsvp_create_and_duplicate(db_isolation):
    host, _ = _signup()
    ev = _make_event(host)
    attendee, _ = _signup()
    r = attendee.post(f"/api/events/{ev['event_id']}/rsvps")
    assert r.status_code == 201 and r.json()["status"] == "going"
    assert attendee.post(f"/api/events/{ev['event_id']}/rsvps").status_code == 409  # duplicate


def test_rsvp_requires_auth_and_existing_event(db_isolation):
    assert TestClient(app).post("/api/events/999999/rsvps").status_code == 401
    host, _ = _signup()
    assert host.post("/api/events/999999/rsvps").status_code == 404


def test_rsvp_to_ended_event_blocked(db_isolation):
    host, _ = _signup()
    now = datetime.now(timezone.utc)
    ev = _make_event(host, start=now - timedelta(hours=3), end=now - timedelta(hours=1))
    attendee, _ = _signup()
    assert attendee.post(f"/api/events/{ev['event_id']}/rsvps").status_code == 400


def test_check_in_happy_path_and_edges(db_isolation):
    host, _ = _signup()
    ev = _make_event(host)  # starts in 30 min -> check-in open now
    attendee, _ = _signup()
    attendee.post(f"/api/events/{ev['event_id']}/rsvps")

    # wrong code rejected
    assert attendee.post(f"/api/events/{ev['event_id']}/check-in", json={"code": "wrong"}).status_code == 400
    # correct code -> verified attended
    r = attendee.post(f"/api/events/{ev['event_id']}/check-in", json={"code": ev["check_in_code"]})
    assert r.status_code == 200 and r.json()["did_attend"] is True and r.json()["checked_in_at"] is not None
    # can't check in twice
    assert attendee.post(f"/api/events/{ev['event_id']}/check-in", json={"code": ev["check_in_code"]}).status_code == 409


def test_check_in_without_rsvp_404(db_isolation):
    host, _ = _signup()
    ev = _make_event(host)
    attendee, _ = _signup()  # never RSVP'd
    r = attendee.post(f"/api/events/{ev['event_id']}/check-in", json={"code": ev["check_in_code"]})
    assert r.status_code == 404


def test_check_in_not_open_yet(db_isolation):
    host, _ = _signup()
    now = datetime.now(timezone.utc)
    ev = _make_event(host, start=now + timedelta(hours=5), end=now + timedelta(hours=8))  # opens 1h before -> not yet
    attendee, _ = _signup()
    attendee.post(f"/api/events/{ev['event_id']}/rsvps")
    assert attendee.post(f"/api/events/{ev['event_id']}/check-in", json={"code": ev["check_in_code"]}).status_code == 400


def test_owner_can_cancel_and_delete_rsvp(db_isolation):
    host, _ = _signup()
    ev = _make_event(host)
    attendee, _ = _signup()
    rid = attendee.post(f"/api/events/{ev['event_id']}/rsvps").json()["rsvp_id"]
    assert attendee.patch(f"/api/rsvps/{rid}", json={"status": "cancelled"}).json()["status"] == "cancelled"
    other, _ = _signup()
    assert other.patch(f"/api/rsvps/{rid}", json={"status": "going"}).status_code == 403  # not owner
    assert attendee.delete(f"/api/rsvps/{rid}").status_code == 200


def test_host_verifies_attendance_but_attendee_cannot(db_isolation):
    host, _ = _signup()
    ev = _make_event(host)
    attendee, _ = _signup()
    rid = attendee.post(f"/api/events/{ev['event_id']}/rsvps").json()["rsvp_id"]
    # attendee can't set did_attend on themselves
    assert attendee.patch(f"/api/rsvps/{rid}", json={"did_attend": True}).status_code == 403
    # host can, and it stamps a check-in time
    r = host.patch(f"/api/rsvps/{rid}", json={"did_attend": True})
    assert r.status_code == 200 and r.json()["did_attend"] is True and r.json()["checked_in_at"] is not None
