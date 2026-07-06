"""AI Event Matchmaker (Google Gemini).

Given a user's interest tags and a list of nearby events, ask Gemini to return
a structured JSON array of {"eventId", "reason"}. Results are written to the
recommendations table by the refresh endpoint.
"""
import json

from google import genai
from google.genai import types

from app.config import settings

client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None

MODEL = "gemini-2.0-flash"

PROMPT_TEMPLATE = """You are BRANCH's event matchmaker. Given a user's interests and
a list of nearby events, pick the events they are most likely to enjoy and attend.

User interests: {interests}

Nearby events (id | title | description | tags):
{events}

Return ONLY a JSON array. Each item: {{"eventId": <int>, "reason": "<one sentence>"}}.
Do not include events that are a poor fit. No preamble, no markdown fences.
"""


def recommend(interests: list[str], events: list[dict]) -> list[dict]:
    """Return a list of {"eventId", "reason"} dicts. Empty list on failure."""
    if client is None:
        return []  # no API key configured

    events_block = "\n".join(
        f'{e["event_id"]} | {e["title"]} | {e["event_description"]} | {", ".join(e.get("tags", []))}'
        for e in events
    )
    prompt = PROMPT_TEMPLATE.format(
        interests=", ".join(interests) or "(none listed)",
        events=events_block or "(no events)",
    )

    resp = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    try:
        data = json.loads(resp.text)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []
