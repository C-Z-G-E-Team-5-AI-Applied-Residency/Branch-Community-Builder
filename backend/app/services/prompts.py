"""Weekly community prompt (Gemini icebreaker questions).

get_or_create_current_prompt() guarantees every user sees the identical
question for the week: look up by week_start first, and only ask Gemini to
generate a new one if this week doesn't have a row yet.
"""
import logging
from datetime import date, timedelta

from google import genai
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.prompt import WeeklyPrompt

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"

# The .env.example placeholder — treat it the same as "no key configured".
_PLACEHOLDER_KEY = "your-gemini-api-key"

PROMPT_TEMPLATE = """Write one lighthearted, inclusive icebreaker question for a
local community app. It should be easy for any adult to answer in a sentence
or two, regardless of background or interests.

Return ONLY the question text. No preamble, no quotes, no markdown.
"""

# Used when no Gemini API key is configured, or the call fails.
_FALLBACK_QUESTIONS = [
    "What's one thing you're looking forward to this week?",
    "What's a small thing that made you smile recently?",
    "If you could instantly master one hobby, what would it be?",
    "What's your go-to comfort food?",
    "What's a place near you that more people should know about?",
]


def _get_client() -> genai.Client | None:
    """Build the client at call time so a key set after startup takes effect."""
    key = settings.gemini_api_key
    if not key or key == _PLACEHOLDER_KEY:
        return None
    return genai.Client(api_key=key)


def current_week_start() -> date:
    """Monday 00:00, server time."""
    today = date.today()
    return today - timedelta(days=today.weekday())


def _generate_question(week_start: date) -> str:
    client = _get_client()
    if client is not None:
        try:
            resp = client.models.generate_content(model=MODEL, contents=PROMPT_TEMPLATE)
            text = resp.text.strip()
            if text:
                return text
        except Exception:
            logger.exception("Gemini weekly-prompt call failed")

    # Deterministic on week_start so re-generating (e.g. after the race guard
    # below) always lands on the same fallback for that week.
    return _FALLBACK_QUESTIONS[week_start.toordinal() % len(_FALLBACK_QUESTIONS)]


def get_or_create_current_prompt(db: Session) -> WeeklyPrompt:
    week_start = current_week_start()
    existing = db.execute(
        select(WeeklyPrompt).where(WeeklyPrompt.week_start == week_start)
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    try:
        # SAVEPOINT, not a full rollback: if the insert loses the race, only
        # this nested transaction unwinds — whatever the caller's endpoint
        # already did in the outer transaction is untouched.
        with db.begin_nested():
            prompt = WeeklyPrompt(question_text=_generate_question(week_start), week_start=week_start)
            db.add(prompt)
            db.flush()
    except IntegrityError:
        # A concurrent request beat us to it — re-SELECT instead of erroring.
        return db.execute(
            select(WeeklyPrompt).where(WeeklyPrompt.week_start == week_start)
        ).scalar_one()
    return prompt


def list_past_prompts(db: Session) -> list[WeeklyPrompt]:
    """All prompts before this week, newest-first."""
    return list(
        db.execute(
            select(WeeklyPrompt)
            .where(WeeklyPrompt.week_start < current_week_start())
            .order_by(WeeklyPrompt.week_start.desc())
        ).scalars()
    )
