from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import logging

from ..rag.vector_store import VectorStore
from ..rag.deep_research import DeepResearchPipeline
from ..config import get_settings

router = APIRouter(prefix="/rag", tags=["rag"])
logger = logging.getLogger(__name__)


def get_vector_store() -> VectorStore:
    """Get vector store instance."""
    settings = get_settings()
    return VectorStore(ollama_base_url=settings.ollama_base_url)


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class SearchResult(BaseModel):
    results: List[Dict[str, Any]]


class ResearchRequest(BaseModel):
    topic: str
    depth: int = 3
    include_local: bool = True


@router.post("/search", response_model=SearchResult)
async def rag_search(
    body: SearchRequest,
    vector_store: VectorStore = Depends(get_vector_store),
):
    """Search local vector store."""
    hits = await vector_store.search(body.query, top_k=body.top_k)
    return SearchResult(
        results=[
            {
                "text": hit.get("text", ""),
                "metadata": hit.get("metadata", {}),
                "score": hit.get("score", 0.0),
            }
            for hit in hits
        ]
    )


@router.post("/research")
async def deep_research(
    body: ResearchRequest,
    vector_store: VectorStore = Depends(get_vector_store),
):
    """Conduct deep research on a topic."""
    settings = get_settings()
    
    pipeline = DeepResearchPipeline(
        vector_store=vector_store,
        searxng_url=settings.searxng_base_url,
        planner_model="deepseek-r1:8b",
        synthesizer_model="qwen3:8b",
        ollama_base_url=settings.ollama_base_url,
    )

    try:
        report = await pipeline.research(
            topic=body.topic,
            depth=body.depth,
            include_local=body.include_local,
        )

        return {
            "topic": report.topic,
            "summary": report.summary,
            "key_findings": report.key_findings,
            "sources": report.sources,
        }
    except Exception as e:
        logger.error(f"Deep research error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/research/stream")
async def deep_research_stream(
    body: ResearchRequest,
    vector_store: VectorStore = Depends(get_vector_store),
):
    """Stream deep research process."""
    settings = get_settings()
    
    pipeline = DeepResearchPipeline(
        vector_store=vector_store,
        searxng_url=settings.searxng_base_url,
        planner_model="deepseek-r1:8b",
        synthesizer_model="qwen3:8b",
        ollama_base_url=settings.ollama_base_url,
    )

    def _format_event(event_type: str, payload: Any) -> str:
        """Format SSE event."""
        data = {"type": event_type}
        if isinstance(payload, dict):
            data.update(payload)
        else:
            data["payload"] = payload
        return f"data: {json.dumps(data)}\n\n"

    async def event_generator():
        try:
            async for event in pipeline.stream_research(
                topic=body.topic,
                depth=body.depth,
                include_local=body.include_local,
            ):
                event_type = event.get("event_type", "unknown")
                data = event.get("data", {})
                yield _format_event(event_type, data)

        except Exception as e:
            logger.error(f"Stream research error: {e}", exc_info=True)
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

