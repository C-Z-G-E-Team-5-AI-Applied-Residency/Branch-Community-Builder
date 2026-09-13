"""Clock-skew-tolerant session cookie signing.

Starlette's ``SessionMiddleware`` signs the session cookie with an
``itsdangerous`` timestamp signer. On read, itsdangerous rejects any cookie
whose embedded timestamp is *newer* than the current wall clock (``age < 0``)
just as harshly as an expired one. ``SessionMiddleware`` catches that rejection
as a bad signature and hands the request an empty session — so the user looks
unauthenticated and gets a 401.

That future-dated case happens for real whenever the host wall clock steps
backward between signing and reading a cookie — e.g. an NTP correction on a CI
runner or VM. It surfaced as an intermittent (~1-in-10 full-suite runs) 401
from a ``TestClient`` that had just signed up: nothing wrong with the test or
the cookie, just the clock moving back a second underneath it.

The fix gives verification a small backward-skew grace: a cookie that looks at
most ``CLOCK_SKEW_GRACE_SECONDS`` future-dated is accepted instead of rejected.
Genuine expiry (``age`` beyond ``max_age``) is left untouched. The grace is
negligible against the 14-day session lifetime, and adding leeway for clock
skew is standard practice for signed-token verification (JWT libraries do the
same).
"""
import time

import itsdangerous
from itsdangerous import SignatureExpired
from starlette.middleware.sessions import SessionMiddleware

# How far the host clock may step backward without invalidating live sessions.
# Real NTP corrections are sub-second to a few seconds; 5 minutes is ample
# headroom and trivial next to the 14-day cookie lifetime.
CLOCK_SKEW_GRACE_SECONDS = 300


class _SkewTolerantTimestampSigner(itsdangerous.TimestampSigner):
    """Timestamp signer that tolerates a small *backward* clock skew on read.

    itsdangerous rejects a cookie whose timestamp is newer than now (``age <
    0``). After a backward wall-clock step a freshly signed cookie looks exactly
    like that, so we re-accept it when it is at most ``CLOCK_SKEW_GRACE_SECONDS``
    ahead. Truly expired cookies (past ``max_age``) still raise, and the
    signature itself is still verified by ``super().unsign`` before we get here.
    """

    def unsign(self, signed_value, max_age=None, return_timestamp=False):
        try:
            return super().unsign(signed_value, max_age, return_timestamp)
        except SignatureExpired as exc:
            # We only want to soften the future-dated (age < 0) case, never real
            # expiry. date_signed is set for both; recompute the age and bail out
            # unless it falls within the small backward-skew window. The
            # itsdangerous epoch cancels out comparing two POSIX timestamps.
            if exc.date_signed is None:
                raise
            age = int(time.time()) - int(exc.date_signed.timestamp())
            if not (-CLOCK_SKEW_GRACE_SECONDS <= age < 0):
                raise  # genuinely expired, or skew larger than we'll tolerate
            value = exc.payload or b""
            return (value, exc.date_signed) if return_timestamp else value


class ClockSkewTolerantSessionMiddleware(SessionMiddleware):
    """``SessionMiddleware`` whose cookie signer tolerates a small backward
    wall-clock step, so an NTP correction can't spuriously log a user out.
    """

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        # Reuse the signer the parent built (same secret/salt/config) and just
        # swap in the skew-tolerant unsign behavior.
        self.signer.__class__ = _SkewTolerantTimestampSigner
