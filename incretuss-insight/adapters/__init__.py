"""Adapter registry.

To add a website adapter: create ``adapters/<name>_adapter.py`` with a
subclass of :class:`BaseAdapter` and add it to ``ADAPTERS`` below. Nothing in
the core crawler needs to change.
"""
from __future__ import annotations

from adapters.base_adapter import BaseAdapter
from adapters.generic_adapter import GenericAdapter
from adapters.pharmtech_adapter import ExhibitorOnlineManualAdapter

# Order matters only for ties; the generic adapter must stay last.
ADAPTERS: list[type[BaseAdapter]] = [
    ExhibitorOnlineManualAdapter,
    GenericAdapter,
]


def adapter_by_name(name: str) -> type[BaseAdapter]:
    for cls in ADAPTERS:
        if cls.name == name:
            return cls
    raise KeyError(f"unknown adapter {name!r}; available: {', '.join(c.name for c in ADAPTERS)}")


def select_adapter(url: str, html: str) -> tuple[type[BaseAdapter], float]:
    """Pick the adapter with the highest detection score for a directory page."""
    scored = sorted(((cls.detect(url, html), i, cls) for i, cls in enumerate(ADAPTERS)), key=lambda t: (-t[0], t[1]))
    score, _, cls = scored[0]
    return cls, score
