"""
MCP Client for connecting to external MCP servers.
Implements the Model Context Protocol client specification.
Uses subprocess-based stdio transport for local MCP servers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import subprocess
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class MCPTool:
    """A tool exposed by an MCP server."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    server_name: str


@dataclass
class MCPResource:
    """A resource exposed by an MCP server."""
    uri: str
    name: str
    description: str
    mime_type: str
    server_name: str


@dataclass
class MCPServerConfig:
    """Configuration for connecting to an MCP server."""
    name: str
    command: str  # e.g., "npx -y @modelcontextprotocol/server-filesystem"
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    enabled: bool = True


class MCPServerConnection:
    """Connection to a single MCP server via stdio transport."""

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self.tools: List[MCPTool] = []
        self.resources: List[MCPResource] = []
        self._request_id = 0
        self._connected = False

    async def connect(self) -> bool:
        """Start the MCP server process and initialize."""
        try:
            cmd = [self.config.command] + self.config.args
            env = None
            if self.config.env:
                import os
                env = {**os.environ, **self.config.env}

            self.process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                text=True,
                bufsize=0,
            )

            # Send initialize request
            init_result = await self._send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "vault-ai", "version": "2.0.0"},
            })

            if init_result:
                # Send initialized notification
                await self._send_notification("notifications/initialized", {})

                # Discover tools
                await self._discover_tools()
                await self._discover_resources()

                self._connected = True
                logger.info(
                    f"MCP server '{self.config.name}' connected: "
                    f"{len(self.tools)} tools, {len(self.resources)} resources"
                )
                return True

        except FileNotFoundError:
            logger.error(f"MCP server command not found: {self.config.command}")
        except Exception as e:
            logger.error(f"Failed to connect to MCP server '{self.config.name}': {e}")

        return False

    async def disconnect(self) -> None:
        """Gracefully shut down the MCP server."""
        if self.process:
            try:
                self.process.stdin.close()
                self.process.terminate()
                self.process.wait(timeout=5)
            except Exception:
                self.process.kill()
            self.process = None
        self._connected = False

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool on the MCP server."""
        if not self._connected:
            raise ConnectionError(f"MCP server '{self.config.name}' not connected")

        result = await self._send_request("tools/call", {
            "name": tool_name,
            "arguments": arguments,
        })

        if result and "content" in result:
            # Extract text content from MCP response
            texts = []
            for item in result["content"]:
                if item.get("type") == "text":
                    texts.append(item["text"])
            return "\n".join(texts) if texts else str(result["content"])

        return result

    async def _discover_tools(self) -> None:
        """List available tools from the server."""
        result = await self._send_request("tools/list", {})
        if result and "tools" in result:
            self.tools = [
                MCPTool(
                    name=t["name"],
                    description=t.get("description", ""),
                    input_schema=t.get("inputSchema", {}),
                    server_name=self.config.name,
                )
                for t in result["tools"]
            ]

    async def _discover_resources(self) -> None:
        """List available resources from the server."""
        result = await self._send_request("resources/list", {})
        if result and "resources" in result:
            self.resources = [
                MCPResource(
                    uri=r["uri"],
                    name=r.get("name", r["uri"]),
                    description=r.get("description", ""),
                    mime_type=r.get("mimeType", ""),
                    server_name=self.config.name,
                )
                for r in result["resources"]
            ]

    async def _send_request(self, method: str, params: Dict[str, Any]) -> Optional[Dict]:
        """Send a JSON-RPC request to the server."""
        if not self.process or not self.process.stdin or not self.process.stdout:
            return None

        self._request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params,
        }

        try:
            line = json.dumps(request) + "\n"
            self.process.stdin.write(line)
            self.process.stdin.flush()

            # Read response (with timeout)
            loop = asyncio.get_event_loop()
            response_line = await asyncio.wait_for(
                loop.run_in_executor(None, self.process.stdout.readline),
                timeout=30.0,
            )

            if response_line:
                response = json.loads(response_line)
                if "error" in response:
                    logger.warning(
                        f"MCP error from '{self.config.name}': {response['error']}"
                    )
                    return None
                return response.get("result")

        except asyncio.TimeoutError:
            logger.warning(f"MCP request timed out: {method}")
        except Exception as e:
            logger.error(f"MCP request failed: {e}")

        return None

    async def _send_notification(self, method: str, params: Dict[str, Any]) -> None:
        """Send a JSON-RPC notification (no response expected)."""
        if not self.process or not self.process.stdin:
            return

        notification = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        }

        try:
            line = json.dumps(notification) + "\n"
            self.process.stdin.write(line)
            self.process.stdin.flush()
        except Exception as e:
            logger.error(f"MCP notification failed: {e}")


class MCPClientManager:
    """Manages connections to multiple MCP servers."""

    def __init__(self):
        self.connections: Dict[str, MCPServerConnection] = {}
        self.configs: List[MCPServerConfig] = []

    def add_server(self, config: MCPServerConfig) -> None:
        """Add an MCP server configuration."""
        self.configs.append(config)

    async def connect_all(self) -> Dict[str, bool]:
        """Connect to all configured MCP servers."""
        results = {}
        for config in self.configs:
            if not config.enabled:
                results[config.name] = False
                continue

            conn = MCPServerConnection(config)
            success = await conn.connect()
            if success:
                self.connections[config.name] = conn
            results[config.name] = success

        return results

    async def disconnect_all(self) -> None:
        """Disconnect from all MCP servers."""
        for conn in self.connections.values():
            await conn.disconnect()
        self.connections.clear()

    def get_all_tools(self) -> List[MCPTool]:
        """Get all tools from all connected servers."""
        tools = []
        for conn in self.connections.values():
            tools.extend(conn.tools)
        return tools

    def get_all_resources(self) -> List[MCPResource]:
        """Get all resources from all connected servers."""
        resources = []
        for conn in self.connections.values():
            resources.extend(conn.resources)
        return resources

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool, routing to the correct MCP server."""
        for conn in self.connections.values():
            for tool in conn.tools:
                if tool.name == tool_name:
                    return await conn.call_tool(tool_name, arguments)

        raise ValueError(f"MCP tool '{tool_name}' not found on any connected server")

    def get_status(self) -> Dict[str, Any]:
        """Get status of all MCP connections."""
        return {
            "servers": {
                name: {
                    "connected": conn._connected,
                    "tools": len(conn.tools),
                    "resources": len(conn.resources),
                }
                for name, conn in self.connections.items()
            },
            "total_tools": len(self.get_all_tools()),
            "total_resources": len(self.get_all_resources()),
        }
