"""Shared dependencies for the FastAPI app."""

from functools import lru_cache
from .router.router import ModelRouter
from .rag.vector_store import VectorStore
from .agents.tools.registry import ToolRegistry
from .config import get_settings


@lru_cache()
def get_model_router() -> ModelRouter:
    """Singleton ModelRouter instance."""
    settings = get_settings()
    return ModelRouter(ollama_base_url=settings.ollama_base_url)


@lru_cache()
def get_vector_store() -> VectorStore:
    """Singleton VectorStore instance."""
    settings = get_settings()
    return VectorStore(ollama_base_url=settings.ollama_base_url)


@lru_cache()
def get_tool_registry() -> ToolRegistry:
    """Singleton ToolRegistry -- auto-discovers tools on first access."""
    registry = ToolRegistry()
    registry.auto_discover()
    return registry
