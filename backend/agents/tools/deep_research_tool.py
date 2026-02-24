"""Deep research tool -- wraps the DeepResearchPipeline as a BaseTool."""

from __future__ import annotations

import logging
from typing import Any, Dict

from .base_tool import BaseTool, ToolResult

logger = logging.getLogger(__name__)


class DeepResearchTool(BaseTool):
    name = "deep_research"
    description = (
        "Conduct multi-step deep research on a topic. "
        "Searches multiple sources, synthesises findings, and produces a structured report."
    )
    parameters = {
        "type": "object",
        "properties": {
            "topic": {"type": "string", "description": "The research topic or question"},
            "depth": {
                "type": "integer",
                "default": 3,
                "description": "Research depth (1=quick, 3=thorough, 5=exhaustive)",
            },
        },
        "required": ["topic"],
    }
    when_to_use = (
        "When the user explicitly asks for in-depth research, a comprehensive analysis, "
        "or a detailed report on a topic. Do NOT use for simple factual questions -- use web_search instead."
    )
    when_not_to_use = (
        "For simple factual questions (use web_search). "
        "For quick lookups or single-source answers. "
        "This tool is slow and should only be used for thorough research requests."
    )
    examples = [
        '<tool_call>{"name": "deep_research", "args": {"topic": "Impact of AI on healthcare in 2026", "depth": 3}}</tool_call>',
    ]

    async def execute(self, **kwargs) -> ToolResult:
        topic = kwargs.get("topic", "")
        depth = int(kwargs.get("depth", 3))

        if not topic:
            return ToolResult(success=False, result_text="No research topic provided")

        try:
            from ...config import get_settings
            from ...deps import get_model_router, get_vector_store
            from ...rag.deep_research import DeepResearchPipeline
            from ..tools.search_service import SearchService
            from ...router.model_profiles import ModelType

            settings = get_settings()
            router = get_model_router()
            vector_store = get_vector_store()

            reasoning_model = router.registry.get_best_model_for_type(ModelType.REASONING) or "deepseek-r1:8b"
            synthesis_model = router.registry.get_best_model_for_type(ModelType.GENERAL) or "qwen3:8b"

            search_service = SearchService(
                brave_api_key=settings.brave_api_key or None,
                perplexity_api_key=settings.perplexity_api_key or None,
                searxng_url=settings.searxng_base_url,
                provider_order=settings.search_provider_order,
            )

            pipeline = DeepResearchPipeline(
                vector_store=vector_store,
                search_service=search_service,
                planner_model=reasoning_model,
                synthesizer_model=synthesis_model,
                ollama_base_url=settings.ollama_base_url,
            )

            report = await pipeline.research(topic=topic, depth=depth, include_local=True)

            sections = []
            if report.summary:
                sections.append(f"## Summary\n{report.summary}")
            if report.key_findings:
                sections.append("## Key Findings")
                sections.extend(f"- {f}" for f in report.key_findings)
            if report.sources:
                sections.append("## Sources")
                sections.extend(f"- [{s}]({s})" for s in report.sources)

            result_text = "\n\n".join(sections) if sections else "Research completed but produced no output."

            return ToolResult(
                success=True,
                result_text=result_text,
                data={
                    "sources": report.sources if hasattr(report, "sources") else [],
                    "key_findings": report.key_findings if hasattr(report, "key_findings") else [],
                },
            )

        except Exception as exc:
            logger.error("Deep research error: %s", exc, exc_info=True)
            return ToolResult(success=False, result_text=f"Deep research error: {exc}")
