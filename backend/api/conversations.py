"""Conversation persistence API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from ..storage.conversations import ConversationStore

router = APIRouter(prefix="/conversations", tags=["conversations"])
logger = logging.getLogger(__name__)

_store = ConversationStore()


class ConversationCreate(BaseModel):
    id: str
    title: str = "New chat"
    created_at: int


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    updated_at: Optional[int] = None


class MessageCreate(BaseModel):
    id: str
    role: str
    content: str
    created_at: int
    thinking: Optional[str] = None
    image_url: Optional[str] = None


@router.get("")
async def list_conversations(limit: int = 50, offset: int = 0):
    conversations = await _store.list_conversations(limit=limit, offset=offset)
    return {"conversations": conversations}


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str):
    conv = await _store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.post("")
async def create_conversation(body: ConversationCreate):
    return await _store.create_conversation(body.id, body.title, body.created_at)


@router.put("/{conversation_id}")
async def update_conversation(conversation_id: str, body: ConversationUpdate):
    ok = await _store.update_conversation(conversation_id, title=body.title, updated_at=body.updated_at)
    if not ok:
        raise HTTPException(status_code=404, detail="Nothing to update")
    return {"success": True}


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str):
    ok = await _store.delete_conversation(conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@router.post("/{conversation_id}/messages")
async def add_message(conversation_id: str, body: MessageCreate):
    return await _store.add_message(
        msg_id=body.id,
        conversation_id=conversation_id,
        role=body.role,
        content=body.content,
        created_at=body.created_at,
        thinking=body.thinking,
        image_url=body.image_url,
    )
