"""Pydantic models: the contract between adapters, extractors and storage.

Adapters return these objects; the repository validates and persists them.
Every model trims whitespace, and optional text fields collapse empty strings
to ``None`` so "missing" is always represented the same way. Nothing here
invents data: validators only clean or reject.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-']+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = re.sub(r"[ \t\r\f\v]+", " ", v)
        v = re.sub(r"\n\s*\n\s*\n+", "\n\n", v)
        v = v.strip()
        return v or None
    return v


class ExtractionStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"       # profile parsed, core fields present
    PARTIAL = "partial"       # profile parsed but some sub-requests failed
    FAILED = "failed"         # profile could not be fetched / parsed
    SKIPPED = "skipped"       # e.g. robots.txt disallowed


class EvidenceType(str, Enum):
    PROFILE_PRODUCT = "exhibitor_profile_product_listing"
    PROFILE_PRODUCT_DETAIL = "exhibitor_profile_product_detail"
    PROFILE_BRAND = "exhibitor_profile_brand_listing"
    PROFILE_TEXT = "exhibitor_profile_text"
    PDF = "pdf_document"
    LISTING = "directory_listing"


class _Base(BaseModel):
    model_config = {"str_strip_whitespace": True, "validate_assignment": True}


class SectorEntry(_Base):
    """An organiser-defined sector, optionally with sub-sectors."""
    sector: str
    subsectors: list[str] = Field(default_factory=list)

    def as_text(self) -> str:
        return f"{self.sector}: {', '.join(self.subsectors)}" if self.subsectors else self.sector


class ExhibitorStub(_Base):
    """What the directory listing tells us about an exhibitor."""
    name: str
    profile_url: str
    country: Optional[str] = None
    city: Optional[str] = None
    hall: Optional[str] = None
    booth: Optional[str] = None
    website: Optional[str] = None
    listing_url: Optional[str] = None
    extra: dict = Field(default_factory=dict)

    _c = field_validator("country", "city", "hall", "booth", "website", mode="before")(_clean)

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        v = _clean(v)
        if not v:
            raise ValueError("exhibitor name is empty")
        return v


class CompanyData(_Base):
    name: Optional[str] = None
    official_website: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    new_products_text: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    hall: Optional[str] = None
    booth: Optional[str] = None
    event_sectors: list[SectorEntry] = Field(default_factory=list)

    _c = field_validator("name", "official_website", "country", "city", "industry", "description",
                         "new_products_text", "phone", "hall", "booth", mode="before")(_clean)

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, v):
        v = _clean(v)
        if v is None:
            return None
        emails = [e.strip() for e in re.split(r"[;,\s]+", v) if e.strip()]
        valid = [e for e in emails if EMAIL_RE.match(e)]
        return "; ".join(dict.fromkeys(valid)) or None

    @field_validator("official_website")
    @classmethod
    def _site(cls, v):
        if v and not re.match(r"^https?://", v, re.I):
            raise ValueError(f"official website must be http(s): {v!r}")
        return v


class ProductData(_Base):
    name: str
    description: Optional[str] = None
    original_category: Optional[str] = None   # organiser-assigned, if any
    ingredients: Optional[str] = None
    raw_materials: Optional[str] = None
    applications: Optional[str] = None
    product_type: Optional[str] = None
    services: Optional[str] = None
    source_url: str
    evidence_text: Optional[str] = None
    evidence_type: EvidenceType = EvidenceType.PROFILE_PRODUCT
    external_ref: Optional[str] = None        # site-specific ID, for de-duplication

    _c = field_validator("description", "original_category", "ingredients", "raw_materials",
                         "applications", "product_type", "services", "evidence_text", mode="before")(_clean)

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v):
        v = _clean(v)
        if not v:
            raise ValueError("product name is empty")
        return v


class DocumentRef(_Base):
    title: Optional[str] = None
    url: str
    doc_type: str = "brochure"   # brochure | press_release | catalogue | technical


class SourceRef(_Base):
    url: str
    source_type: str
    status: str = "ok"


class PageLog(_Base):
    url: str
    page_type: str
    status: str                  # ok | error | skipped
    error_message: Optional[str] = None


class ProfileResult(_Base):
    company: CompanyData
    products: list[ProductData] = Field(default_factory=list)
    documents: list[DocumentRef] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)
    pages: list[PageLog] = Field(default_factory=list)
    status: ExtractionStatus = ExtractionStatus.SUCCESS
    warnings: list[str] = Field(default_factory=list)


class CategoryAssignment(_Base):
    """A normalised category for a company, always with its evidence."""
    category: str
    basis: str                 # "event_sector (organiser-assigned)" | "keyword_rule (inferred)" ...
    supporting: str            # product names / sector names that support it
    evidence_text: str
    source_url: Optional[str] = None
