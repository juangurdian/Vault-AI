"""Hardware detection and adaptive profiles."""

from .detector import detect_hardware, HardwareInfo
from .profiles import HardwareTier, get_tier, get_recommended_models

__all__ = [
    "detect_hardware",
    "HardwareInfo",
    "HardwareTier",
    "get_tier",
    "get_recommended_models",
]
