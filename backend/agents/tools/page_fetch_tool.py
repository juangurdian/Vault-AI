"""Page fetch tool -- reads and extracts text content from a URL."""

from __future__ import annotations

import logging
from typing import Any, Dict

from .base_tool import BaseTool, ToolResult
from .page_fetch import FetchPageTool as _FetchPageImpl

logger = logging.getLogger(__name__)


class PageFetchTool(BaseTool):
    name = "fetch_page"
    description = "Fetch and extract the text content from a web page URL."
    parameters = {
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "The URL of the page to fetch"},
        },
        "required": ["url"],
    }
    when_to_use = (
        "When you need to read the full content of a specific web page, "
        "for example after finding a relevant URL from a web search."
    )
    when_not_to_use = (
        "Do not use this to search the web (use web_search first). "
        "Only use this when you already have a specific URL to read."
    )
    examples = [
        '<tool_call>{"name": "fetch_page", "args": {"url": "https://example.com/article"}}</tool_call>',
    ]

    def __init__(self):
        self._fetcher = _FetchPageImpl(max_content_length=8000)

    async def execute(self, **kwargs) -> ToolResult:
        url = kwargs.get("url", "")
        if not url:
            return ToolResult(success=False, result_text="No URL provided")

        text = await self._fetcher.fetch(url)

        if not text:
            return ToolResult(
                success=False,
                result_text=f"Could not fetch or extract content from {url}",
            )

        return ToolResult(
            success=True,
            result_text=f"Content from {url}:\n\n{text}",
            data={"url": url, "length": len(text)},
        )
