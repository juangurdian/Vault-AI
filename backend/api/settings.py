"""Settings API -- read and update application configuration."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import logging

from ..config import get_settings, save_settings

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)


class SettingsResponse(BaseModel):
    ollama_base_url: str
    searxng_base_url: str
    comfyui_base_url: str
    brave_api_key_set: bool
    perplexity_api_key_set: bool
    default_model: str
    search_provider_order: List[str]


class SettingsUpdate(BaseModel):
    ollama_base_url: Optional[str] = None
    searxng_base_url: Optional[str] = None
    comfyui_base_url: Optional[str] = None
    brave_api_key: Optional[str] = None
    perplexity_api_key: Optional[str] = None
    default_model: Optional[str] = None
    search_provider_order: Optional[List[str]] = None


def _mask(key: str) -> bool:
    return bool(key and key.strip())


@router.get("", response_model=SettingsResponse)
async def get_current_settings():
    s = get_settings()
    return SettingsResponse(
        ollama_base_url=s.ollama_base_url,
        searxng_base_url=s.searxng_base_url,
        comfyui_base_url=s.comfyui_base_url,
        brave_api_key_set=_mask(s.brave_api_key),
        perplexity_api_key_set=_mask(s.perplexity_api_key),
        default_model=s.default_model,
        search_provider_order=s.search_provider_order,
    )


@router.put("", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate):
    updates = body.model_dump(exclude_none=True)
    logger.info(f"Updating settings: {list(updates.keys())}")
    s = save_settings(updates)
    return SettingsResponse(
        ollama_base_url=s.ollama_base_url,
        searxng_base_url=s.searxng_base_url,
        comfyui_base_url=s.comfyui_base_url,
        brave_api_key_set=_mask(s.brave_api_key),
        perplexity_api_key_set=_mask(s.perplexity_api_key),
        default_model=s.default_model,
        search_provider_order=s.search_provider_order,
    )
