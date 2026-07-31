"""Tests for GET /api/users/{user_id}/standings (BR-44).

Hosting/attendance are recorded by app.services.standings, invoked from
POST /api/events (host) and POST /api/events/{id}/check-in (attendee) — these
tests drive those endpoints rather than calling the service directly, so a
regression in the wiring (not just the math) would fail here too.

Check-in is time-gated to within an hour of event_date, so events are created
starting "now" rather than the far-future dates other test files use.
Isolation via conftest's db_isolation fixture.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import events as events_router

# Centroids of seeded neighborhoods (see neighborhoods table) — real polygons
# so record_hosted/record_attendance resolve a neighborhood_id instead of no-op'ing.
WEST_VILLAGE = {"latitude": 40.73576326446611, "longitude": -74.00716301942248}
BENSONHURST = {"latitude": 40.60925610894086, "longitude": -73.99932492740892}


@pytest.fixture(autouse=True)
def _stub_guardrail(monkeypatch):
    monkeypatch.setattr(
        events_router, "review_event", lambda *a, **k: {"status": "approved", "summary": "", "reason": ""}
    )


def _signup():
    c = TestClient(app)
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    r = c.post("/api/auth/signup", json={"email": email, "username": email.split("@")[0], "password": "password123"})
    assert r.status_code == 201, r.text
    return c, r.json()["user_id"]


def _make_event(client, title, coords, starts_in_minutes=30):
    event_date = datetime.now(timezone.utc) + timedelta(minutes=starts_in_minutes)
    body = {
        "title": title, "event_description": "d", "why": "connect",
        "event_date": event_date.isoformat(), "event_end_date": (event_date + timedelta(hours=1)).isoformat(),
        "location": "test", "event_zip_code": 10012, "event_capacity": 20,
        "event_image_url": "/images/default_event.png", "tag_names": [],
        **coords,
    }
    r = client.post("/api/events", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _rsvp_and_check_in(client, event):
    assert client.post(f"/api/events/{event['event_id']}/rsvps").status_code == 201
    r = client.post(f"/api/events/{event['event_id']}/check-in", json={"code": event["check_in_code"]})
    assert r.status_code == 200, r.text


def test_hosting_records_standing(db_isolation):
    host, hid = _signup()
    _make_event(host, "E1", WEST_VILLAGE)

    standings = host.get(f"/api/users/{hid}/standings").json()
    assert len(standings) == 1
    s = standings[0]
    assert s["neighborhood_name"] == "West Village"
    assert s["events_hosted"] == 1
    assert s["events_attended"] == 0
    assert s["is_leader"] is False


def test_attendance_records_standing(db_isolation):
    host, _ = _signup()
    event = _make_event(host, "E1", WEST_VILLAGE)

    viewer, vid = _signup()
    _rsvp_and_check_in(viewer, event)

    standings = viewer.get(f"/api/users/{vid}/standings").json()
    assert len(standings) == 1
    assert standings[0]["events_attended"] == 1
    assert standings[0]["events_hosted"] == 0


def test_is_leader_after_hosting_threshold(db_isolation):
    host, hid = _signup()
    for i in range(3):  # LEADER_HOSTED_THRESHOLD
        _make_event(host, f"E{i}", WEST_VILLAGE)

    standings = host.get(f"/api/users/{hid}/standings").json()
    assert standings[0]["events_hosted"] == 3
    assert standings[0]["is_leader"] is True


def test_standing_per_neighborhood_kept_separate(db_isolation):
    host, hid = _signup()
    _make_event(host, "Downtown", WEST_VILLAGE)
    _make_event(host, "Brooklyn", BENSONHURST)

    standings = host.get(f"/api/users/{hid}/standings").json()
    assert len(standings) == 2
    names = {s["neighborhood_name"] for s in standings}
    assert names == {"West Village", "Bensonhurst"}
    assert all(s["events_hosted"] == 1 for s in standings)


def test_no_activity_returns_empty_list(db_isolation):
    user, uid = _signup()
    assert user.get(f"/api/users/{uid}/standings").json() == []
