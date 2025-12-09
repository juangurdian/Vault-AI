"""
Chat API endpoints with intelligent routing and true streaming.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import json
import logging
import asyncio

from ..deps import get_model_router
from ..router.router import ModelRouter

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


class Message(BaseModel):
    role: str
    content: str
    images: Optional[List[str]] = None


class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "auto"
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = 2048
    context: Optional[str] = None
    images: Optional[List[str]] = None  # Top-level images for the current request


class ChatResponse(BaseModel):
    success: bool
    response: Optional[str] = None
    error: Optional[str] = None
    model_used: str
    execution_time_ms: int
    routing_info: Dict[str, Any]


def _format_event(event_type: str, payload: Any) -> str:
    """Format a server-sent event."""
    data = {"type": event_type}
    if isinstance(payload, str):
        data["text"] = payload
    else:
        data["payload"] = payload
    return f"data: {json.dumps(data)}\n\n"


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, model_router: ModelRouter = Depends(get_model_router)):
    """Chat endpoint with intelligent routing (non-streaming)."""
    start = time.perf_counter()

    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    last_user_msg = next((m for m in reversed(request.messages) if m.role == "user"), None)
    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found")

    try:
        routing_result = await model_router.route_query(
            query=last_user_msg.content,
            images=last_user_msg.images,
            context=request.context,
            force_model=request.model,
            conversation_history=[msg.model_dump() for msg in request.messages[:-1]],
        )
        logger.info(f"Routing: {routing_result.get('model')} via {routing_result.get('routing_method')}")

        execution_result = await model_router.execute_query(
            routing_result=routing_result,
            messages=[msg.model_dump() for msg in request.messages],
            temperature=request.temperature,
            top_p=request.top_p,
            max_tokens=request.max_tokens,
        )

        packing = execution_result.get("packing") or {}
        routing_result_with_packing = {**routing_result, "packing": packing}

        return ChatResponse(
            success=execution_result["success"],
            response=execution_result.get("response"),
            error=execution_result.get("error"),
            model_used=execution_result["model_used"],
            execution_time_ms=int((time.perf_counter() - start) * 1000),
            routing_info=routing_result_with_packing,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(request: ChatRequest, model_router: ModelRouter = Depends(get_model_router)):
    """Stream responses via server-sent events with true streaming."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    last_user_msg = next((m for m in reversed(request.messages) if m.role == "user"), None)
    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found")

    # Use top-level images if provided, otherwise use message-level images
    images = request.images or last_user_msg.images
    has_images = images is not None and len(images) > 0
    
    logger.info(f"Stream request: model={request.model}, has_images={has_images}")

    try:
        routing_result = await model_router.route_query(
            query=last_user_msg.content,
            images=images,
            context=request.context,
            force_model=request.model,
            conversation_history=[msg.model_dump() for msg in request.messages[:-1]],
        )
        logger.info(f"Stream routing: {routing_result.get('model')} via {routing_result.get('routing_method')}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get model metadata for routing info
    model_meta = model_router.model_configs.get(routing_result.get("model"), {})
    
    # Pre-compute packing stats - attach images to last message if provided
    messages_list = [msg.model_dump() for msg in request.messages]
    if images and len(messages_list) > 0:
        # Find last user message and attach images
        for i in range(len(messages_list) - 1, -1, -1):
            if messages_list[i].get("role") == "user":
                messages_list[i]["images"] = images
                break
    
    _, packing_stats = model_router._pack_messages(messages_list, routing_result["model"])

    async def event_generator():
        start_time = time.perf_counter()
        
        # Emit routing information first
        yield _format_event("routing", {
            **routing_result,
            "packing": packing_stats,
            "model_meta": {
                "context_window": model_meta.get("context_window"),
                "estimated_vram_gb": model_meta.get("estimated_vram_gb"),
                "estimated_tokens_per_sec": model_meta.get("estimated_tokens_per_sec"),
            },
        })

        # True streaming from the model
        error_message = None
        tokens_generated = 0
        
        try:
            async for chunk in model_router.execute_query_stream(
                routing_result=routing_result,
                messages=messages_list,
                temperature=request.temperature,
                top_p=request.top_p,
                max_tokens=request.max_tokens,
            ):
                tokens_generated += len(chunk) // 4  # Rough estimate
                yield _format_event("delta", chunk)
                
        except Exception as e:
            error_message = str(e)
            logger.error(f"Stream error: {e}")
            yield _format_event("delta", f"\n⚠️ Error: {error_message}")

        # Emit completion metadata
        execution_time_ms = int((time.perf_counter() - start_time) * 1000)
        yield _format_event("done", {
            "success": error_message is None,
            "model_used": routing_result.get("model"),
            "error": error_message,
            "execution_time_ms": execution_time_ms,
            "tokens_generated": tokens_generated,
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
