"""Tool for fetching and extracting web page content."""

from typing import Optional
import logging

logger = logging.getLogger(__name__)

try:
    from trafilatura import fetch_url, extract
    TRAFILATURA_AVAILABLE = True
except ImportError:
    TRAFILATURA_AVAILABLE = False
    logger.warning("trafilatura not available. Install with: pip install trafilatura")


class FetchPageTool:
    """Tool for fetching and extracting content from web pages."""

    def __init__(self, max_content_length: int = 5000):
        self.max_content_length = max_content_length

    async def fetch(self, url: str) -> Optional[str]:
        """
        Fetch and extract text content from a webpage.

        Args:
            url: URL to fetch

        Returns:
            Extracted text content (limited to max_content_length) or None if failed
        """
        if not TRAFILATURA_AVAILABLE:
            logger.error("trafilatura not available. Cannot fetch pages.")
            return None

        try:
            downloaded = fetch_url(url)
            if not downloaded:
                logger.warning(f"Could not fetch URL: {url}")
                return None

            text = extract(downloaded)
            if not text:
                logger.warning(f"Could not extract content from: {url}")
                return None

            # Limit content length
            if len(text) > self.max_content_length:
                text = text[: self.max_content_length] + "... [truncated]"

            logger.info(f"Fetched {len(text)} chars from: {url}")
            return text

        except Exception as e:
            logger.error(f"Error fetching page {url}: {e}")
            return None




