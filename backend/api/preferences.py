"""User preferences API endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Dict, Optional

from ..storage.preferences import UserPreferencesStore

router = APIRouter(prefix="/preferences", tags=["preferences"])

_store = UserPreferencesStore()


class PreferencesUpdate(BaseModel):
    preferences: Dict[str, Any]


class PreferencesSingle(BaseModel):
    key: str
    value: Any


@router.get("")
async def get_preferences():
    """Get all user preferences."""
    prefs = await _store.get_all()
    return {"success": True, "preferences": prefs}


@router.put("")
async def update_preferences(body: PreferencesUpdate):
    """Update multiple preferences at once."""
    await _store.set_many(body.preferences)
    prefs = await _store.get_all()
    return {"success": True, "preferences": prefs}


@router.put("/single")
async def update_single_preference(body: PreferencesSingle):
    """Update a single preference."""
    await _store.set(body.key, body.value)
    return {"success": True, "key": body.key, "value": body.value}


@router.post("/reset")
async def reset_preferences():
    """Reset all preferences to defaults."""
    await _store.reset()
    prefs = await _store.get_all()
    return {"success": True, "preferences": prefs}
