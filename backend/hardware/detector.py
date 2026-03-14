"""
Hardware detection for GPU, RAM, and CPU.
Supports NVIDIA (nvidia-smi / pynvml), AMD (rocm-smi), and CPU-only setups.
"""

from __future__ import annotations

import logging
import os
import platform
import shutil
import subprocess
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class GPUInfo:
    name: str
    vram_total_mb: int
    vram_free_mb: int
    driver_version: str = ""
    cuda_version: str = ""
    vendor: str = "unknown"  # "nvidia", "amd", "intel", "apple"

    @property
    def vram_total_gb(self) -> float:
        return round(self.vram_total_mb / 1024, 1)

    @property
    def vram_free_gb(self) -> float:
        return round(self.vram_free_mb / 1024, 1)


@dataclass
class HardwareInfo:
    """Full hardware profile of the system."""
    cpu_name: str = "Unknown CPU"
    cpu_cores: int = 1
    cpu_threads: int = 1
    ram_total_mb: int = 0
    ram_available_mb: int = 0
    gpus: List[GPUInfo] = field(default_factory=list)
    os_name: str = ""
    os_version: str = ""
    platform: str = ""  # "linux", "darwin", "windows"

    @property
    def ram_total_gb(self) -> float:
        return round(self.ram_total_mb / 1024, 1)

    @property
    def ram_available_gb(self) -> float:
        return round(self.ram_available_mb / 1024, 1)

    @property
    def total_vram_mb(self) -> int:
        return sum(g.vram_total_mb for g in self.gpus)

    @property
    def total_vram_gb(self) -> float:
        return round(self.total_vram_mb / 1024, 1)

    @property
    def has_gpu(self) -> bool:
        return len(self.gpus) > 0

    @property
    def primary_gpu(self) -> Optional[GPUInfo]:
        return self.gpus[0] if self.gpus else None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["ram_total_gb"] = self.ram_total_gb
        data["ram_available_gb"] = self.ram_available_gb
        data["total_vram_gb"] = self.total_vram_gb
        data["has_gpu"] = self.has_gpu
        return data


def detect_hardware() -> HardwareInfo:
    """Detect system hardware capabilities."""
    info = HardwareInfo(
        platform=platform.system().lower(),
        os_name=platform.system(),
        os_version=platform.version(),
    )

    _detect_cpu(info)
    _detect_ram(info)
    _detect_gpus(info)

    logger.info(
        "Hardware detected: %s, %d cores, %.1fGB RAM, %d GPU(s) with %.1fGB VRAM",
        info.cpu_name,
        info.cpu_cores,
        info.ram_total_gb,
        len(info.gpus),
        info.total_vram_gb,
    )
    return info


