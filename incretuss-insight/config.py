"""Central configuration for Incretuss Insight.

All tunable values live here so that the crawler, adapters and exporters never
hard-code paths, delays or keywords. Values can be overridden from the command
line (see main.py) or by environment variables prefixed with ``INSIGHT_``.
"""
from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

APP_NAME = "IncretussInsight"
APP_VERSION = "1.0"


def _env(name: str, default):
    raw = os.environ.get(f"INSIGHT_{name}")
    if raw is None:
        return default
    return type(default)(raw)


class Settings(BaseModel):
    # --- identity -------------------------------------------------------
    user_agent: str = Field(
        default_factory=lambda: _env(
            "USER_AGENT",
            f"Mozilla/5.0 (compatible; {APP_NAME}/{APP_VERSION}; exhibitor research tool)",
        )
    )

    # --- politeness -----------------------------------------------------
    # Minimum seconds between two requests to the same host. Sequential
    # crawling (concurrency 1) is intentional: accuracy over speed.
    request_delay: float = Field(default_factory=lambda: _env("REQUEST_DELAY", 1.0))
    delay_jitter: float = 0.3
    timeout: float = 30.0
    max_retries: int = 4
    retry_backoff: float = 2.0  # seconds, doubled each attempt
    respect_robots_txt: bool = True
    max_redirects: int = 5

    # --- limits ---------------------------------------------------------
    max_html_bytes: int = 8 * 1024 * 1024
    max_pdf_bytes: int = Field(default_factory=lambda: _env("MAX_PDF_MB", 25) * 1024 * 1024)
    max_pdf_pages: int = 40
    max_pdfs_per_company: int = 10
    max_listing_pages: int = 500
    max_discovery_candidates: int = 12

    # --- features -------------------------------------------------------
    extract_pdfs: bool = True
    use_browser_fallback: bool = True  # Playwright only when HTTP is not enough

    # --- paths ----------------------------------------------------------
    db_path: Path = DATA_DIR / "database" / "insight.db"
    export_dir: Path = DATA_DIR / "exports"
    raw_dir: Path = DATA_DIR / "raw"
    processed_dir: Path = DATA_DIR / "processed"
    log_dir: Path = DATA_DIR / "processed" / "logs"
    export_filename: str = "Event_Exhibitor_Database.xlsx"

    def ensure_dirs(self) -> None:
        for p in (self.db_path.parent, self.export_dir, self.raw_dir, self.processed_dir, self.log_dir):
            p.mkdir(parents=True, exist_ok=True)


# Keywords used by the discovery engine to find exhibitor directories.
DIRECTORY_KEYWORDS = [
    "exhibitor", "exhibitors", "exhibitor-list", "exhibitor list", "exhibitor directory",
    "participants", "participant", "companies", "company list", "directory",
    "brands", "catalogue", "catalog", "who's exhibiting", "whos-exhibiting", "exhibiting companies",
    "aussteller", "exposants", "expositores", "участники", "экспоненты",
]

# Link texts / URL fragments that look like exhibitor-related links but are
# almost never the directory itself (sales pages for prospective exhibitors).
DIRECTORY_NEGATIVE_KEYWORDS = [
    "enquiry", "inquiry", "why-exhibit", "why exhibit", "book-a-stand", "book a stand", "become",
    "resource", "manual", "promo", "sponsor", "register", "registration", "login", "apply",
    "faq", "terms", "privacy", "cookie", "news", "article", "press",
]

# Domains that are never a company's official website.
NON_COMPANY_DOMAINS = {
    "facebook.com", "twitter.com", "x.com", "linkedin.com", "instagram.com", "youtube.com",
    "youtu.be", "vk.com", "t.me", "telegram.org", "wa.me", "whatsapp.com", "tiktok.com",
    "pinterest.com", "google.com", "goo.gl", "maps.google.com", "apple.com", "bit.ly",
    "ok.ru", "rutube.ru", "dzen.ru", "yandex.ru", "zoom.us", "vimeo.com", "wechat.com",
    "flickr.com", "github.com", "medium.com", "cloudflare.com", "jquery.com", "bootstrapcdn.com",
    "cdnjs.cloudflare.com", "googleapis.com", "gstatic.com", "w3.org", "schema.org",
    "ite.group", "xporience.com", "mapyourshow.com", "a2zinc.net", "expocad.com",
}

settings = Settings()
