from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""

    gemini_api_key: str = ""
    # gemini-3.5-flash answers in ~2s with minimal thinking; 3.8-flash took ~50s in testing (2026-11-07).
    gemini_model: str = "gemini-3.5-flash"
    gemini_fallback_model: str = "gemini-3.5-flash-lite"  # used when the main model is overloaded
    gemini_embed_model: str = "gemini-embedding-001"

    swarms_api_key: str = ""
    swarms_model: str = "gpt-4o-mini"

    auth0_domain: str = ""
    auth0_audience: str = ""

    cors_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
