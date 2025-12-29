"""Shared dependencies for the FastAPI app."""

from functools import lru_cache
from .router.router import ModelRouter
from .config import get_settings


@lru_cache()
def get_model_router() -> ModelRouter:
    """Singleton ModelRouter instance."""
    settings = get_settings()
    return ModelRouter(ollama_base_url=settings.ollama_base_url)

