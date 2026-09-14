"""Unit tests for clock-skew-tolerant session cookie verification.

Regression coverage for an intermittent 401: itsdangerous rejects a session
cookie whose timestamp is newer than "now" (age < 0), which is what a freshly
signed cookie looks like after the host wall clock steps backward (an NTP
correction on a CI/VM host). ``ClockSkewTolerantSessionMiddleware`` softens only
that small-backward-skew case while leaving real expiry enforced.
"""
import time

import pytest
from itsdangerous import SignatureExpired

from app.core.session import (
    CLOCK_SKEW_GRACE_SECONDS,
    _SkewTolerantTimestampSigner,
)


def _sign_at(signer, value, offset):
    """Sign ``value`` as if the clock were ``offset`` seconds from now."""
    real = time.time
    try:
        time.time = lambda: real() + offset  # itsdangerous reads time.time()
        return signer.sign(value)
    finally:
        time.time = real


@pytest.fixture
def signer():
    return _SkewTolerantTimestampSigner("test-secret")


def test_future_dated_cookie_within_grace_is_accepted(signer):
    # Signed a few seconds in the future (i.e. clock has since stepped back).
    token = _sign_at(signer, b"user", offset=CLOCK_SKEW_GRACE_SECONDS - 5)
    assert signer.unsign(token, max_age=1209600) == b"user"


def test_future_dated_cookie_beyond_grace_is_rejected(signer):
    token = _sign_at(signer, b"user", offset=CLOCK_SKEW_GRACE_SECONDS + 60)
    with pytest.raises(SignatureExpired):
        signer.unsign(token, max_age=1209600)


def test_genuinely_expired_cookie_is_still_rejected(signer):
    # Signed well before the max_age window — real expiry, must not be softened.
    token = _sign_at(signer, b"user", offset=-(1209600 + 3600))
    with pytest.raises(SignatureExpired):
        signer.unsign(token, max_age=1209600)


def test_normal_cookie_round_trips(signer):
    token = signer.sign(b"user")
    assert signer.unsign(token, max_age=1209600) == b"user"
