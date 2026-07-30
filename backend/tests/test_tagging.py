"""Unit tests for the emergent-tag suggester's pure logic (no live Gemini)."""
from app.services import tagging
from app.services.tagging import build_tagging_prompt, suggest_tags


def test_prompt_lists_existing_vocabulary_and_delimits_input():
    p = build_tagging_prompt("Jazz Night", "live music", "bring people together", ["music", "outdoors"])
    assert "music, outdoors" in p  # sorted existing tags offered for reuse
    assert "<title>Jazz Night</title>" in p
    assert "untrusted" in p.lower()


def test_prompt_handles_empty_vocabulary():
    assert "(none yet)" in build_tagging_prompt("T", "D", None, [])


def test_suggest_returns_empty_without_api_key(monkeypatch):
    monkeypatch.setattr(tagging.settings, "gemini_api_key", "")
    assert suggest_tags("Book Club", "read together", "meet readers", ["reading"]) == []
