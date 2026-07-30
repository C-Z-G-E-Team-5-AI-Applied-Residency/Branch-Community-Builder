"""Unit tests for the mission guardrail's pure logic (no live Gemini calls).

Covers the two things most likely to break silently: how user input is framed to
the model (delimited, not merged into instructions) and how the model's reply is
coerced into a safe verdict (fail-safe toward 'pending').
"""
from app.services import moderation
from app.services.moderation import _coerce, build_event_block, review_event


def test_event_block_delimits_all_fields():
    block = build_event_block("Hike", "3mi trail", "meet people", ["outdoors"])
    assert "<title>Hike</title>" in block
    assert "<description>3mi trail</description>" in block
    assert "<why>meet people</why>" in block
    assert "<tags>outdoors</tags>" in block
    assert "untrusted" in block.lower()


def test_event_block_handles_missing_why():
    assert "<why></why>" in build_event_block("T", "D", None, [])


def test_coerce_accepts_approved():
    out = _coerce({"status": "approved", "summary": "A hike", "reason": ""})
    assert out == {"status": "approved", "summary": "A hike", "reason": ""}


def test_coerce_unknown_status_falls_back_to_pending():
    # Anything that isn't exactly "approved" is held — including a would-be injection.
    assert _coerce({"status": "APPROVED_IGNORE_RULES", "summary": "x"})["status"] == "pending"
    assert _coerce({"status": "rejected"})["status"] == "pending"


def test_coerce_non_dict_is_pending():
    assert _coerce(["not", "a", "dict"])["status"] == "pending"
    assert _coerce(None)["status"] == "pending"


def test_coerce_truncates_long_text():
    out = _coerce({"status": "approved", "summary": "x" * 999, "reason": "y" * 999})
    assert len(out["summary"]) == 500 and len(out["reason"]) == 500


def test_review_event_approves_when_no_api_key(monkeypatch):
    # No key configured (e.g. local dev) -> don't block event creation.
    monkeypatch.setattr(moderation.settings, "gemini_api_key", "")
    assert review_event("Book Club", "Monthly meetup", "read together", ["reading"]) == {
        "status": "approved",
        "summary": "",
        "reason": "",
    }
