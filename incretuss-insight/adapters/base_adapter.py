"""Adapter contract.

An adapter knows how to (1) enumerate the exhibitors of one directory and
(2) turn one exhibitor profile into a :class:`ProfileResult`. Everything else
(storage, throttling, resume, PDFs, categorisation, export) is done by the
core engine, so adding a new exhibition platform means adding one adapter
file and registering it in ``adapters/__init__.py``.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Iterator, Optional

from database.models import ExhibitorStub, ProfileResult

if TYPE_CHECKING:  # pragma: no cover
    from config import Settings
    from crawler.browser import BrowserFetcher
    from crawler.fetcher import Fetcher


@dataclass
class ListingPage:
    """One page (or batch) of directory results."""
    stubs: list[ExhibitorStub]
    page_url: str
    state: dict                       # opaque resume state stored in SQLite
    expected_total: Optional[int] = None
    done: bool = False
    note: Optional[str] = None


@dataclass
class ProfileContext:
    """What the engine knows about an exhibitor when asking for its profile."""
    company_id: str
    name: str
    profile_url: str
    listing: dict = field(default_factory=dict)


class BaseAdapter(ABC):
    #: unique short name, used on the CLI (``--adapter``) and stored per event
    name: str = "base"
    #: human-readable description shown in the crawl strategy
    description: str = ""
    #: organiser sector label -> normalised categories (exact label or label head)
    sector_overrides: dict[str, list[str]] = {}

    def __init__(self, fetcher: "Fetcher", settings: "Settings", browser: "BrowserFetcher | None" = None):
        self.fetcher = fetcher
        self.settings = settings
        self.browser = browser

    # ------------------------------------------------------------ detection
    @classmethod
    def detect(cls, url: str, html: str) -> float:
        """Confidence 0..1 that this adapter handles the directory at ``url``."""
        return 0.0

    # ------------------------------------------------------------- strategy
    def describe_strategy(self, directory_url: str) -> list[str]:
        return [f"Adapter: {self.name} - {self.description}", f"Directory: {directory_url}"]

    # -------------------------------------------------------------- listing
    @abstractmethod
    def iter_listing(self, directory_url: str, state: dict) -> Iterator[ListingPage]:
        """Yield listing pages, resuming from ``state`` (empty dict = from start)."""

    # -------------------------------------------------------------- profile
    @abstractmethod
    def extract_profile(self, ctx: ProfileContext) -> ProfileResult:
        """Fetch and parse a single exhibitor profile. Must not raise for
        partial data; raise only when the profile itself is unavailable."""