def _detect_cpu(info: HardwareInfo) -> None:
    """Detect CPU information."""
    info.cpu_cores = os.cpu_count() or 1
    info.cpu_threads = info.cpu_cores  # Default; updated below if possible

    try:
        if info.platform == "linux":
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if line.startswith("model name"):
                        info.cpu_name = line.split(":")[1].strip()
                        break
            # Get thread count
            try:
                result = subprocess.run(
                    ["nproc", "--all"], capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    info.cpu_threads = int(result.stdout.strip())
            except Exception:
                pass
        elif info.platform == "darwin":
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                info.cpu_name = result.stdout.strip()
        elif info.platform == "windows":
            info.cpu_name = platform.processor() or "Unknown CPU"
    except Exception as e:
        logger.debug(f"CPU detection partial failure: {e}")


def _detect_ram(info: HardwareInfo) -> None:
    """Detect RAM information."""
    try:
        if info.platform == "linux":
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        info.ram_total_mb = int(line.split()[1]) // 1024
                    elif line.startswith("MemAvailable:"):
                        info.ram_available_mb = int(line.split()[1]) // 1024
        elif info.platform == "darwin":
            result = subprocess.run(
                ["sysctl", "-n", "hw.memsize"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                info.ram_total_mb = int(result.stdout.strip()) // (1024 * 1024)
                info.ram_available_mb = info.ram_total_mb  # Approximation
        elif info.platform == "windows":
            # Use wmic
            result = subprocess.run(
                ["wmic", "OS", "get", "TotalVisibleMemorySize", "/value"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                for line in result.stdout.split("\n"):
                    if "TotalVisibleMemorySize" in line:
                        info.ram_total_mb = int(line.split("=")[1].strip()) // 1024
    except Exception as e:
        logger.debug(f"RAM detection failed: {e}")


def _detect_gpus(info: HardwareInfo) -> None:
    """Detect GPU(s) — tries NVIDIA first, then AMD, then Apple Silicon."""
    # Try NVIDIA via pynvml (most reliable)
    if _detect_nvidia_pynvml(info):
        return

    # Try NVIDIA via nvidia-smi CLI
    if _detect_nvidia_cli(info):
        return

    # Try AMD via rocm-smi
    if _detect_amd(info):
        return

    # Try Apple Silicon (Metal)
    if info.platform == "darwin":
        _detect_apple_silicon(info)


def _detect_nvidia_pynvml(info: HardwareInfo) -> bool:
    """Detect NVIDIA GPUs using pynvml."""
    try:
        import pynvml
        pynvml.nvmlInit()
        device_count = pynvml.nvmlDeviceGetCount()
        for i in range(device_count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            name = pynvml.nvmlDeviceGetName(handle)
            if isinstance(name, bytes):
                name = name.decode("utf-8")
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)

            driver = ""
            try:
                driver = pynvml.nvmlSystemGetDriverVersion()
                if isinstance(driver, bytes):
                    driver = driver.decode("utf-8")
            except Exception:
                pass

            cuda = ""
            try:
                cuda_ver = pynvml.nvmlSystemGetCudaDriverVersion_v2()
                cuda = f"{cuda_ver // 1000}.{(cuda_ver % 1000) // 10}"
            except Exception:
                pass

            info.gpus.append(GPUInfo(
                name=name,
                vram_total_mb=mem_info.total // (1024 * 1024),
                vram_free_mb=mem_info.free // (1024 * 1024),
                driver_version=driver,
                cuda_version=cuda,
                vendor="nvidia",
            ))

        pynvml.nvmlShutdown()
        return len(info.gpus) > 0
    except ImportError:
        logger.debug("pynvml not installed, trying nvidia-smi CLI")
        return False
    except Exception as e:
        logger.debug(f"pynvml detection failed: {e}")
        return False


def _detect_nvidia_cli(info: HardwareInfo) -> bool:
    """Detect NVIDIA GPUs using nvidia-smi CLI."""
    if not shutil.which("nvidia-smi"):
        return False

    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,memory.free,driver_version",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            return False

        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 3:
                info.gpus.append(GPUInfo(
                    name=parts[0],
                    vram_total_mb=int(float(parts[1])),
                    vram_free_mb=int(float(parts[2])),
                    driver_version=parts[3] if len(parts) > 3 else "",
                    vendor="nvidia",
                ))
        return len(info.gpus) > 0
    except Exception as e:
        logger.debug(f"nvidia-smi detection failed: {e}")
        return False


def _detect_amd(info: HardwareInfo) -> bool:
    """Detect AMD GPUs using rocm-smi."""
    if not shutil.which("rocm-smi"):
        return False

    try:
        result = subprocess.run(
            ["rocm-smi", "--showmeminfo", "vram", "--csv"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            return False

        # Parse rocm-smi CSV output
        lines = result.stdout.strip().split("\n")
        for line in lines[1:]:  # Skip header
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 3:
                info.gpus.append(GPUInfo(
                    name=f"AMD GPU {len(info.gpus)}",
                    vram_total_mb=int(float(parts[1])) // (1024 * 1024),
                    vram_free_mb=int(float(parts[2])) // (1024 * 1024),
                    vendor="amd",
                ))
        return len(info.gpus) > 0
    except Exception as e:
        logger.debug(f"rocm-smi detection failed: {e}")
        return False


def _detect_apple_silicon(info: HardwareInfo) -> None:
    """Detect Apple Silicon unified memory as GPU."""
    try:
        result = subprocess.run(
            ["sysctl", "-n", "hw.memsize"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            total_bytes = int(result.stdout.strip())
            # Apple Silicon shares RAM with GPU; ~75% usable for ML
            gpu_mem_mb = int(total_bytes * 0.75 / (1024 * 1024))
            info.gpus.append(GPUInfo(
                name=info.cpu_name or "Apple Silicon",
                vram_total_mb=gpu_mem_mb,
                vram_free_mb=gpu_mem_mb,  # Approximation
                vendor="apple",
            ))
    except Exception as e:
        logger.debug(f"Apple Silicon detection failed: {e}")
