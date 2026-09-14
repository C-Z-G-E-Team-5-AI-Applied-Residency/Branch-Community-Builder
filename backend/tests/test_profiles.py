"""Endpoint tests for profiles: create (with intent), read, update, and ownership."""
import uuid

from fastapi.testclient import TestClient

from app.main import app


def _signup():
    c = TestClient(app)
    u = uuid.uuid4().hex[:8]
    r = c.post("/api/auth/signup", json={"email": f"u{u}@example.com", "username": f"user_{u}", "password": "password123"})
    assert r.status_code == 201
    return c, r.json()["user_id"]


def _profile(**over):
    return {"display_name": "Test", "bio": "hello", "home_zip_code": "10012", **over}


def test_create_and_read_profile_with_intent(db_isolation):
    c, uid = _signup()
    r = c.post("/api/profiles", json=_profile(intent="meet people outdoors"))
    assert r.status_code == 201
    assert r.json()["intent"] == "meet people outdoors"
    got = TestClient(app).get(f"/api/profiles/{uid}")  # profiles are publicly readable
    assert got.status_code == 200
    assert got.json()["display_name"] == "Test"


def test_duplicate_profile_conflicts(db_isolation):
    c, _ = _signup()
    assert c.post("/api/profiles", json=_profile()).status_code == 201
    assert c.post("/api/profiles", json=_profile()).status_code == 409


def test_missing_profile_404(db_isolation):
    _c, uid = _signup()  # signed up but no profile
    assert TestClient(app).get(f"/api/profiles/{uid}").status_code == 404


def test_update_own_profile(db_isolation):
    c, uid = _signup()
    c.post("/api/profiles", json=_profile())
    r = c.patch(f"/api/profiles/{uid}", json={"bio": "updated", "intent": "new intent"})
    assert r.status_code == 200
    assert r.json()["bio"] == "updated"
    assert r.json()["intent"] == "new intent"


def test_cannot_update_another_users_profile(db_isolation):
    c1, uid1 = _signup()
    c1.post("/api/profiles", json=_profile())
    c2, _ = _signup()
    assert c2.patch(f"/api/profiles/{uid1}", json={"bio": "hacked"}).status_code == 403
