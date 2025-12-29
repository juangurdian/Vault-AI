"""Deep research pipeline combining web search and RAG."""

from __future__ import annotations

from typing import List, Optional, Dict, Any, AsyncGenerator, Callable
from dataclasses import dataclass
import asyncio
import logging

from .vector_store import VectorStore
from ..agents.tools.web_search import WebSearchTool
from ..agents.tools.page_fetch import FetchPageTool
import ollama

logger = logging.getLogger(__name__)


@dataclass
class ResearchReport:
    """Research report with findings and sources."""

    topic: str
    summary: str
    key_findings: List[str]
    sources: List[str]
    raw_content: str


class DeepResearchPipeline:
    """Multi-step research pipeline combining web search and RAG."""

    def __init__(
        self,
        vector_store: VectorStore,
        searxng_url: str = "http://searxng:8080",
        planner_model: str = "deepseek-r1:8b",
        synthesizer_model: str = "qwen3:8b",
        ollama_base_url: Optional[str] = None,
    ):
        self.vector_store = vector_store
        self.searxng_url = searxng_url
        self.planner_model = planner_model
        self.synthesizer_model = synthesizer_model

        # Initialize Ollama client
        if ollama_base_url:
            self.ollama_client = ollama.Client(host=ollama_base_url)
        else:
            self.ollama_client = ollama.Client()

        # Initialize tools
        self.web_search = WebSearchTool(searxng_url=searxng_url)
        self.page_fetch = FetchPageTool()

    async def research(
        self,
        topic: str,
        depth: int = 3,
        include_local: bool = True,
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> ResearchReport:
        """
        Conduct deep research on a topic.

        Args:
            topic: Research topic
            depth: Research depth (affects number of search queries)
            include_local: Whether to include local RAG knowledge base
            progress_callback: Optional callback for progress updates

        Returns:
            ResearchReport with findings and sources
        """
        try:
            # Step 1: Generate research plan
            if progress_callback:
                progress_callback("progress", {"step": 1, "total": 6, "message": "Generating research plan..."})

            plan = await self._generate_plan(topic, depth)
            queries = self._parse_queries(plan)

            if progress_callback:
                progress_callback("progress", {"step": 2, "total": 6, "message": f"Executing {len(queries)} search queries..."})

            # Step 2: Execute web searches
            web_results = await self._execute_searches(queries, progress_callback)

            if progress_callback:
                progress_callback("progress", {"step": 3, "total": 6, "message": f"Fetching content from {len(web_results)} pages..."})

            # Step 3: Fetch and process web pages
            documents = await self._fetch_pages(web_results, progress_callback)

            # Step 4: Search local knowledge base
            local_results = []
            if include_local:
                if progress_callback:
                    progress_callback("progress", {"step": 4, "total": 6, "message": "Searching local knowledge base..."})

                local_results = await self.vector_store.search(topic, top_k=10)

            if progress_callback:
                progress_callback("progress", {"step": 5, "total": 6, "message": "Combining sources..."})

            # Step 5: Combine and synthesize
            all_content = self._combine_sources(documents, local_results)

            if progress_callback:
                progress_callback("progress", {"step": 6, "total": 6, "message": "Synthesizing research report..."})

            # Step 6: Generate report
            report = await self._synthesize_report(topic, all_content)

            return ResearchReport(
                topic=topic,
                summary=report["summary"],
                key_findings=report["key_findings"],
                sources=[d["url"] for d in documents if d.get("url")],
                raw_content=all_content,
            )

        except Exception as e:
            logger.error(f"Deep research error: {e}", exc_info=True)
            raise

    async def stream_research(
        self, topic: str, depth: int = 3, include_local: bool = True
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream research process with progress updates.

        Yields:
            Dict with event_type and data
        """
        try:
            # Step 1: Generate plan
            yield {
                "event_type": "progress",
                "data": {"step": 1, "total": 6, "message": "Generating research plan..."},
            }

            plan = await self._generate_plan(topic, depth)
            queries = self._parse_queries(plan)

            yield {
                "event_type": "progress",
                "data": {"step": 2, "total": 6, "message": f"Executing {len(queries)} search queries..."},
            }

            # Step 2: Execute searches
            web_results = []
            for i, query in enumerate(queries, 1):
                yield {
                    "event_type": "progress",
                    "data": {"step": 2, "total": 6, "message": f"Searching: {query} ({i}/{len(queries)})"},
                }

                results = await self.web_search.search(query, num_results=5)
                web_results.extend(results)

                # Yield findings as they come
                for result in results:
                    yield {
                        "event_type": "finding",
                        "data": {
                            "title": result.get("title", ""),
                            "url": result.get("url", ""),
                            "snippet": result.get("snippet", ""),
                        },
                    }

            # Deduplicate
            seen_urls = set()
            unique_results = []
            for result in web_results:
                url = result.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    unique_results.append(result)

            yield {
                "event_type": "progress",
                "data": {"step": 3, "total": 6, "message": f"Fetching content from {len(unique_results)} pages..."},
            }

            # Step 3: Fetch pages
            documents = []
            for i, result in enumerate(unique_results[:15], 1):  # Limit to 15 pages
                yield {
                    "event_type": "progress",
                    "data": {"step": 3, "total": 6, "message": f"Fetching page {i}/{min(15, len(unique_results))}..."},
                }

                content = await self.page_fetch.fetch(result.get("url", ""))
                if content:
                    documents.append(
                        {
                            "url": result.get("url", ""),
                            "title": result.get("title", ""),
                            "content": content,
                        }
                    )

            # Step 4: Local RAG
            local_results = []
            if include_local:
                yield {
                    "event_type": "progress",
                    "data": {"step": 4, "total": 6, "message": "Searching local knowledge base..."},
                }

                local_results = await self.vector_store.search(topic, top_k=10)

            yield {
                "event_type": "progress",
                "data": {"step": 5, "total": 6, "message": "Combining sources..."},
            }

            # Step 5: Combine
            all_content = self._combine_sources(documents, local_results)

            yield {
                "event_type": "progress",
                "data": {"step": 6, "total": 6, "message": "Synthesizing research report..."},
            }

            # Step 6: Synthesize
            report = await self._synthesize_report(topic, all_content)

            # Stream report chunks
            summary_parts = report["summary"].split("\n\n")
            for part in summary_parts:
                if part.strip():
                    yield {
                        "event_type": "report",
                        "data": {"content": part + "\n\n"},
                    }

            # Yield sources
            sources = [d["url"] for d in documents if d.get("url")]
            yield {
                "event_type": "sources",
                "data": {"sources": sources},
            }

            # Done
            yield {
                "event_type": "done",
                "data": {
                    "success": True,
                    "key_findings": report["key_findings"],
                    "sources": sources,
                },
            }

        except Exception as e:
            logger.error(f"Stream research error: {e}", exc_info=True)
            yield {
                "event_type": "error",
                "data": {"error": str(e)},
            }

    async def _generate_plan(self, topic: str, depth: int) -> str:
        """Generate a research plan with search queries."""
        num_queries = depth * 3

        prompt = f"""Create a comprehensive research plan for: {topic}

Generate {num_queries} diverse search queries that will cover:
- Basic definitions and overview
- Key concepts and components
- Recent developments and news
- Expert opinions and analysis
- Practical applications

Return only the search queries, one per line. No numbering or bullets."""

        try:
            response = self.ollama_client.chat(
                model=self.planner_model,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Error generating plan: {e}")
            # Fallback: simple queries
            return f"{topic}\n{topic} overview\n{topic} recent developments"

    def _parse_queries(self, plan: str) -> List[str]:
        """Extract search queries from plan."""
        lines = plan.strip().split("\n")
        queries = []
        for line in lines:
            # Clean up numbering and bullet points
            query = line.strip().lstrip("0123456789.-) ")
            if query and len(query) > 5:
                queries.append(query)
        return queries[:15]  # Limit to 15 queries

    async def _execute_searches(
        self,
        queries: List[str],
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> List[Dict[str, Any]]:
        """Execute multiple search queries."""
        all_results = []

        for query in queries:
            try:
                results = await self.web_search.search(query, num_results=5)
                all_results.extend(results)

                if progress_callback:
                    progress_callback("finding", {"query": query, "results": len(results)})

            except Exception as e:
                logger.error(f"Search error for '{query}': {e}")

        # Deduplicate by URL
        seen_urls = set()
        unique_results = []
        for result in all_results:
            url = result.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_results.append(result)

        return unique_results

    async def _fetch_pages(
        self,
        results: List[Dict[str, Any]],
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch content from result URLs."""
        documents = []

        for i, result in enumerate(results[:15], 1):  # Limit to 15 pages
            try:
                url = result.get("url", "")
                if not url:
                    continue

                if progress_callback:
                    progress_callback("progress", {"message": f"Fetching page {i}/{min(15, len(results))}: {url[:50]}..."})

                content = await self.page_fetch.fetch(url)
                if content:
                    documents.append(
                        {
                            "url": url,
                            "title": result.get("title", ""),
                            "content": content,
                        }
                    )

            except Exception as e:
                logger.error(f"Fetch error for {result.get('url', 'unknown')}: {e}")

        return documents

    def _combine_sources(
        self, web_docs: List[Dict[str, Any]], local_results: List[Dict[str, Any]]
    ) -> str:
        """Combine all sources into formatted content."""
        sections = []

        # Web sources
        if web_docs:
            sections.append("## Web Sources\n")
            for doc in web_docs:
                sections.append(f"### {doc.get('title', 'Untitled')}\n")
                sections.append(f"Source: {doc.get('url', 'Unknown')}\n")
                sections.append(f"{doc.get('content', '')}\n\n")

        # Local knowledge
        if local_results:
            sections.append("\n## Local Knowledge Base\n")
            for result in local_results:
                source = result.get("metadata", {}).get("source", "Unknown")
                sections.append(f"### From: {source}\n")
                sections.append(f"{result.get('text', '')}\n\n")

        return "\n".join(sections)

    async def _synthesize_report(self, topic: str, content: str) -> Dict[str, Any]:
        """Synthesize final research report."""
        # Limit content length for synthesis
        max_content = 15000
        if len(content) > max_content:
            content = content[:max_content] + "\n\n[Content truncated for synthesis]"

        prompt = f"""Based on the following research materials, create a comprehensive report on: {topic}

Research Materials:
{content}

Create a report with:
1. Executive Summary (2-3 paragraphs)
2. Key Findings (5-7 bullet points)
3. Detailed Analysis
4. Conclusions

Be thorough but concise. Cite sources where relevant using [Source: URL] format."""

        try:
            response = self.ollama_client.chat(
                model=self.synthesizer_model,
                messages=[{"role": "user", "content": prompt}],
            )

            report_text = response.get("message", {}).get("content", "")

            # Parse key findings (simple extraction)
            key_findings = []
            for line in report_text.split("\n"):
                stripped = line.strip()
                if stripped.startswith(("-", "•", "*")) and len(stripped) > 10:
                    key_findings.append(stripped.lstrip("-•* "))

            return {
                "summary": report_text,
                "key_findings": key_findings[:7],  # Limit to 7 findings
            }

        except Exception as e:
            logger.error(f"Error synthesizing report: {e}")
            return {
                "summary": f"Research completed on {topic}, but synthesis failed: {str(e)}",
                "key_findings": [],
            }
