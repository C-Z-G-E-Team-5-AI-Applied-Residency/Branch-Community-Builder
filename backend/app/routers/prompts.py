from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import require_user
from app.database import get_db
from app.models.prompt import PromptResponse, WeeklyPrompt
from app.models.user import User
from app.schemas.prompt import PromptResponseCreate, PromptResponseUpdate
from app.services import prompts as prompts_service

router = APIRouter(prefix="/api/prompts", tags=["prompts"])
responses_router = APIRouter(prefix="/api/prompt-responses", tags=["prompts"])


def _serialize_prompt(prompt: WeeklyPrompt, my_response: PromptResponse | None) -> dict:
    return {
        "prompt_id": prompt.prompt_id,
        "question_text": prompt.question_text,
        "week_start": prompt.week_start,
        "has_responded": my_response is not None,
        # Lets a client PATCH its own response after a reload — GET .../responses
        # deliberately doesn't carry response_id (see list_prompt_responses).
        "my_response_id": my_response.response_id if my_response is not None else None,
    }


def _serialize_past_prompt(prompt: WeeklyPrompt) -> dict:
    return {
        "prompt_id": prompt.prompt_id,
        "question_text": prompt.question_text,
        "week_start": prompt.week_start,
    }


def _serialize_response(response: PromptResponse) -> dict:
    return {
        "response_id": response.response_id,
        "prompt_id": response.prompt_id,
        "user_id": response.user_id,
        "response_text": response.response_text,
        "created_at": response.created_at,
        "updated_at": response.updated_at,
    }


def _my_response(db: Session, user_id: int, prompt_id: int) -> PromptResponse | None:
    return db.execute(
        select(PromptResponse).where(
            PromptResponse.user_id == user_id, PromptResponse.prompt_id == prompt_id
        )
    ).scalar_one_or_none()


def _list_responses(db: Session, prompt_id: int) -> list[dict]:
    rows = db.execute(
        select(User.username, PromptResponse.response_text, PromptResponse.updated_at)
        .join(User, User.user_id == PromptResponse.user_id)
        .where(PromptResponse.prompt_id == prompt_id)
        .order_by(PromptResponse.created_at.desc())
    ).all()
    return [
        {"username": username, "response_text": response_text, "updated_at": updated_at}
        for username, response_text, updated_at in rows
    ]


@router.get("/current")
def get_current_prompt(request: Request, db: Session = Depends(get_db)):
    """This week's prompt, generating one via Gemini if needed. 200 / 401."""
    user_id = require_user(request)
    prompt = prompts_service.get_or_create_current_prompt(db)
    db.commit()
    db.refresh(prompt)
    return _serialize_prompt(prompt, _my_response(db, user_id, prompt.prompt_id))


@router.get("/current/responses")
def get_current_prompt_responses(request: Request, db: Session = Depends(get_db)):
    """Alias of /{prompt_id}/responses for this week's prompt, so the POST
    endpoint below has a matching GET instead of 422ing on "current" as an
    int. 200 / 401 / 403."""
    user_id = require_user(request)
    prompt = prompts_service.get_or_create_current_prompt(db)
    db.commit()
    db.refresh(prompt)
    if _my_response(db, user_id, prompt.prompt_id) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Answer this prompt to see others' responses")
    return _list_responses(db, prompt.prompt_id)


@router.get("")
def list_prompts(request: Request, db: Session = Depends(get_db)):
    """Past prompts, newest-first. Current week excluded. 200 / 401."""
    require_user(request)
    prompts = prompts_service.list_past_prompts(db)
    return [_serialize_past_prompt(p) for p in prompts]


@router.post("/current/responses", status_code=201)
def create_current_prompt_response(
    body: PromptResponseCreate, request: Request, db: Session = Depends(get_db)
):
    """Answer this week's prompt. 201 / 401 / 409 (already answered, use PATCH)."""
    user_id = require_user(request)
    prompt = prompts_service.get_or_create_current_prompt(db)
    db.commit()
    db.refresh(prompt)

    if _my_response(db, user_id, prompt.prompt_id) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already responded to this prompt, use PATCH to edit")

    response = PromptResponse(prompt_id=prompt.prompt_id, user_id=user_id, response_text=body.response_text)
    db.add(response)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Already responded to this prompt, use PATCH to edit")
    db.refresh(response)
    return _serialize_response(response)


@router.get("/{prompt_id}")
def get_prompt(prompt_id: int, request: Request, db: Session = Depends(get_db)):
    """Single prompt lookup, for tapping a past prompt from the list. 200 / 401 / 404."""
    user_id = require_user(request)
    prompt = db.get(WeeklyPrompt, prompt_id)
    if prompt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prompt not found")
    return _serialize_prompt(prompt, _my_response(db, user_id, prompt_id))


@router.get("/{prompt_id}/responses")
def list_prompt_responses(prompt_id: int, request: Request, db: Session = Depends(get_db)):
    """Other users' answers to a prompt, gated on having answered it yourself. 200 / 401 / 403 / 404."""
    user_id = require_user(request)
    prompt = db.get(WeeklyPrompt, prompt_id)
    if prompt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prompt not found")
    if _my_response(db, user_id, prompt_id) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Answer this prompt to see others' responses")
    return _list_responses(db, prompt_id)


@responses_router.patch("/{response_id}")
def update_prompt_response(
    response_id: int, body: PromptResponseUpdate, request: Request, db: Session = Depends(get_db)
):
    """Edit your own response (author only). 200 / 401 / 403 / 404."""
    user_id = require_user(request)
    response = db.get(PromptResponse, response_id)
    if response is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Response not found")
    if response.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your response")

    response.response_text = body.response_text
    db.commit()
    db.refresh(response)
    return _serialize_response(response)
