"""
MCP Tool Registry — bridges MCP tools into the Vault-AI tool system.
Makes MCP tools appear as native tools to agents.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from .client import MCPClientManager, MCPTool

logger = logging.getLogger(__name__)


class MCPToolWrapper:
    """Wraps an MCP tool to look like a native Vault-AI tool."""

    def __init__(self, mcp_tool: MCPTool, client_manager: MCPClientManager):
        self.mcp_tool = mcp_tool
        self.client_manager = client_manager
        self.name = f"mcp_{mcp_tool.server_name}_{mcp_tool.name}"
        self.description = mcp_tool.description
        self.parameters = mcp_tool.input_schema

    async def execute(self, **kwargs) -> str:
        """Execute the MCP tool."""
        try:
            result = await self.client_manager.call_tool(
                self.mcp_tool.name, kwargs
            )
            return str(result)
        except Exception as e:
            logger.error(f"MCP tool execution failed: {e}")
            return f"Error: {e}"

    def to_ollama_tool(self) -> Dict[str, Any]:
        """Convert to Ollama tool format for native tool calling."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class MCPToolRegistry:
    """Registry that integrates MCP tools with the native tool system."""

    def __init__(self, client_manager: MCPClientManager):
        self.client_manager = client_manager
        self._wrappers: Dict[str, MCPToolWrapper] = {}

    def refresh(self) -> int:
        """Refresh tool wrappers from connected MCP servers."""
        self._wrappers.clear()
        for tool in self.client_manager.get_all_tools():
            wrapper = MCPToolWrapper(tool, self.client_manager)
            self._wrappers[wrapper.name] = wrapper
        logger.info(f"MCP tool registry: {len(self._wrappers)} tools registered")
        return len(self._wrappers)

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all MCP tools in the standard tool format."""
        return [
            {
                "name": w.name,
                "description": w.description,
                "parameters": w.parameters,
                "source": "mcp",
                "server": w.mcp_tool.server_name,
            }
            for w in self._wrappers.values()
        ]

    def get_tool(self, name: str) -> Optional[MCPToolWrapper]:
        """Get an MCP tool wrapper by name."""
        return self._wrappers.get(name)

    async def execute_tool(self, name: str, arguments: Dict[str, Any]) -> str:
        """Execute an MCP tool by name."""
        wrapper = self._wrappers.get(name)
        if not wrapper:
            raise ValueError(f"MCP tool '{name}' not found")
        return await wrapper.execute(**arguments)

    def get_ollama_tools(self) -> List[Dict[str, Any]]:
        """Get all MCP tools in Ollama tool calling format."""
        return [w.to_ollama_tool() for w in self._wrappers.values()]
