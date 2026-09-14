"""Endpoint tests for user info, account deletion (cascade), and interests."""
import uuid

from fastapi.testclient import TestClient

from app.main import app


def _signup():
    c = TestClient(app)
    u = uuid.uuid4().hex[:8]
    r = c.post("/api/auth/signup", json={"email": f"u{u}@example.com", "username": f"user_{u}", "password": "password123"})
    return c, r.json()["user_id"]


def _a_seed_tag():
    return TestClient(app).get("/api/tags").json()[0]  # one of the approved seed tags


def test_get_user_and_404(db_isolation):
    _c, uid = _signup()
    assert TestClient(app).get(f"/api/users/{uid}").status_code == 200
    assert TestClient(app).get("/api/users/99999999").status_code == 404


def test_add_list_and_remove_interest(db_isolation):
    c, uid = _signup()
    tag = _a_seed_tag()
    assert c.post(f"/api/users/{uid}/interests", json={"tag_id": tag["tag_id"]}).status_code == 201
    assert c.post(f"/api/users/{uid}/interests", json={"tag_id": tag["tag_id"]}).status_code == 409  # duplicate
    assert tag["tag_id"] in [t["tag_id"] for t in c.get(f"/api/users/{uid}/interests").json()]
    assert c.delete(f"/api/users/{uid}/interests/{tag['tag_id']}").status_code == 200
    assert c.delete(f"/api/users/{uid}/interests/{tag['tag_id']}").status_code == 404  # already gone


def test_interest_is_self_only(db_isolation):
    _c1, uid1 = _signup()
    c2, _ = _signup()
    tag = _a_seed_tag()
    assert c2.post(f"/api/users/{uid1}/interests", json={"tag_id": tag["tag_id"]}).status_code == 403


def test_delete_account_self_only_and_removes_user(db_isolation):
    c, uid = _signup()
    other, _ = _signup()
    assert other.delete(f"/api/users/{uid}").status_code == 403   # not your account
    assert c.delete(f"/api/users/{uid}").status_code == 204       # own account
    assert TestClient(app).get(f"/api/users/{uid}").status_code == 404  # gone
