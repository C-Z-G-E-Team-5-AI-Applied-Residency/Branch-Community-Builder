from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://branch:branch@localhost:5432/branch"
    session_secret: str = "change-me"
    gemini_api_key: str = ""
    frontend_origin: str = "http://localhost:5173"
    # True in production: marks the session cookie Secure (https-only).
    session_cookie_secure: bool = False


settings = Settings()
