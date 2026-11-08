"""Crawl engine: runs an adapter against one event and persists everything.

The engine is adapter-agnostic. It owns:

* incremental saving (one SQLite transaction per company / listing page),
* resume (listing offset state + per-company extraction status),
* categorisation of products and companies,
* brochure / PDF processing,
* the crawl log and progress output.

Scrapy was evaluated for this layer and deliberately not used in v1: the
crawl is intentionally sequential and throttled (1 request/second/host), so
Scrapy's concurrency brings no benefit, while its Twisted reactor makes
interactive prompts, per-hop SSRF validation and per-company SQLite commits
(the basis of resume) harder. The adapter interface keeps that option open.
"""
from __future__ import annotations

import json
import time
import traceback
from dataclasses import dataclass

from adapters.base_adapter import BaseAdapter, ProfileContext
from config import Settings
from crawler.fetcher import FetchError, Fetcher, RobotsDisallowed
from database.models import ExtractionStatus
from database.repository import Repository
from extractors.pdf_extractor import extract_pdf, save_text
from extractors.product_extractor import Categorizer
from utils.logging import get_logger

log = get_logger("engine")


@dataclass
class RunCounters:
    listing_pages: int = 0
    new_exhibitors: int = 0
    profiles_done: int = 0
    pdfs_done: int = 0
    started: float = 0.0


