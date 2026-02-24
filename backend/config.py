from functools import lru_cache
from typing import List, Optional
from pathlib import Path
import json
import logging

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_SETTINGS_FILE = Path("data/settings.json")


class Settings(BaseSettings):
    """Centralized application settings."""

    app_name: str = Field("BeastAI", description="Display name")
    api_prefix: str = Field("/api", description="Base API prefix")
    host: str = Field("0.0.0.0", description="Host interface")
    port: int = Field(8001, description="Port to serve API")
    allowed_origins: List[str] = Field(default_factory=lambda: ["*"])
    ollama_base_url: str = Field("http://localhost:11434", description="Ollama endpoint")
    searxng_base_url: str = Field("http://searxng:8080", description="SearXNG endpoint")
    brave_api_key: str = Field("", description="Brave Search API key for web search")
    perplexity_api_key: str = Field("", description="Perplexity API key for search/research")
    comfyui_base_url: str = Field("http://localhost:8188", description="ComfyUI endpoint")
    default_model: str = Field("auto", description="Default model (auto for smart routing)")
    search_provider_order: List[str] = Field(
        default_factory=lambda: ["brave", "perplexity", "duckduckgo", "searxng"],
        description="Preferred search provider order",
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    _load_persisted(settings)
    return settings


def _load_persisted(settings: Settings) -> None:
    """Load user-modified settings from the JSON file on top of env defaults."""
    if _SETTINGS_FILE.exists():
        try:
            overrides = json.loads(_SETTINGS_FILE.read_text())
            for key, value in overrides.items():
                if hasattr(settings, key):
                    object.__setattr__(settings, key, value)
        except Exception as e:
            logger.warning(f"Failed to load persisted settings: {e}")


def save_settings(updates: dict) -> Settings:
    """Persist user-changeable settings to disk and refresh the cached instance."""
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing = {}
    if _SETTINGS_FILE.exists():
        try:
            existing = json.loads(_SETTINGS_FILE.read_text())
        except Exception:
            pass

    MUTABLE_KEYS = {
        "brave_api_key", "perplexity_api_key", "searxng_base_url",
        "ollama_base_url", "comfyui_base_url", "default_model",
        "search_provider_order",
    }
    for key, value in updates.items():
        if key in MUTABLE_KEYS:
            existing[key] = value

    _SETTINGS_FILE.write_text(json.dumps(existing, indent=2))

    # Reset the lru_cache so next call returns fresh settings
    get_settings.cache_clear()
    return get_settings()

