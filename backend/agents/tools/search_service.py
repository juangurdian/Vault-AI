"""
Unified web search service with multiple providers.
Brave > Perplexity > DuckDuckGo > SearXNG (configurable order).
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import httpx
import logging
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Standardized search result."""
    title: str
    url: str
    snippet: str
    source: str  # 'brave', 'perplexity', 'duckduckgo', or 'searxng'


class SearchService:
    """
    Unified search service with multiple providers and configurable fallback order.

    Usage:
        service = SearchService(brave_api_key="key", perplexity_api_key="key")
        results = await service.search("query", num_results=5)
    """

    BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search"
    PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

    def __init__(
        self,
        brave_api_key: Optional[str] = None,
        perplexity_api_key: Optional[str] = None,
        searxng_url: Optional[str] = None,
        provider_order: Optional[List[str]] = None,
    ):
        self.brave_api_key = brave_api_key
        self.perplexity_api_key = perplexity_api_key
        self.searxng_url = searxng_url.rstrip("/") if searxng_url else None
        self.provider_order = provider_order or ["brave", "perplexity", "duckduckgo", "searxng"]

        self._brave_available = bool(brave_api_key)
        self._perplexity_available = bool(perplexity_api_key)
        self._searxng_available = bool(searxng_url)

    async def search(
        self,
        query: str,
        num_results: int = 5,
        timeout: float = 10.0,
    ) -> List[SearchResult]:
        """Search the web using providers in configured order."""
        provider_map = {
            "brave": (self._brave_available, self._brave_search),
            "perplexity": (self._perplexity_available, self._perplexity_search),
            "duckduckgo": (True, self._duckduckgo_search),
            "searxng": (self._searxng_available, self._searxng_search),
        }

        for provider_name in self.provider_order:
            available, search_fn = provider_map.get(provider_name, (False, None))
            if not available or search_fn is None:
                continue
            try:
                results = await search_fn(query, num_results, timeout)
                if results:
                    logger.info(f"Search '{query}': {len(results)} results from {provider_name}")
                    return results
            except Exception as e:
                logger.warning(f"{provider_name} search failed for '{query}': {e}")

        logger.error(f"All search providers failed for query: {query}")
        return []

    async def _brave_search(
        self,
        query: str,
        num_results: int,
        timeout: float,
    ) -> List[SearchResult]:
        """Search using Brave Search API."""
        if not self.brave_api_key:
            return []

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(
                    self.BRAVE_API_URL,
                    headers={
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip",
                        "X-Subscription-Token": self.brave_api_key,
                    },
                    params={
                        "q": query,
                        "count": min(num_results, 20),  # Brave max is 20
                        "text_decorations": "false",
                        "search_lang": "en",
                    },
                )
                response.raise_for_status()
                data = response.json()

                results = []
                web_results = data.get("web", {}).get("results", [])
                
                for item in web_results[:num_results]:
                    results.append(SearchResult(
                        title=item.get("title", ""),
                        url=item.get("url", ""),
                        snippet=item.get("description", ""),
                        source="brave",
                    ))

                return results

        except httpx.TimeoutException:
            logger.error(f"Brave search timeout for query: {query}")
            return []
        except httpx.HTTPStatusError as e:
            logger.error(f"Brave search HTTP error: {e.response.status_code}")
            return []
        except Exception as e:
            logger.error(f"Brave search error: {e}")
            return []

    async def _perplexity_search(
        self,
        query: str,
        num_results: int,
        timeout: float,
    ) -> List[SearchResult]:
        """Search using Perplexity API (returns an AI answer with citations)."""
        if not self.perplexity_api_key:
            return []

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.PERPLEXITY_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.perplexity_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "sonar",
                        "messages": [{"role": "user", "content": query}],
                    },
                )
                response.raise_for_status()
                data = response.json()

                results: List[SearchResult] = []

                content = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                citations = data.get("citations", [])

                if content:
                    results.append(SearchResult(
                        title=f"Perplexity: {query[:80]}",
                        url="",
                        snippet=content[:500],
                        source="perplexity",
                    ))

                for url in citations[:num_results]:
                    if isinstance(url, str):
                        results.append(SearchResult(
                            title=url.split("/")[-1][:80] or url[:80],
                            url=url,
                            snippet="",
                            source="perplexity",
                        ))

                return results[:num_results]

        except httpx.TimeoutException:
            logger.error(f"Perplexity search timeout for query: {query}")
            return []
        except httpx.HTTPStatusError as e:
            logger.error(f"Perplexity HTTP error: {e.response.status_code}")
            return []
        except Exception as e:
            logger.error(f"Perplexity search error: {e}")
            return []

    async def _duckduckgo_search(
        self,
        query: str,
        num_results: int,
        timeout: float,
    ) -> List[SearchResult]:
        """Search using DuckDuckGo via duckduckgo-search library."""
        try:
            # Run in thread pool since duckduckgo-search is synchronous
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self._duckduckgo_sync_search(query, num_results)
            )
            return results
        except Exception as e:
            logger.error(f"DuckDuckGo search error: {e}")
            return []

    def _duckduckgo_sync_search(
        self,
        query: str,
        num_results: int,
    ) -> List[SearchResult]:
        """Synchronous DuckDuckGo search."""
        try:
            from duckduckgo_search import DDGS

            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=num_results):
                    results.append(SearchResult(
                        title=r.get("title", ""),
                        url=r.get("href", ""),
                        snippet=r.get("body", ""),
                        source="duckduckgo",
                    ))
            return results

        except ImportError:
            logger.error("duckduckgo-search not installed. Install with: pip install duckduckgo-search")
            return []
        except Exception as e:
            logger.error(f"DuckDuckGo sync search error: {e}")
            return []

    async def _searxng_search(
        self,
        query: str,
        num_results: int,
        timeout: float,
    ) -> List[SearchResult]:
        """Search using SearXNG as last resort."""
        if not self.searxng_url:
            return []

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(
                    f"{self.searxng_url}/search",
                    params={
                        "q": query,
                        "format": "json",
                        "categories": "general",
                    },
                )
                response.raise_for_status()
                data = response.json()

                results = []
                for item in data.get("results", [])[:num_results]:
                    results.append(SearchResult(
                        title=item.get("title", ""),
                        url=item.get("url", ""),
                        snippet=item.get("content", ""),
                        source="searxng",
                    ))

                return results

        except Exception as e:
            logger.error(f"SearXNG search error: {e}")
            return []

    async def is_available(self) -> Dict[str, bool]:
        """Check availability of all search providers."""
        availability = {
            "brave": False,
            "perplexity": False,
            "duckduckgo": False,
            "searxng": False,
        }

        if self._brave_available:
            try:
                results = await self._brave_search("test", 1, 3.0)
                availability["brave"] = len(results) > 0
            except Exception:
                pass

        if self._perplexity_available:
            availability["perplexity"] = True  # API key present, assume valid

        try:
            results = await self._duckduckgo_search("test", 1, 5.0)
            availability["duckduckgo"] = len(results) > 0
        except Exception:
            pass

        if self._searxng_available:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    response = await client.get(f"{self.searxng_url}/")
                    availability["searxng"] = response.status_code == 200
            except Exception:
                pass

        return availability

    def to_dict_list(self, results: List[SearchResult]) -> List[Dict[str, Any]]:
        """Convert SearchResult list to dict list for JSON serialization."""
        return [
            {
                "title": r.title,
                "url": r.url,
                "snippet": r.snippet,
                "source": r.source,
            }
            for r in results
        ]


