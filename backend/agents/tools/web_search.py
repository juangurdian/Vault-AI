"""Web search tool using SearXNG."""

from typing import List, Dict, Any, Optional
import httpx
import logging

logger = logging.getLogger(__name__)


class WebSearchTool:
    """Tool for searching the web using SearXNG."""

    def __init__(self, searxng_url: str = "http://searxng:8080"):
        self.searxng_url = searxng_url.rstrip("/")
        self.base_url = f"{self.searxng_url}/search"

    async def search(
        self, query: str, num_results: int = 5, categories: str = "general"
    ) -> List[Dict[str, Any]]:
        """
        Search the web for information.

        Args:
            query: Search query string
            num_results: Number of results to return (default: 5)
            categories: Search categories (default: "general")

        Returns:
            List of search results with title, url, and snippet
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.base_url,
                    params={
                        "q": query,
                        "format": "json",
                        "categories": categories,
                    },
                )
                response.raise_for_status()
                data = response.json()

                results = data.get("results", [])[:num_results]
                formatted_results = []
                for r in results:
                    formatted_results.append(
                        {
                            "title": r.get("title", ""),
                            "url": r.get("url", ""),
                            "snippet": r.get("content", ""),
                            "engine": r.get("engine", ""),
                        }
                    )

                logger.info(f"Web search '{query}': Found {len(formatted_results)} results")
                return formatted_results

        except httpx.TimeoutException:
            logger.error(f"Web search timeout for query: {query}")
            return []
        except httpx.RequestError as e:
            logger.error(f"Web search request error: {e}")
            return []
        except Exception as e:
            logger.error(f"Web search error: {e}")
            return []

    async def is_available(self) -> bool:
        """Check if SearXNG is available."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(f"{self.searxng_url}/", follow_redirects=True)
                return response.status_code == 200
        except Exception:
            return False




