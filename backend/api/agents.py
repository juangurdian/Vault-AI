from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import logging

from ..deps import get_model_router
from ..router.router import ModelRouter
from ..agents import AgentManager, AgentContext
from ..rag.vector_store import VectorStore
from ..config import get_settings

router = APIRouter(prefix="/agents", tags=["agents"])
logger = logging.getLogger(__name__)


class AgentRequest(BaseModel):
    query: str
    context: Optional[str] = None
    web: Optional[bool] = False
    code: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = []


class AgentResponse(BaseModel):
    success: bool
    result: Optional[str] = None
    model_used: Optional[str] = None
    routing_info: Optional[Dict[str, Any]] = None


def get_vector_store() -> VectorStore:
    """Get vector store instance."""
    settings = get_settings()
    return VectorStore(ollama_base_url=settings.ollama_base_url)


def get_agent_manager(
    model_router: ModelRouter = Depends(get_model_router),
    vector_store: VectorStore = Depends(get_vector_store),
) -> AgentManager:
    return AgentManager(model_router, vector_store=vector_store)


def _format_event(event_type: str, payload: Any) -> str:
    """Format SSE event."""
    data = {"type": event_type}
    if isinstance(payload, dict):
        data.update(payload)
    else:
        data["payload"] = payload
    return f"data: {json.dumps(data)}\n\n"


@router.post("/research", response_model=AgentResponse)
async def research_agent(
    body: AgentRequest,
    manager: AgentManager = Depends(get_agent_manager),
):
    """Research agent endpoint (non-streaming)."""
    ctx = AgentContext(
        query=body.query,
        context=body.context,
        web=body.web,
        history=body.history if body.history is not None else [],
    )
    result = await manager.run("research", ctx)
    return AgentResponse(
        success=result.success,
        result=result.result,
        model_used=result.model_used,
        routing_info=result.routing_info,
    )


@router.post("/research/stream")
async def research_agent_stream(
    body: AgentRequest,
    manager: AgentManager = Depends(get_agent_manager),
):
    """Research agent endpoint with streaming support."""
    ctx = AgentContext(
        query=body.query,
        context=body.context,
        web=body.web,
        history=body.history if body.history is not None else [],
    )

    async def event_generator():
        try:
            # Get research agent
            if "research" not in manager.registry:
                yield _format_event("error", {"error": "Research agent not available"})
                return
            
            research_agent = manager.registry["research"]

            # Stream research process
            async for event in research_agent.stream_run(ctx):
                event_type = event.get("event_type", "unknown")
                data = event.get("data", {})

                if event_type == "question":
                    # Clarification question
                    yield _format_event("question", data)
                elif event_type == "progress":
                    # Progress update
                    yield _format_event("progress", data)
                elif event_type == "finding":
                    # Intermediate finding
                    yield _format_event("finding", data)
                elif event_type == "report":
                    # Report chunk
                    yield _format_event("report", data)
                elif event_type == "sources":
                    # Sources list
                    yield _format_event("sources", data)
                elif event_type == "done":
                    # Completion
                    yield _format_event("done", data)
                elif event_type == "error":
                    # Error
                    yield _format_event("error", data)

        except Exception as e:
            logger.error(f"Research stream error: {e}", exc_info=True)
            yield _format_event("error", {"error": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/code", response_model=AgentResponse)
async def coding_agent(
    body: AgentRequest,
    manager: AgentManager = Depends(get_agent_manager),
):
    """Coding agent endpoint."""
    ctx = AgentContext(query=body.query, context=body.context, code=body.code)
    result = await manager.run("code", ctx)
    return AgentResponse(
        success=result.success,
        result=result.result,
        model_used=result.model_used,
        routing_info=result.routing_info,
    )

