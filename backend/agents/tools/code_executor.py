"""
Sandboxed code execution tool for agents.
Runs Python and JavaScript in isolated subprocesses with resource limits.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Safety: max execution time and output size
MAX_TIMEOUT_SECONDS = 30
MAX_OUTPUT_CHARS = 50000
WORKSPACE_DIR = Path("data/workspace")


@dataclass
class ExecutionResult:
    """Result of code execution."""
    success: bool
    stdout: str
    stderr: str
    return_value: Optional[str] = None
    execution_time_ms: int = 0
    language: str = "python"


async def execute_python(
    code: str,
    timeout: int = MAX_TIMEOUT_SECONDS,
) -> ExecutionResult:
    """Execute Python code in a sandboxed subprocess."""
    start = time.time()

    # Create a temp file for the code
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, dir=_ensure_workspace()
    ) as f:
        f.write(code)
        temp_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            "python3", temp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(WORKSPACE_DIR),
            env=_safe_env(),
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=f"Execution timed out after {timeout} seconds",
                execution_time_ms=int((time.time() - start) * 1000),
                language="python",
            )

        stdout = stdout_bytes.decode("utf-8", errors="replace")[:MAX_OUTPUT_CHARS]
        stderr = stderr_bytes.decode("utf-8", errors="replace")[:MAX_OUTPUT_CHARS]

        return ExecutionResult(
            success=proc.returncode == 0,
            stdout=stdout,
            stderr=stderr,
            execution_time_ms=int((time.time() - start) * 1000),
            language="python",
        )

    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass


async def execute_javascript(
    code: str,
    timeout: int = MAX_TIMEOUT_SECONDS,
) -> ExecutionResult:
    """Execute JavaScript code in a sandboxed subprocess (requires Node.js)."""
    start = time.time()

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".js", delete=False, dir=_ensure_workspace()
    ) as f:
        f.write(code)
        temp_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            "node", temp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(WORKSPACE_DIR),
            env=_safe_env(),
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=f"Execution timed out after {timeout} seconds",
                execution_time_ms=int((time.time() - start) * 1000),
                language="javascript",
            )

        stdout = stdout_bytes.decode("utf-8", errors="replace")[:MAX_OUTPUT_CHARS]
        stderr = stderr_bytes.decode("utf-8", errors="replace")[:MAX_OUTPUT_CHARS]

        return ExecutionResult(
            success=proc.returncode == 0,
            stdout=stdout,
            stderr=stderr,
            execution_time_ms=int((time.time() - start) * 1000),
            language="javascript",
        )

    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass


async def execute_code(
    code: str,
    language: str = "python",
    timeout: int = MAX_TIMEOUT_SECONDS,
) -> ExecutionResult:
    """Execute code in the specified language."""
    language = language.lower().strip()
    if language in ("python", "python3", "py"):
        return await execute_python(code, timeout)
    elif language in ("javascript", "js", "node"):
        return await execute_javascript(code, timeout)
    else:
        return ExecutionResult(
            success=False,
            stdout="",
            stderr=f"Unsupported language: {language}. Supported: python, javascript",
            language=language,
        )


def _ensure_workspace() -> str:
    """Ensure workspace directory exists."""
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    return str(WORKSPACE_DIR)


def _safe_env() -> dict:
    """Create a restricted environment for code execution."""
    env = os.environ.copy()
    # Remove potentially dangerous env vars
    for key in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "OPENAI_API_KEY",
                 "ANTHROPIC_API_KEY", "DATABASE_URL", "SECRET_KEY"]:
        env.pop(key, None)
    return env