class CrawlEngine:
    def __init__(self, settings: Settings, repo: Repository, fetcher: Fetcher, adapter: BaseAdapter, event_id: int):
        self.settings = settings
        self.repo = repo
        self.fetcher = fetcher
        self.adapter = adapter
        self.event_id = event_id
        self.categorizer = Categorizer(sector_overrides=adapter.sector_overrides)
        self.counters = RunCounters(started=time.time())

    # ---------------------------------------------------------------- listing
    def run_listing(self, directory_url: str, refresh: bool = False, max_exhibitors: int | None = None) -> None:
        event = self.repo.get_event(self.event_id)
        if event["listing_complete"] and not refresh:
            st = self.repo.stats(self.event_id)
            log.info("Listing already complete for this event (%d exhibitors stored); skipping. "
                     "Use --refresh-listing to re-scan.", st["discovered"])
            return
        state = {} if refresh else self.repo.get_listing_state(self.event_id)
        if state:
            log.info("Resuming directory listing from saved state %s", {k: v for k, v in state.items() if k != "visited"})
        try:
            for page in self.adapter.iter_listing(directory_url, state):
                new = 0
                for stub in page.stubs:
                    _, created = self.repo.add_stub(self.event_id, stub)
                    new += int(created)
                self.repo.commit()
                self.repo.set_listing_state(self.event_id, page.state)
                if page.expected_total:
                    self.repo.update_event(self.event_id, expected_total=page.expected_total)
                self.repo.log(self.event_id, page.page_url, "directory_listing", "ok",
                              page.note or f"{len(page.stubs)} exhibitors on page, {new} new")
                self.counters.listing_pages += 1
                self.counters.new_exhibitors += new
                total = self.repo.stats(self.event_id)["discovered"]
                exp = f" of {page.expected_total} reported" if page.expected_total else ""
                log.info("Listing page %d: %d exhibitors (%d new) - %d discovered%s",
                         self.counters.listing_pages, len(page.stubs), new, total, exp)
                if page.note:
                    log.warning("  note: %s", page.note)
                if max_exhibitors and total >= max_exhibitors:
                    log.info("Reached --max-exhibitors=%d; listing paused (resumable).", max_exhibitors)
                    return
                if page.done:
                    self.repo.update_event(self.event_id, listing_complete=1)
                    break
        except FetchError as exc:
            self.repo.log(self.event_id, exc.url, "directory_listing", "error", str(exc))
            log.error("Listing stopped: %s (%s). Re-run to resume from the last saved page.", exc, exc.url)
            raise
        st = self.repo.stats(self.event_id)
        event = self.repo.get_event(self.event_id)
        if event["expected_total"] and st["discovered"] != event["expected_total"]:
            log.warning("Directory reports %d exhibitors but %d unique profiles were stored "
                        "(duplicates across pages or listing changes).", event["expected_total"], st["discovered"])

    # --------------------------------------------------------------- profiles
    def run_profiles(self, limit: int | None = None, retry_failed: bool = True, refresh: bool = False) -> None:
        rows = self.repo.companies_to_process(self.event_id, retry_failed=retry_failed, refresh=refresh, limit=limit)
        if not rows:
            log.info("No exhibitor profiles left to process.")
            return
        log.info("Processing %d exhibitor profiles (sequential, %.1fs delay per host)", len(rows),
                 self.settings.request_delay)
        for i, row in enumerate(rows, 1):
            self._process_company(row, i, len(rows))

    def run_pending_documents(self) -> None:
        """Process brochures left pending by earlier runs (e.g. run with --no-pdf)."""
        if not self.settings.extract_pdfs:
            return
        rows = self.repo.conn.execute(
            "SELECT DISTINCT c.company_id, c.company_name FROM documents d JOIN companies c USING(company_id)"
            " WHERE c.event_id=? AND d.status='pending' ORDER BY c.seq", (self.event_id,)).fetchall()
        if rows:
            log.info("Processing pending brochures for %d companies", len(rows))
        for r in rows:
            ok, total = self.run_documents(r["company_id"], r["company_name"])
            log.info("  %s - PDFs %d/%d", r["company_name"], ok, total)

    def _process_company(self, row, i: int, n: int) -> None:
        cid, name = row["company_id"], row["company_name"]
        listing = json.loads(row["listing_data"] or "{}")
        ctx = ProfileContext(company_id=cid, name=name, profile_url=row["profile_url"], listing=listing)
        t0 = time.time()
        try:
            result = self.adapter.extract_profile(ctx)
        except RobotsDisallowed as exc:
            self.repo.mark_failed(cid, f"robots.txt disallows {exc.url}", ExtractionStatus.SKIPPED)
            self.repo.log(self.event_id, exc.url, "exhibitor_profile", "skipped", str(exc), cid, name)
            log.warning("[%d/%d] %s - skipped (robots.txt)", i, n, name)
            return
        except FetchError as exc:
            self.repo.mark_failed(cid, f"profile fetch failed: {exc}")
            self.repo.log(self.event_id, exc.url, "exhibitor_profile", "error", str(exc), cid, name)
            log.warning("[%d/%d] %s - FAILED: %s", i, n, name, exc)
            return
        except Exception as exc:  # noqa: BLE001 - one bad profile must not stop the crawl
            tb = traceback.format_exc(limit=3)
            self.repo.mark_failed(cid, f"parser error: {type(exc).__name__}: {exc}")
            self.repo.log(self.event_id, row["profile_url"], "exhibitor_profile", "error",
                          f"{type(exc).__name__}: {exc}\n{tb}", cid, name)
            log.warning("[%d/%d] %s - PARSER ERROR: %s", i, n, name, exc)
            return

        infos = [self.categorizer.classify_product(p) for p in result.products]
        cats = self.categorizer.company_categories(
            products=result.products, product_info=infos, sectors=result.company.event_sectors,
            description=result.company.description, new_products_text=result.company.new_products_text,
            profile_url=row["profile_url"])
        self.repo.save_profile(cid, result, infos, cats)

        pdf_note = ""
        if self.settings.extract_pdfs and result.documents:
            ok, total = self.run_documents(cid, name)
            pdf_note = f", PDFs {ok}/{total}"
        self.counters.profiles_done += 1
        n_prod = sum(1 for p in result.products if p.product_type != "Brand")
        n_brand = len(result.products) - n_prod
        st = self.repo.stats(self.event_id)
        mark = {"success": "ok", "partial": "partial"}.get(result.status.value, result.status.value)
        log.info("[%d/%d] %s - %s: %d products, %d brands%s (%.1fs) | totals: %d/%d processed, ok %d, partial %d, "
                 "failed %d, products %d, websites %d",
                 i, n, result.company.name or name, mark, n_prod, n_brand, pdf_note, time.time() - t0, st["processed"], st["discovered"],
                 st["success"], st["partial"], st["failed"], st["products"], st["websites"])
        for w in result.warnings:
            log.debug("    warning: %s", w)

    # -------------------------------------------------------------- documents
    def run_documents(self, company_id: str, company_name: str) -> tuple[int, int]:
        docs = self.repo.documents_for(company_id)[: self.settings.max_pdfs_per_company]
        ok = 0
        for d in docs:
            url = d["url"]
            try:
                resp = self.fetcher.get(url, max_bytes=self.settings.max_pdf_bytes)
                if not resp.ok:
                    raise FetchError(f"HTTP {resp.status}", url, resp.status)
            except FetchError as exc:
                self.repo.update_document(d["id"], status="error", error=str(exc)[:500])
                self.repo.add_source(company_id, self.event_id, url, f"{d['doc_type']}_pdf", "error")
                self.repo.log(self.event_id, url, f"{d['doc_type']}_pdf", "error", str(exc), company_id, company_name)
                continue
            pdf = extract_pdf(resp.content, self.settings.max_pdf_pages)
            if pdf.error:
                self.repo.update_document(d["id"], status="error", error=pdf.error, page_count=pdf.page_count)
                self.repo.add_source(company_id, self.event_id, url, f"{d['doc_type']}_pdf", "error")
                self.repo.log(self.event_id, url, f"{d['doc_type']}_pdf", "error", pdf.error, company_id, company_name)
                continue
            status = "image_only" if pdf.image_only else "ok"
            path = None
            if pdf.text:
                path = save_text(pdf.text, self.settings.raw_dir / "pdf_text", company_id, url)
            self.repo.update_document(d["id"], status=status, page_count=pdf.page_count, text_chars=pdf.text_chars,
                                      text_path=str(path.relative_to(self.settings.raw_dir.parent.parent)) if path else None,
                                      error="no text layer (scanned/image PDF; OCR not performed)" if pdf.image_only else None)
            if pdf.text and not pdf.image_only:
                cats = self.categorizer.pdf_categories(pdf.text, url, d["title"])
                self.repo.add_pdf_products_and_categories(company_id, [], cats)
            self.repo.add_source(company_id, self.event_id, url, f"{d['doc_type']}_pdf", status)
            self.repo.log(self.event_id, url, f"{d['doc_type']}_pdf", "ok",
                          f"{pdf.page_count} pages, {pdf.text_chars} chars" + (" (image-only)" if pdf.image_only else ""),
                          company_id, company_name)
            ok += 1
            self.counters.pdfs_done += 1
        return ok, len(docs)

    # ------------------------------------------------------------ reclassify
    def reclassify(self) -> int:
        """Recompute all derived categories from stored data (no network)."""
        from database.models import EvidenceType, ProductData, SectorEntry
        n = 0
        for row in self.repo.iter_event_companies(self.event_id).fetchall():
            if row["extraction_status"] == "pending":
                continue
            prows = self.repo.products_for(row["company_id"])
            products, updates = [], []
            for pr in prows:
                p = ProductData(name=pr["product_name"], description=pr["product_description"],
                                product_type="Brand" if pr["product_type"] == "Brand" else None,
                                source_url=pr["source_url"], evidence_type=EvidenceType(pr["evidence_type"]))
                info = self.categorizer.classify_product(p)
                products.append(p)
                updates.append((pr["product_id"], info))
            sectors = [SectorEntry(**s) for s in json.loads(row["event_sectors"] or "[]")]
            cats = self.categorizer.company_categories(
                products=products, product_info=[u[1] for u in updates], sectors=sectors,
                description=row["description"], new_products_text=row["new_products_text"],
                profile_url=row["profile_url"])
            for d in self.repo.documents_for(row["company_id"], only_pending=False):
                if d["status"] == "ok" and d["text_path"]:
                    path = self.settings.raw_dir.parent.parent / d["text_path"]
                    if path.exists():
                        cats += self.categorizer.pdf_categories(path.read_text(encoding="utf-8"), d["url"], d["title"])
            self.repo.replace_classification(row["company_id"], updates, cats)
            n += 1
        return n

    # --------------------------------------------------------------- summary
    def summary(self) -> dict:
        st = self.repo.stats(self.event_id)
        st["elapsed_s"] = round(time.time() - self.counters.started, 1)
        st["requests"] = self.fetcher.request_count
        return st

