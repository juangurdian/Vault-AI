from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application settings."""

    app_name: str = Field("Local AI Beast", description="Display name")
    api_prefix: str = Field("/api", description="Base API prefix")
    host: str = Field("0.0.0.0", description="Host interface")
    port: int = Field(8001, description="Port to serve API")
    allowed_origins: List[str] = Field(default_factory=lambda: ["*"])
    ollama_base_url: str = Field("http://localhost:11434", description="Ollama endpoint")
    searxng_base_url: str = Field("http://searxng:8080", description="SearXNG endpoint")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache()
def get_settings() -> Settings:
    return Settings()

