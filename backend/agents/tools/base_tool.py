"""Base class and types for the BeastAI tool system."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from abc import ABC, abstractmethod


@dataclass
class ToolResult:
    """Standardised return value from any tool execution."""
    success: bool
    result_text: str
    data: Optional[Dict[str, Any]] = None


class BaseTool(ABC):
    """
    Every BeastAI tool inherits from this.

    To create a new tool:
      1. Subclass BaseTool
      2. Set name, description, parameters, when_to_use
      3. Optionally set when_not_to_use and examples
      4. Implement execute(**kwargs)
      5. Drop the file into backend/agents/tools/
      6. The registry auto-discovers it on startup
    """

    name: str = ""
    description: str = ""
    when_to_use: str = ""
    when_not_to_use: str = ""
    examples: List[str] = []

    # JSON Schema for parameters (OpenAI function-calling compatible).
    # Keys: "type" (always "object"), "properties", "required".
    parameters: Dict[str, Any] = {
        "type": "object",
        "properties": {},
        "required": [],
    }

    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult:
        """Run the tool with the given arguments and return a ToolResult."""
        ...

    def manifest(self) -> Dict[str, Any]:
        """Return a JSON-serialisable description (OpenAI function-calling format)."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
                "when_to_use": self.when_to_use,
                "when_not_to_use": self.when_not_to_use,
                "examples": self.examples,
            },
        }

    def to_ollama_tool(self) -> Dict[str, Any]:
        """Return the tool definition in Ollama-native format (same as OpenAI function calling)."""
        desc = self.description
        if self.when_to_use:
            desc += f" Use when: {self.when_to_use}"
        if self.when_not_to_use:
            desc += f" Do NOT use when: {self.when_not_to_use}"
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": desc,
                "parameters": self.parameters,
            },
        }
