"""Prompt-construction tests for the AI matchmaker.

Intent-aware ranking is the whole point of the intent feature, so these lock in
that the user's free-text intent and each event's "why" actually make it into
the Gemini prompt. They test `build_prompt` directly (pure, no API call), so a
future prompt-template edit that silently drops the weighting fails here.
"""
from app.services.recommendations import build_prompt

EVENTS = [
    {
        "event_id": 1,
        "title": "Sunrise Hike",
        "event_description": "Easy 3mi trail",
        "why": "help new-to-town folks meet people outdoors",
        "tags": ["outdoors"],
    },
    {
        "event_id": 2,
        "title": "Pickup Basketball",
        "event_description": "Competitive runs",
        "why": "regular ballers looking for a game",
        "tags": ["basketball"],
    },
]


def test_prompt_includes_user_intent():
    prompt = build_prompt(["outdoors"], EVENTS, intent="just moved here, want to meet people")
    assert "just moved here, want to meet people" in prompt


def test_prompt_includes_each_event_why():
    prompt = build_prompt(["outdoors"], EVENTS, intent="anything")
    for event in EVENTS:
        assert event["why"] in prompt


def test_prompt_includes_interests_and_event_core_fields():
    prompt = build_prompt(["outdoors", "music"], EVENTS)
    assert "outdoors" in prompt and "music" in prompt
    for event in EVENTS:
        assert event["title"] in prompt
        assert event["event_description"] in prompt


def test_missing_intent_uses_placeholder_not_blank():
    # No intent provided -> a clear placeholder, never an empty/confusing line.
    assert "(not provided)" in build_prompt(["outdoors"], EVENTS)
    assert "(not provided)" in build_prompt(["outdoors"], EVENTS, intent="   ")


def test_missing_why_uses_placeholder():
    events = [{"event_id": 9, "title": "Mystery", "event_description": "TBD", "tags": []}]
    assert "(not stated)" in build_prompt([], events, intent="x")
