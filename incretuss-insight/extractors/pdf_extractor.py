"""PDF / brochure text extraction with PyMuPDF.

The extractor never invents product rows from free-form brochure prose. It
returns the document text (saved to ``data/raw/pdf_text`` for later review or
LLM analysis), detects image-only PDFs that need OCR, and hands the text to
the categoriser so categories can be supported by quoted PDF evidence.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

import pymupdf

from extractors.product_extractor import labelled_fields


@dataclass
class PdfResult:
    page_count: int
    pages_read: int
    text: str
    text_chars: int
    image_only: bool
    fields: dict
    error: str | None = None


def extract_pdf(content: bytes, max_pages: int = 40) -> PdfResult:
    if not content.startswith(b"%PDF"):
        head = content[:200].decode("latin-1", "replace").lower()
        kind = "HTML page" if "<html" in head or "<!doctype" in head else "non-PDF content"
        return PdfResult(0, 0, "", 0, False, {}, error=f"not a PDF (received {kind})")
    try:
        doc = pymupdf.open(stream=content, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 - corrupt PDFs raise many types
        return PdfResult(0, 0, "", 0, False, {}, error=f"could not open PDF: {exc}")
    with doc:
        if doc.needs_pass:
            return PdfResult(doc.page_count, 0, "", 0, False, {}, error="password-protected PDF (not accessed)")
        pages = min(doc.page_count, max_pages)
        texts = []
        for i in range(pages):
            try:
                texts.append(doc[i].get_text("text"))
            except Exception as exc:  # noqa: BLE001
                texts.append(f"\n[page {i + 1} unreadable: {exc}]\n")
        text = "\n".join(texts)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        image_only = len(text) < 40 * max(pages, 1)
        return PdfResult(doc.page_count, pages, text, len(text), image_only, labelled_fields(text))


def save_text(text: str, out_dir: Path, company_id: str, url: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha1(url.encode()).hexdigest()[:10]
    path = out_dir / f"{company_id}_{h}.txt"
    path.write_text(f"SOURCE: {url}\n\n{text}", encoding="utf-8")
    return path
