"""RAG query tool -- searches the user's uploaded knowledge base."""

from __future__ import annotations

import logging
from typing import Any, Dict

from .base_tool import BaseTool, ToolResult

logger = logging.getLogger(__name__)


class RAGQueryTool(BaseTool):
    name = "rag_query"
    description = "Search the user's uploaded knowledge base (documents, PDFs, text files) for relevant information."
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "The search query"},
            "num_results": {"type": "integer", "default": 3, "description": "Number of document chunks to return"},
        },
        "required": ["query"],
    }
    when_to_use = (
        "When the user asks about their uploaded documents, files, or knowledge base, "
        "or when they reference information they previously uploaded."
    )
    when_not_to_use = (
        "For general web information or current events (use web_search instead). "
        "Also avoid if the user has not uploaded any documents."
    )
    examples = [
        '<tool_call>{"name": "rag_query", "args": {"query": "revenue figures from Q3 report"}}</tool_call>',
    ]

    async def execute(self, **kwargs) -> ToolResult:
        query = kwargs.get("query", "")
        num_results = int(kwargs.get("num_results", 3))

        if not query:
            return ToolResult(success=False, result_text="No query provided")

        try:
            from ...deps import get_vector_store
            vector_store = get_vector_store()
        except Exception as exc:
            return ToolResult(success=False, result_text=f"Knowledge base unavailable: {exc}")

        try:
            results = await vector_store.search(query=query, top_k=num_results)
        except Exception as exc:
            logger.error("RAG search error: %s", exc)
            return ToolResult(success=False, result_text=f"Search failed: {exc}")

        if not results:
            return ToolResult(
                success=True,
                result_text="No relevant documents found in the knowledge base.",
                data={"results": []},
            )

        lines = [f"Knowledge base results for: {query}\n"]
        for i, doc in enumerate(results, 1):
            text = doc.get("text", doc.get("content", ""))[:500]
            source = doc.get("metadata", {}).get("source", "unknown")
            lines.append(f"[{i}] Source: {source}")
            lines.append(f"    {text}")
            lines.append("")

        return ToolResult(
            success=True,
            result_text="\n".join(lines),
            data={"results": results},
        )
