"""Shared test fixtures.

`db_isolation` gives DB-backed tests (those driving the app via TestClient) real
isolation without a separate test database: each test runs inside one outer
transaction that is rolled back at teardown, so nothing is ever committed to the
configured database and no rows are orphaned even if a test fails mid-way.

How it works: a single connection/transaction is opened, and the app's `get_db`
dependency is overridden to hand out a Session joined to it with
`join_transaction_mode="create_savepoint"`. That makes the app's own `commit()`
calls emit/release SAVEPOINTs instead of committing the outer transaction, so the
final `transaction.rollback()` undoes everything the test did.

Pure unit tests (test_moderation, test_recommendations) don't request this
fixture and touch no database.
"""
import pytest
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app


@pytest.fixture
def db_isolation():
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
        autoflush=False,
        future=True,
    )

    # All requests in this test share the single rolled-back session.
    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield session
    finally:
        app.dependency_overrides.pop(get_db, None)
        session.close()
        transaction.rollback()
        connection.close()
