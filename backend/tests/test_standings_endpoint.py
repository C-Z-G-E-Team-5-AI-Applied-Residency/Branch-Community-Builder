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
# Real geocode for ZIP 11226 (Flatbush, Brooklyn) — ~853m outside the Flatbush
# polygon (ST_Contains misses) but the nearest seeded neighborhood and well
# within NEARBY_METERS (3200m), so ST_DWithin's fallback should resolve it.
FLATBUSH_GAP = {"latitude": 40.6488, "longitude": -73.9581}
# Boston — zero seeded neighborhoods (NY-only dataset) within NEARBY_METERS
# of this point, so this must resolve to no neighborhood at all.
OUTSIDE_RANGE = {"latitude": 42.3601, "longitude": -71.0589}


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
    r = client.post(f"/api/events/{event['event_id']}/rsvps")
    assert r.status_code == 201, r.text
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


def test_hosting_in_polygon_gap_falls_back_to_nearest_neighborhood(db_isolation):
    host, hid = _signup()
    _make_event(host, "Flatbush Meetup", FLATBUSH_GAP)

    standings = host.get(f"/api/users/{hid}/standings").json()
    assert len(standings) == 1
    assert standings[0]["neighborhood_name"] == "Flatbush"
    assert standings[0]["events_hosted"] == 1


def test_hosting_far_outside_every_neighborhood_records_no_standing(db_isolation):
    host, hid = _signup()
    _make_event(host, "Boston Meetup", OUTSIDE_RANGE)

    assert host.get(f"/api/users/{hid}/standings").json() == []


def test_is_leader_after_attendance_threshold(db_isolation):
    host, _ = _signup()
    viewer, vid = _signup()
    for i in range(10):  # LEADER_ATTENDED_THRESHOLD
        event = _make_event(host, f"E{i}", WEST_VILLAGE)
        _rsvp_and_check_in(viewer, event)

    standings = viewer.get(f"/api/users/{vid}/standings").json()
    assert standings[0]["events_attended"] == 10
    assert standings[0]["is_leader"] is True


def test_hosted_events_breakdown_matches_neighborhood_and_confirmed_count(db_isolation):
    host, hid = _signup()
    event = _make_event(host, "Downtown Meetup", WEST_VILLAGE)
    other_event = _make_event(host, "Brooklyn Meetup", BENSONHURST)  # different neighborhood, no RSVPs

    attendee, _ = _signup()
    assert attendee.post(f"/api/events/{event['event_id']}/rsvps").status_code == 201

    standings = host.get(f"/api/users/{hid}/standings").json()
    west_village = next(s for s in standings if s["neighborhood_name"] == "West Village")
    bensonhurst = next(s for s in standings if s["neighborhood_name"] == "Bensonhurst")

    # each neighborhood's breakdown only lists events that actually resolved
    # there — not the host's full event list
    assert [e["event_id"] for e in west_village["hosted_events"]] == [event["event_id"]]
    assert west_village["hosted_events"][0]["confirmed_count"] == 1

    assert [e["event_id"] for e in bensonhurst["hosted_events"]] == [other_event["event_id"]]
    assert bensonhurst["hosted_events"][0]["confirmed_count"] == 0


def test_double_check_in_is_rejected_and_does_not_double_count(db_isolation):
    host, _ = _signup()
    event = _make_event(host, "E1", WEST_VILLAGE)

    viewer, vid = _signup()
    _rsvp_and_check_in(viewer, event)

    # second check-in attempt against the same RSVP is rejected...
    r = viewer.post(f"/api/events/{event['event_id']}/check-in", json={"code": event["check_in_code"]})
    assert r.status_code == 409

    # ...and events_attended still reflects only the one successful check-in
    standings = viewer.get(f"/api/users/{vid}/standings").json()
    assert standings[0]["events_attended"] == 1
