"""Endpoint tests for emergent tags: reuse-vs-mint on event create, the approved
vocabulary filter, tag_id validation, and admin governance (pending/approve/rename/reject).

Guardrail and tag suggester are stubbed (no Gemini); isolation via conftest's db_isolation.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routers import events as events_router
from app.routers import tags as tags_router


@pytest.fixture(autouse=True)
def _stub_guardrail(monkeypatch):
    monkeypatch.setattr(
        events_router, "review_event", lambda *a, **k: {"status": "approved", "summary": "ok", "reason": ""}
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
    return c


def _make_event(client, tag_ids=None, tag_names=None):
    body = {
        "title": "Community Thing", "event_description": "desc", "why": "connect people",
        "event_date": "2027-01-01T18:00:00Z", "event_end_date": "2027-01-01T20:00:00Z",
        "location": "Washington Square Park", "event_zip_code": 10012, "event_capacity": 20,
        "event_image_url": "/images/default_event.png", "latitude": 40.7308, "longitude": -73.9973,
        "tag_ids": tag_ids or [], "tag_names": tag_names or [],
    }
    return client.post("/api/events", json=body)


def _names(event_json):
    return {t["name"] for t in event_json["tags"]}


def _approved_names():
    return {t["name"] for t in TestClient(app).get("/api/tags").json()}


def test_new_tag_name_is_minted_pending_and_attached(db_isolation, admin_email):
    host = _signup()
    ev = _make_event(host, tag_names=["Sunrise Hiking"]).json()
    assert "sunrise hiking" in _names(ev)  # normalized + attached
    assert "sunrise hiking" not in _approved_names()  # not public until approved

    admin = _signup(email=admin_email)
    pending = admin.get("/api/tags/pending").json()
    row = next(t for t in pending if t["name"] == "sunrise hiking")
    assert row["usage_count"] == 1
    assert row["created_by_event_id"] == ev["event_id"]


def test_existing_tag_name_reused_case_insensitively_no_dupe(db_isolation, admin_email):
    host = _signup()
    ev = _make_event(host, tag_names=["music", "MUSIC"]).json()  # seed tag, dupe-cased
    assert "music" in _names(ev)
    assert len([t for t in ev["tags"] if t["name"] == "music"]) == 1  # attached once
    admin = _signup(email=admin_email)
    assert "music" not in {t["name"] for t in admin.get("/api/tags/pending").json()}  # no pending dupe


def test_unknown_tag_id_is_400_not_500(db_isolation):
    assert _make_event(_signup(), tag_ids=[999_999_999]).status_code == 400


def test_non_admin_blocked_from_tag_governance(db_isolation):
    user = _signup()
    assert user.get("/api/tags/pending").status_code == 403
    tid = TestClient(app).get("/api/tags").json()[0]["tag_id"]
    assert user.patch(f"/api/tags/{tid}", json={"status": "approved"}).status_code == 403
    assert user.delete(f"/api/tags/{tid}").status_code == 403


def test_admin_approve_makes_tag_public(db_isolation, admin_email):
    host = _signup()
    _make_event(host, tag_names=["pottery"])
    admin = _signup(email=admin_email)
    tid = next(t["tag_id"] for t in admin.get("/api/tags/pending").json() if t["name"] == "pottery")
    r = admin.patch(f"/api/tags/{tid}", json={"status": "approved"})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert "pottery" in _approved_names()


def test_admin_rename_and_reject(db_isolation, admin_email):
    host = _signup()
    _make_event(host, tag_names=["typo tagg"])
    admin = _signup(email=admin_email)
    tid = next(t["tag_id"] for t in admin.get("/api/tags/pending").json() if t["name"] == "typo tagg")
    assert admin.patch(f"/api/tags/{tid}", json={"name": "Proper Tag"}).json()["name"] == "proper tag"
    assert admin.delete(f"/api/tags/{tid}").status_code == 204
    assert not any(t["tag_id"] == tid for t in admin.get("/api/tags/pending").json())


def test_suggest_requires_auth_and_returns_suggestions(db_isolation, monkeypatch):
    monkeypatch.setattr(
        tags_router, "suggest_tags", lambda title, desc, why, existing: [{"name": "hiking", "is_new": True}]
    )
    assert TestClient(app).post("/api/tags/suggest", json={"title": "x"}).status_code == 401
    r = _signup().post("/api/tags/suggest", json={"title": "Sunrise Hike", "description": "trail", "why": "meet"})
    assert r.status_code == 200
    assert r.json()["suggestions"] == [{"name": "hiking", "is_new": True}]


def test_pending_tag_hidden_from_public_but_shown_to_host(db_isolation, admin_email):
    host = _signup()
    ev = _make_event(host, tag_names=["music", "brand new theme"]).json()  # approved seed + fresh pending
    eid = ev["event_id"]
    # create response (to the host) shows both
    assert {"music", "brand new theme"} <= _names(ev)

    anon = TestClient(app)
    # public event detail, public listing, and public /tags all hide the pending tag
    assert _names(anon.get(f"/api/events/{eid}").json()) == {"music"}
    listed = next(e for e in anon.get("/api/events").json() if e["event_id"] == eid)
    assert "brand new theme" not in {t["name"] for t in listed["tags"]}
    assert {t["name"] for t in anon.get(f"/api/events/{eid}/tags").json()} == {"music"}

    # another signed-in, non-host user also can't see it
    assert "brand new theme" not in _names(_signup().get(f"/api/events/{eid}").json())

    # the host still sees it on their own event detail
    assert "brand new theme" in _names(host.get(f"/api/events/{eid}").json())

    # an admin sees pending tags on any event's detail page, not just via the queue
    admin = _signup(email=admin_email)
    assert "brand new theme" in _names(admin.get(f"/api/events/{eid}").json())


def test_cannot_delete_approved_tag(db_isolation, admin_email):
    admin = _signup(email=admin_email)
    approved_tid = TestClient(app).get("/api/tags").json()[0]["tag_id"]  # a seed (approved) tag
    assert admin.delete(f"/api/tags/{approved_tid}").status_code == 409  # must un-approve first
