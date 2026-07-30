"""Success metrics (admin only).

BRANCH's stated definition of success is "doors walked through" — people actually
showing up, not screen time. This endpoint measures whether the AI matchmaker moves
that number: of the events it recommended, how many did the user RSVP to and then
physically check in to, and does a recommended event convert to a check-in at a
higher rate than a non-recommended one.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import and_, exists, func, select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.database import get_db
from app.models.recommendation_log import RecommendationLog
from app.models.rsvp import Rsvp

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


def _rate(numerator: int, denominator: int) -> float | None:
    """Fraction rounded to 4 dp, or None when there's nothing to divide by."""
    return round(numerator / denominator, 4) if denominator else None


@router.get("/recommendation-conversion")
def recommendation_conversion(admin_id: int = Depends(require_admin), db: Session = Depends(get_db)):
    """Recommendation -> RSVP -> check-in funnel, plus recommended vs. non-recommended
    check-in rate. Admin only. 200 / 403."""
    # Distinct (user, event) pairs ever recommended — the funnel denominator.
    recommended = db.scalar(select(func.count()).select_from(RecommendationLog)) or 0

    going = Rsvp.status == "going"
    checked_in = Rsvp.checked_in_at.is_not(None)
    # Was this RSVP for an event that was recommended to this same user?
    was_recommended = exists().where(
        and_(
            RecommendationLog.user_id == Rsvp.user_id,
            RecommendationLog.event_id == Rsvp.event_id,
        )
    )

    # One pass over rsvps, split into recommended vs. not (FILTER aggregates).
    row = db.execute(
        select(
            func.count().filter(going).label("all_going"),
            func.count().filter(and_(going, checked_in)).label("all_checkin"),
            func.count().filter(and_(going, was_recommended)).label("rec_going"),
            func.count().filter(and_(going, checked_in, was_recommended)).label("rec_checkin"),
        )
    ).one()

    rec_going, rec_checkin = row.rec_going, row.rec_checkin
    other_going = row.all_going - rec_going
    other_checkin = row.all_checkin - rec_checkin

    return {
        # Funnel: of events recommended, how far did users get?
        "funnel": {
            "recommended": recommended,
            "rsvped": rec_going,
            "checked_in": rec_checkin,
            "rsvp_rate": _rate(rec_going, recommended),
            "checkin_rate": _rate(rec_checkin, recommended),  # doors walked through, per recommendation
        },
        # Does a recommended event convert to a check-in better than a non-recommended one?
        "comparison": {
            "recommended_rsvps": rec_going,
            "recommended_checkin_rate": _rate(rec_checkin, rec_going),
            "other_rsvps": other_going,
            "other_checkin_rate": _rate(other_checkin, other_going),
        },
    }
