import asyncio
import subprocess
import json
import platform
from fastapi import APIRouter
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["system"])


async def _run_cmd(cmd: list[str]) -> Optional[str]:
    """Run a command and return stdout, or None on failure."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5.0)
        return stdout.decode().strip()
    except Exception:
        return None


async def get_gpu_stats() -> dict:
    """Query nvidia-smi for GPU stats."""
    # GPU overview: name, total vram, used vram, free vram, utilization, temperature, power
    query = ",".join([
        "name",
        "memory.total",
        "memory.used",
        "memory.free",
        "utilization.gpu",
        "temperature.gpu",
        "power.draw",
        "power.limit",
    ])
    out = await _run_cmd([
        "nvidia-smi",
        f"--query-gpu={query}",
        "--format=csv,noheader,nounits",
    ])

    if not out:
        return {"available": False}

    try:
        parts = [p.strip() for p in out.split(",")]
        name, mem_total, mem_used, mem_free, util_gpu, temp, power_draw, power_limit = parts

        def safe_float(val: str) -> Optional[float]:
            try:
                return float(val)
            except Exception:
                return None

        return {
            "available": True,
            "name": name,
            "vram_total_mb": safe_float(mem_total),
            "vram_used_mb": safe_float(mem_used),
            "vram_free_mb": safe_float(mem_free),
            "gpu_utilization_pct": safe_float(util_gpu),
            "temperature_c": safe_float(temp),
            "power_draw_w": safe_float(power_draw),
            "power_limit_w": safe_float(power_limit),
        }
    except Exception as e:
        logger.warning(f"Failed to parse nvidia-smi output: {e}")
        return {"available": False}


async def get_gpu_processes() -> list[dict]:
    """Get processes using the GPU."""
    out = await _run_cmd([
        "nvidia-smi",
        "--query-compute-apps=pid,name,used_memory",
        "--format=csv,noheader,nounits",
    ])

    if not out:
        return []

    procs = []
    for line in out.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 2:
            try:
                pid = int(parts[0])
                name = parts[1].split("\\")[-1] if "\\" in parts[1] else parts[1].split("/")[-1]
                vram = None
                if len(parts) >= 3:
                    try:
                        vram = float(parts[2])
                    except Exception:
                        pass
                procs.append({"pid": pid, "name": name, "vram_mb": vram})
            except Exception:
                continue
    return procs


async def get_ollama_gpu_info() -> dict:
    """Check if Ollama is using GPU by inspecting the running process list."""
    gpu_procs = await get_gpu_processes()
    ollama_on_gpu = any("ollama" in p["name"].lower() for p in gpu_procs)

    # Also check via Ollama API for running models
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://localhost:11434/api/ps")
            if resp.status_code == 200:
                data = resp.json()
                models = data.get("models", [])
                return {
                    "ollama_on_gpu": ollama_on_gpu,
                    "running_models": [
                        {
                            "name": m.get("name"),
                            "size_mb": round(m.get("size", 0) / 1024 / 1024),
                            "vram_mb": round(m.get("size_vram", 0) / 1024 / 1024),
                            "cpu_ram_mb": round((m.get("size", 0) - m.get("size_vram", 0)) / 1024 / 1024),
                            "fully_on_gpu": m.get("size_vram", 0) >= m.get("size", 1) * 0.95,
                        }
                        for m in models
                    ],
                }
    except Exception:
        pass

    return {
        "ollama_on_gpu": ollama_on_gpu,
        "running_models": [],
    }


async def get_cpu_ram_stats() -> dict:
    """Get CPU and RAM stats using psutil if available, else fallback."""
    try:
        import psutil
        cpu_pct = psutil.cpu_percent(interval=0.1)
        vm = psutil.virtual_memory()
        return {
            "cpu_utilization_pct": cpu_pct,
            "ram_total_mb": round(vm.total / 1024 / 1024),
            "ram_used_mb": round(vm.used / 1024 / 1024),
            "ram_free_mb": round(vm.available / 1024 / 1024),
            "ram_utilization_pct": vm.percent,
        }
    except ImportError:
        return {
            "cpu_utilization_pct": None,
            "ram_total_mb": None,
            "ram_used_mb": None,
            "ram_free_mb": None,
            "ram_utilization_pct": None,
        }


@router.get("/stats")
async def system_stats():
    """Return GPU, CPU, RAM, and Ollama stats in one call."""
    gpu_task = asyncio.create_task(get_gpu_stats())
    cpu_task = asyncio.create_task(get_cpu_ram_stats())
    ollama_task = asyncio.create_task(get_ollama_gpu_info())

    gpu, cpu_ram, ollama = await asyncio.gather(gpu_task, cpu_task, ollama_task)

    # Calculate spillover: how much model VRAM spilled to CPU RAM
    vram_spillover_mb = 0
    for m in ollama.get("running_models", []):
        vram_spillover_mb += m.get("cpu_ram_mb", 0)

    return {
        "gpu": gpu,
        "cpu_ram": cpu_ram,
        "ollama": ollama,
        "vram_spillover_mb": vram_spillover_mb,
        "platform": platform.system(),
    }
