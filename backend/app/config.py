from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://branch:branch@localhost:5432/branch"
    session_secret: str = "change-me"
    gemini_api_key: str = ""
    nominatim_user_agent: str = "branch-app/0.1"
    frontend_origin: str = "http://localhost:5173"
    # True in production, where the frontend and backend are on different
    # https origins and the session cookie must be SameSite=None; Secure.
    session_cookie_secure: bool = False


settings = Settings()
