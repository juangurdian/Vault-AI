"""RAG package with vector store and deep research."""

from .vector_store import VectorStore
from .deep_research import DeepResearchPipeline, ResearchReport

try:
    from .ingestion import DocumentIngestion
    __all__ = ["VectorStore", "DocumentIngestion", "DeepResearchPipeline", "ResearchReport"]
except ImportError:
    __all__ = ["VectorStore", "DeepResearchPipeline", "ResearchReport"]

