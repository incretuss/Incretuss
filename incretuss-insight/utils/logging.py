"""Logging setup: concise console output plus a detailed rotating log file."""
from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

_CONFIGURED = False


def setup_logging(log_dir: Path, verbose: bool = False) -> logging.Logger:
    global _CONFIGURED
    logger = logging.getLogger("insight")
    if _CONFIGURED:
        return logger
    log_dir.mkdir(parents=True, exist_ok=True)
    logger.setLevel(logging.DEBUG)

    console = logging.StreamHandler()
    console.setLevel(logging.DEBUG if verbose else logging.INFO)
    console.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(message)s", "%H:%M:%S"))
    logger.addHandler(console)

    fileh = RotatingFileHandler(log_dir / "insight.log", maxBytes=5_000_000, backupCount=3, encoding="utf-8")
    fileh.setLevel(logging.DEBUG)
    fileh.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s"))
    logger.addHandler(fileh)

    # Third-party noise
    for noisy in ("httpx", "httpcore", "fitz", "pymupdf"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _CONFIGURED = True
    return logger


def get_logger(name: str = "") -> logging.Logger:
    return logging.getLogger("insight" + (f".{name}" if name else ""))
