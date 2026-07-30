"""AI Event Matchmaker (Google Gemini).

Given a user's interest tags and a list of nearby events, ask Gemini to return
a structured JSON array of {"eventId", "reason"}. Results are written to the
recommendations table by the refresh endpoint.
"""
import json
import logging

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

MODEL = "gemini-3.1-flash-lite"

# The .env.example placeholder — treat it the same as "no key configured".
_PLACEHOLDER_KEY = "your-gemini-api-key"

PROMPT_TEMPLATE = """You are BRANCH's event matchmaker. Given a user's interests, what they
said they want out of going out, and a list of nearby events, pick the events they are most
likely to enjoy and actually show up to. Weigh the user's own words (their intent) as heavily
as their interest tags — it captures the "why" behind what they're looking for.

User interests: {interests}
User intent (in their own words): {intent}

Nearby events (id | title | description | why the host is holding it | tags):
{events}

Return ONLY a JSON array. Each item: {{"eventId": <int>, "reason": "<one sentence>"}}.
The reason should connect the event to the user's intent/interests. Do not include events that
are a poor fit. No preamble, no markdown fences.
"""


def _get_client() -> genai.Client | None:
    """Build the client at call time so a key set after startup takes effect."""
    key = settings.gemini_api_key
    if not key or key == _PLACEHOLDER_KEY:
        return None
    return genai.Client(api_key=key)


def build_prompt(interests: list[str], events: list[dict], intent: str | None = None) -> str:
    """Assemble the matchmaker prompt. Pure/deterministic (no API call) so the
    intent + per-event 'why' weighting can be unit-tested directly."""
    events_block = "\n".join(
        f'{e["event_id"]} | {e["title"]} | {e["event_description"]}'
        f' | {e.get("why") or "(not stated)"} | {", ".join(e.get("tags", []))}'
        for e in events
    )
    return PROMPT_TEMPLATE.format(
        interests=", ".join(interests) or "(none listed)",
        intent=(intent or "").strip() or "(not provided)",
        events=events_block,
    )


def generate_recommendations(
    interests: list[str], events: list[dict], intent: str | None = None
) -> list[dict]:
    """Return a list of {"eventId", "reason"} dicts. Empty list when no API key
    is configured or the call/response is unusable — never raises."""
    client = _get_client()
    if client is None:
        return []
    if not events:
        return []

    prompt = build_prompt(interests, events, intent)

    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        data = json.loads(resp.text)
    except Exception:
        logger.exception("Gemini recommendation call failed")
        return []

    if not isinstance(data, list):
        return []
    results = []
    for item in data:
        try:
            results.append({"eventId": int(item["eventId"]), "reason": str(item["reason"])})
        except (KeyError, TypeError, ValueError):
            continue  # skip malformed entries rather than failing the batch
    return results
