"""Endpoint tests for auth: signup, login, logout, and session behavior.

Hermetic — no Gemini, no external services. Isolation via conftest's db_isolation
(each test runs in a rolled-back transaction).
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app


def _creds():
    u = uuid.uuid4().hex[:8]
    return {"email": f"u{u}@example.com", "username": f"user_{u}", "password": "password123"}


def test_signup_creates_account_and_starts_session(db_isolation):
    c = TestClient(app)
    creds = _creds()
    r = c.post("/api/auth/signup", json=creds)
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == creds["email"]
    assert body["has_profile"] is False
    # session is live: a self-only endpoint works without re-authing
    assert c.get(f"/api/users/{body['user_id']}/recommendations").status_code == 200


def test_signup_duplicate_email_conflicts(db_isolation):
    creds = _creds()
    assert TestClient(app).post("/api/auth/signup", json=creds).status_code == 201
    dup = {**_creds(), "email": creds["email"]}  # same email, different username
    assert TestClient(app).post("/api/auth/signup", json=dup).status_code == 409


def test_signup_duplicate_username_conflicts(db_isolation):
    creds = _creds()
    assert TestClient(app).post("/api/auth/signup", json=creds).status_code == 201
    dup = {**_creds(), "username": creds["username"]}  # same username, different email
    assert TestClient(app).post("/api/auth/signup", json=dup).status_code == 409


def test_login_success(db_isolation):
    creds = _creds()
    TestClient(app).post("/api/auth/signup", json=creds)
    r = TestClient(app).post("/api/auth/login", json={"email": creds["email"], "password": creds["password"]})
    assert r.status_code == 200
    assert r.json()["email"] == creds["email"]


def test_login_wrong_password_401(db_isolation):
    creds = _creds()
    TestClient(app).post("/api/auth/signup", json=creds)
    r = TestClient(app).post("/api/auth/login", json={"email": creds["email"], "password": "wrongpassword"})
    assert r.status_code == 401


def test_login_unknown_email_401(db_isolation):
    r = TestClient(app).post("/api/auth/login", json={"email": "nobody@example.com", "password": "password123"})
    assert r.status_code == 401


def test_logout_clears_session(db_isolation):
    c = TestClient(app)
    uid = c.post("/api/auth/signup", json=_creds()).json()["user_id"]
    assert c.get(f"/api/users/{uid}/recommendations").status_code == 200  # authed
    assert c.post("/api/auth/logout").status_code == 200
    assert c.get(f"/api/users/{uid}/recommendations").status_code == 401  # session gone
