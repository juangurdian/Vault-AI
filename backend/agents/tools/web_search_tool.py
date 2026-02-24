"""Web search tool -- wraps the existing SearchService as a BaseTool."""

from __future__ import annotations

import logging
from typing import Any, Dict

from .base_tool import BaseTool, ToolResult
from .search_service import SearchService
from ...config import get_settings

logger = logging.getLogger(__name__)


class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Search the web for current, real-time information using Brave, DuckDuckGo, Perplexity, or SearXNG."
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "The search query"},
            "num_results": {"type": "integer", "default": 5, "description": "Number of results to return"},
        },
        "required": ["query"],
    }
    when_to_use = (
        "When the user asks about current events, news, prices, weather, "
        "live scores, recent releases, or anything that requires up-to-date "
        "information you do not already know."
    )
    when_not_to_use = (
        "For general knowledge questions you can answer from training data, "
        "or when the user asks about their own uploaded documents (use rag_query instead)."
    )
    examples = [
        '<tool_call>{"name": "web_search", "args": {"query": "latest SpaceX launch 2026"}}</tool_call>',
        '<tool_call>{"name": "web_search", "args": {"query": "Bitcoin price today", "num_results": 3}}</tool_call>',
    ]

    def __init__(self):
        settings = get_settings()
        self._service = SearchService(
            brave_api_key=settings.brave_api_key or None,
            perplexity_api_key=settings.perplexity_api_key or None,
            searxng_url=settings.searxng_base_url,
            provider_order=settings.search_provider_order,
        )

    async def execute(self, **kwargs) -> ToolResult:
        query = kwargs.get("query", "")
        num_results = int(kwargs.get("num_results", 5))

        if not query:
            return ToolResult(success=False, result_text="No query provided")

        results = await self._service.search(query=query, num_results=num_results)

        if not results:
            return ToolResult(
                success=True,
                result_text="No web results found for this query.",
                data={"results": []},
            )

        lines = [f"Web search results for: {query}\n"]
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] {r.title}")
            if r.url:
                lines.append(f"    Source: {r.url}")
            lines.append(f"    {r.snippet}")
            lines.append("")

        lines.append("Cite sources using [1], [2], etc. when referencing specific information.")

        return ToolResult(
            success=True,
            result_text="\n".join(lines),
            data={"results": self._service.to_dict_list(results)},
        )
