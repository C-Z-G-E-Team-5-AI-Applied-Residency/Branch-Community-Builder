from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.routers import auth, users, profiles, events, rsvps, neighborhoods, tags

app = FastAPI(title="BRANCH API", version="0.1.0")

app.add_middleware(SessionMiddleware, secret_key=settings.session_secret)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(profiles.router)
app.include_router(events.router)
app.include_router(rsvps.router)
app.include_router(neighborhoods.router)
app.include_router(tags.router)


@app.get("/health")
def health():
    return {"status": "ok"}
