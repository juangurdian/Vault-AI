"""Research agent with conversational clarification and deep research."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, AsyncGenerator, Callable
import logging
import json

from ..router.router import ModelRouter
from .base import AgentBase, AgentContext, AgentResult
from .tools.search_service import SearchService
from .tools.page_fetch import FetchPageTool
from ..rag.vector_store import VectorStore
from ..config import get_settings
import ollama

# Lazy import to break circular dependency
def _get_deep_research_pipeline():
    from ..rag.deep_research import DeepResearchPipeline
    return DeepResearchPipeline

logger = logging.getLogger(__name__)


class ResearchAgent(AgentBase):
    """Research agent that asks clarifying questions then conducts deep research."""

    name = "research"

    def __init__(self, router: ModelRouter, vector_store: Optional[VectorStore] = None):
        self.router = router
        self.client = router.client

        # Dynamic model selection from registry
        from ..router.model_profiles import ModelType
        self.reasoning_model = (
            router.registry.get_best_model_for_type(ModelType.REASONING)
            or "deepseek-r1:8b"
        )
        self.synthesis_model = (
            router.registry.get_best_model_for_type(ModelType.GENERAL)
            or "qwen3:8b"
        )

        settings = get_settings()
        self.search_service = SearchService(
            brave_api_key=settings.brave_api_key if settings.brave_api_key else None,
            perplexity_api_key=settings.perplexity_api_key if settings.perplexity_api_key else None,
            searxng_url=settings.searxng_base_url,
            provider_order=settings.search_provider_order,
        )
        self.page_fetch = FetchPageTool()

        if vector_store:
            self.vector_store = vector_store
        else:
            self.vector_store = VectorStore(ollama_base_url=settings.ollama_base_url)

        DeepResearchPipeline = _get_deep_research_pipeline()
        self.deep_research = DeepResearchPipeline(
            vector_store=self.vector_store,
            search_service=self.search_service,
            planner_model=self.reasoning_model,
            synthesizer_model=self.synthesis_model,
            ollama_base_url=settings.ollama_base_url,
        )

    async def run(
        self,
        ctx: AgentContext,
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> AgentResult:
        """
        Run research agent with conversational clarification.

        Args:
            ctx: Agent context with query and history
            progress_callback: Optional callback for progress updates (event_type, data)

        Returns:
            AgentResult with research findings
        """
        try:
            # Check if we're in clarification phase
            clarification_needed = await self._needs_clarification(ctx)

            if clarification_needed:
                # Ask clarifying questions
                questions = await self._generate_clarifying_questions(ctx)
                if progress_callback:
                    progress_callback("question", {"questions": questions})

                # Return questions for user to answer
                return AgentResult(
                    success=True,
                    result=f"I'd like to understand your research needs better. {questions}",
                    model_used=self.reasoning_model,
                    routing_info={"phase": "clarification", "questions": questions},
                )

            # Research phase - conduct deep research
            if progress_callback:
                progress_callback("progress", {"step": 1, "total": 6, "message": "Starting research..."})

            # Extract research topic from context
            research_topic = self._extract_research_topic(ctx)

            # Conduct deep research
            report = await self.deep_research.research(
                topic=research_topic,
                depth=3,
                include_local=True,
                progress_callback=progress_callback,
            )

            # Format final result
            result_text = self._format_research_report(report)

            return AgentResult(
                success=True,
                result=result_text,
                model_used=self.synthesis_model,
                routing_info={
                    "phase": "complete",
                    "sources": report.sources,
                    "key_findings": report.key_findings,
                },
            )

        except Exception as e:
            logger.error(f"Research agent error: {e}", exc_info=True)
            return AgentResult(
                success=False,
                result=f"Research error: {str(e)}",
                model_used=None,
                routing_info=None,
            )

    async def _needs_clarification(self, ctx: AgentContext) -> bool:
        """Determine if clarification is needed based on conversation history."""
        if not ctx.history:
            return True

        # Check if user has answered questions
        # Look for recent assistant messages asking questions
        recent_assistant = None
        for msg in reversed(ctx.history[-5:]):  # Check last 5 messages
            if msg.get("role") == "assistant":
                recent_assistant = msg.get("content", "")
                break

        # If assistant asked questions but no user response after, still need clarification
        if recent_assistant and ("?" in recent_assistant or "understand" in recent_assistant.lower()):
            # Check if user responded
            if len(ctx.history) >= 2:
                last_user = ctx.history[-1]
                if last_user.get("role") == "user":
                    return False  # User responded, proceed with research

        # If query is very short or vague, need clarification
        if len(ctx.query.split()) < 5:
            return True

        return False

    async def _generate_clarifying_questions(self, ctx: AgentContext) -> str:
        """Generate targeted clarifying questions."""
        import asyncio

        prompt = f"""You are a research assistant. The user wants to research: "{ctx.query}"

Generate 2-3 targeted questions to better understand their research needs. Focus on:
- The scope and depth they want
- Specific aspects to focus on
- Desired format or length of the report
- Any constraints or preferences

Return only the questions, formatted naturally as if you're asking the user directly."""

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.chat(
                    model=self.reasoning_model,
                    messages=[{"role": "user", "content": prompt}],
                )
            )
            questions = response.get("message", {}).get("content", "")
            return questions.strip()
        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            return "What specific aspects of this topic would you like me to focus on?"

    def _extract_research_topic(self, ctx: AgentContext) -> str:
        """Extract the research topic from conversation context."""
        # Use the original query, or combine with context if available
        topic = ctx.query

        # If there's history, try to extract the main topic
        if ctx.history:
            # Find the first user message (likely the research request)
            for msg in ctx.history:
                if msg.get("role") == "user":
                    topic = msg.get("content", topic)
                    break

        return topic

    def _format_research_report(self, report) -> str:
        """Format the research report for display."""
        sections = []

        # Executive Summary
        if report.summary:
            sections.append("## Executive Summary\n")
            sections.append(report.summary)
            sections.append("")

        # Key Findings
        if report.key_findings:
            sections.append("## Key Findings\n")
            for finding in report.key_findings:
                sections.append(f"- {finding}")
            sections.append("")

        # Sources
        if report.sources:
            sections.append("## Sources\n")
            for i, source in enumerate(report.sources, 1):
                sections.append(f"{i}. [{source}]({source})")
            sections.append("")

        return "\n".join(sections)

    async def stream_run(
        self, ctx: AgentContext
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream research process with progress updates.

        Yields:
            Dict with event_type and data
        """
        try:
            # Check if clarification needed
            clarification_needed = await self._needs_clarification(ctx)

            if clarification_needed:
                questions = await self._generate_clarifying_questions(ctx)
                logger.info(f"Research clarification needed, sending questions: {questions[:100]}...")
                yield {
                    "event_type": "question",
                    "data": {"questions": questions, "content": questions},
                }
                # Send done event to indicate clarification phase is complete
                yield {
                    "event_type": "done",
                    "data": {"success": True, "phase": "clarification", "waiting_for_response": True},
                }
                return

            # Research phase
            research_topic = self._extract_research_topic(ctx)

            # Stream deep research with progress callback
            def progress_callback(event_type: str, data: Dict[str, Any]):
                # This will be called by deep_research.research
                # But we're using stream_research which yields events directly
                pass

            # Use stream_research which yields events
            async for event in self.deep_research.stream_research(
                topic=research_topic, depth=3, include_local=True
            ):
                yield event

        except Exception as e:
            logger.error(f"Stream research error: {e}", exc_info=True)
            yield {
                "event_type": "error",
                "data": {"error": str(e)},
            }
