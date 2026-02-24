from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import logging
import io
import uuid

from ..rag.vector_store import VectorStore
from ..rag.deep_research import DeepResearchPipeline
from ..agents.tools.search_service import SearchService
from ..deps import get_vector_store, get_model_router
from ..config import get_settings

router = APIRouter(prefix="/rag", tags=["rag"])
logger = logging.getLogger(__name__)


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class SearchResult(BaseModel):
    results: List[Dict[str, Any]]


class ResearchRequest(BaseModel):
    topic: str
    depth: int = 3
    include_local: bool = True


def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    """Split text into overlapping chunks."""
    if not text.strip():
        return []
    words = text.split()
    chunks: List[str] = []
    i = 0
    while i < len(words):
        chunk_words = words[i : i + chunk_size]
        chunks.append(" ".join(chunk_words))
        if i + chunk_size >= len(words):
            break
        i += chunk_size - overlap
    return [c for c in chunks if c.strip()]


class IngestTextRequest(BaseModel):
    text: str
    source: str = "api-text"
    collection: str = "knowledge_base"


class IngestResponse(BaseModel):
    chunks_added: int
    collection_name: str
    source: str


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    source: str = Form("uploaded-document"),
    collection: str = Form("knowledge_base"),
    vector_store: VectorStore = Depends(get_vector_store),
):
    """Ingest a document (PDF, TXT, MD) or raw text into the RAG vector store.

    Accepts either:
    - A multipart file upload (PDF, TXT, MD)
    - A `text` form field with raw text content
    """
    raw_text = ""

    if file is not None:
        content_type = file.content_type or ""
        filename = file.filename or "upload"
        raw_bytes = await file.read()

        if filename.lower().endswith(".pdf") or content_type == "application/pdf":
            # Try pypdf / PyPDF2
            try:
                import pypdf  # type: ignore

                reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
                raw_text = "\n\n".join(
                    page.extract_text() or "" for page in reader.pages
                )
            except ImportError:
                try:
                    import PyPDF2  # type: ignore

                    reader = PyPDF2.PdfReader(io.BytesIO(raw_bytes))
                    raw_text = "\n\n".join(
                        (page.extract_text() or "") for page in reader.pages
                    )
                except ImportError:
                    raise HTTPException(
                        status_code=422,
                        detail="PDF parsing requires 'pypdf' or 'PyPDF2'. Install with: pip install pypdf",
                    )
        elif filename.lower().endswith((".txt", ".md")) or content_type.startswith("text/"):
            raw_text = raw_bytes.decode("utf-8", errors="replace")
        else:
            # Attempt to decode as UTF-8 text anyway
            try:
                raw_text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=422,
                    detail=f"Unsupported file type: {content_type or filename}",
                )
        source = filename

    elif text:
        raw_text = text
    else:
        raise HTTPException(
            status_code=422,
            detail="Provide either a file upload or a 'text' form field.",
        )

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Document appears to be empty.")

    chunks = _chunk_text(raw_text)
    if not chunks:
        raise HTTPException(status_code=422, detail="Could not extract any text chunks.")

    metadatas = [{"source": source, "chunk_index": i} for i in range(len(chunks))]
    ids = [str(uuid.uuid4()) for _ in chunks]

    try:
        added = await vector_store.add_documents(
            documents=chunks,
            metadatas=metadatas,
            ids=ids,
        )
    except Exception as e:
        logger.error(f"Ingest error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to ingest document: {e}")

    return IngestResponse(
        chunks_added=added,
        collection_name=collection,
        source=source,
    )


@router.post("/ingest/json")
async def ingest_text_json(
    body: IngestTextRequest,
    vector_store: VectorStore = Depends(get_vector_store),
):
    """Ingest raw text from a JSON body."""
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Text field is empty.")

    chunks = _chunk_text(body.text)
    if not chunks:
        raise HTTPException(status_code=422, detail="Could not chunk the provided text.")

    metadatas = [{"source": body.source, "chunk_index": i} for i in range(len(chunks))]
    ids = [str(uuid.uuid4()) for _ in chunks]

    try:
        added = await vector_store.add_documents(
            documents=chunks,
            metadatas=metadatas,
            ids=ids,
        )
    except Exception as e:
        logger.error(f"Ingest (JSON) error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    return IngestResponse(
        chunks_added=added,
        collection_name=body.collection,
        source=body.source,
    )


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


@router.get("/documents")
async def list_documents(
    limit: int = 100,
    offset: int = 0,
    vector_store: VectorStore = Depends(get_vector_store),
):
    """List documents in the vector store with metadata."""
    try:
        collection = vector_store.collection
        result = collection.get(
            limit=limit,
            offset=offset,
            include=["metadatas", "documents"],
        )
        documents = []
        ids = result.get("ids", [])
        metadatas = result.get("metadatas", [])
        docs = result.get("documents", [])
        for i, doc_id in enumerate(ids):
            documents.append({
                "id": doc_id,
                "metadata": metadatas[i] if i < len(metadatas) else {},
                "preview": (docs[i][:200] + "...") if i < len(docs) and docs[i] and len(docs[i]) > 200 else (docs[i] if i < len(docs) else ""),
            })
        return {"documents": documents, "total": collection.count()}
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    vector_store: VectorStore = Depends(get_vector_store),
):
    """Delete a document from the vector store."""
    try:
        vector_store.collection.delete(ids=[doc_id])
        return {"success": True, "deleted_id": doc_id}
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def rag_stats(vector_store: VectorStore = Depends(get_vector_store)):
    """Get vector store statistics."""
    try:
        count = vector_store.get_count()
        return {
            "document_count": count,
            "embedding_model": vector_store.embedding_model,
            "persist_directory": str(vector_store.persist_directory),
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/research")
async def deep_research(
    body: ResearchRequest,
    vector_store: VectorStore = Depends(get_vector_store),
):
    """Conduct deep research on a topic."""
    settings = get_settings()
    router = get_model_router()
    from ..router.model_profiles import ModelType
    planner = router.registry.get_best_model_for_type(ModelType.REASONING) or "deepseek-r1:8b"
    synthesizer = router.registry.get_best_model_for_type(ModelType.GENERAL) or "qwen3:8b"

    search_service = SearchService(
        brave_api_key=settings.brave_api_key if settings.brave_api_key else None,
        perplexity_api_key=settings.perplexity_api_key if settings.perplexity_api_key else None,
        searxng_url=settings.searxng_base_url,
        provider_order=settings.search_provider_order,
    )
    pipeline = DeepResearchPipeline(
        vector_store=vector_store,
        search_service=search_service,
        planner_model=planner,
        synthesizer_model=synthesizer,
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
    router = get_model_router()
    from ..router.model_profiles import ModelType
    planner = router.registry.get_best_model_for_type(ModelType.REASONING) or "deepseek-r1:8b"
    synthesizer = router.registry.get_best_model_for_type(ModelType.GENERAL) or "qwen3:8b"

    search_service = SearchService(
        brave_api_key=settings.brave_api_key if settings.brave_api_key else None,
        perplexity_api_key=settings.perplexity_api_key if settings.perplexity_api_key else None,
        searxng_url=settings.searxng_base_url,
        provider_order=settings.search_provider_order,
    )
    pipeline = DeepResearchPipeline(
        vector_store=vector_store,
        search_service=search_service,
        planner_model=planner,
        synthesizer_model=synthesizer,
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

