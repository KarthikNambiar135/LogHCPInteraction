from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    groq_api_key: str | None = None
    groq_model: str = "gemma2-9b-it"
    groq_fallback_model: str = "llama-3.3-70b-versatile"

    database_url: str = "postgresql+psycopg://logai:logai@localhost:5432/logai"
    frontend_origin: str = "http://localhost:5173"


settings = Settings()
