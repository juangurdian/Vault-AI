"""Model Context Protocol (MCP) integration for Vault-AI."""

from .client import MCPClientManager
from .registry import MCPToolRegistry

__all__ = ["MCPClientManager", "MCPToolRegistry"]
