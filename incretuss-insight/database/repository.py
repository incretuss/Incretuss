"""Data-access layer. All SQL lives here."""
from __future__ import annotations

import json
import sqlite3
from typing import Iterable, Optional

from database.models import (
    CategoryAssignment, DocumentRef, ExhibitorStub, ExtractionStatus, PageLog, ProfileResult, utcnow,
)
from utils.url_utils import normalize_url


class Repository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    # ------------------------------------------------------------------ events
    def get_or_create_event(self, directory_url: str, name: str | None, start_url: str | None,
                            adapter: str | None) -> sqlite3.Row:
        norm = normalize_url(directory_url)
        row = self.conn.execute("SELECT * FROM events WHERE directory_url_norm=?", (norm,)).fetchone()
        now = utcnow()
        if row is None:
            self.conn.execute(
                "INSERT INTO events(name, start_url, directory_url, directory_url_norm, adapter, created_at, updated_at)"
                " VALUES (?,?,?,?,?,?,?)", (name, start_url, directory_url, norm, adapter, now, now))
            self.conn.commit()
            row = self.conn.execute("SELECT * FROM events WHERE directory_url_norm=?", (norm,)).fetchone()
        else:
            updates = {}
            if name and not row["name"]:
                updates["name"] = name
            if adapter and row["adapter"] != adapter:
                updates["adapter"] = adapter
            if updates:
                self.update_event(row["event_id"], **updates)
                row = self.get_event(row["event_id"])
        return row

    def get_event(self, event_id: int) -> sqlite3.Row:
        return self.conn.execute("SELECT * FROM events WHERE event_id=?", (event_id,)).fetchone()

    def list_events(self) -> list[sqlite3.Row]:
        return self.conn.execute("SELECT * FROM events ORDER BY event_id").fetchall()

    def update_event(self, event_id: int, **fields) -> None:
        if not fields:
            return
        fields["updated_at"] = utcnow()
        cols = ", ".join(f"{k}=?" for k in fields)
        self.conn.execute(f"UPDATE events SET {cols} WHERE event_id=?", (*fields.values(), event_id))
        self.conn.commit()

    def get_listing_state(self, event_id: int) -> dict:
        row = self.get_event(event_id)
        return json.loads(row["listing_state"]) if row and row["listing_state"] else {}

    def set_listing_state(self, event_id: int, state: dict) -> None:
        self.update_event(event_id, listing_state=json.dumps(state))

    # --------------------------------------------------------------- companies
    def add_stub(self, event_id: int, stub: ExhibitorStub) -> tuple[str, bool]:
        """Insert an exhibitor discovered in the listing. Returns (company_id, is_new).

        De-duplication key: normalised exhibitor-profile URL within the event.
        """
        norm = normalize_url(stub.profile_url)
        row = self.conn.execute("SELECT company_id FROM companies WHERE event_id=? AND profile_url_norm=?",
                                (event_id, norm)).fetchone()
        listing = stub.model_dump(exclude={"extra"}) | {"extra": stub.extra}
        if row:
            self.conn.execute("UPDATE companies SET listing_data=? WHERE company_id=?",
                              (json.dumps(listing, ensure_ascii=False), row["company_id"]))
            return row["company_id"], False
        seq = (self.conn.execute("SELECT COALESCE(MAX(seq),0)+1 FROM companies WHERE event_id=?",
                                 (event_id,)).fetchone()[0])
        company_id = f"E{event_id:02d}-C{seq:04d}"
        self.conn.execute(
            "INSERT INTO companies(company_id, event_id, seq, company_name, profile_url, profile_url_norm,"
            " official_website, country, city, hall, booth, listing_data, extraction_status, discovered_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (company_id, event_id, seq, stub.name, stub.profile_url, norm, stub.website, stub.country,
             stub.city, stub.hall, stub.booth, json.dumps(listing, ensure_ascii=False),
             ExtractionStatus.PENDING.value, utcnow()))
        if stub.listing_url:
            self._add_source(company_id, event_id, stub.listing_url, "directory_listing", "ok")
        return company_id, True

    def commit(self) -> None:
        self.conn.commit()

    def get_company(self, company_id: str) -> sqlite3.Row:
        return self.conn.execute("SELECT * FROM companies WHERE company_id=?", (company_id,)).fetchone()

    def companies_to_process(self, event_id: int, retry_failed: bool = True, refresh: bool = False,
                             limit: int | None = None, max_retries: int = 3) -> list[sqlite3.Row]:
        if refresh:
            where, params = "event_id=?", [event_id]
        else:
            statuses = ["pending"] + (["failed", "partial"] if retry_failed else [])
            where = f"event_id=? AND extraction_status IN ({','.join('?' * len(statuses))})"
            params = [event_id, *statuses]
            if retry_failed:
                where += " AND (extraction_status='pending' OR retry_count < ?)"
                params.append(max_retries)
        sql = f"SELECT * FROM companies WHERE {where} ORDER BY seq"
        if limit:
            sql += f" LIMIT {int(limit)}"
        return self.conn.execute(sql, params).fetchall()

    def mark_failed(self, company_id: str, reason: str, status: ExtractionStatus = ExtractionStatus.FAILED) -> None:
        self.conn.execute(
            "UPDATE companies SET extraction_status=?, failure_reason=?, retry_count=retry_count+1, extracted_at=?"
            " WHERE company_id=?", (status.value, reason[:2000], utcnow(), company_id))
        self.conn.commit()

    def save_profile(self, company_id: str, result: ProfileResult, product_enrichment: list[dict],
                     categories: list[CategoryAssignment]) -> None:
        """Persist one company's extraction atomically (replaces earlier extraction)."""
        c = result.company
        row = self.get_company(company_id)
        event_id = row["event_id"]
        now = utcnow()
        with self.conn:
            self.conn.execute(
                """UPDATE companies SET
                    company_name=COALESCE(?, company_name), official_website=COALESCE(?, official_website),
                    country=COALESCE(?, country), city=COALESCE(?, city), industry=?, description=?,
                    new_products_text=?, email=?, phone=?, hall=COALESCE(?, hall), booth=COALESCE(?, booth),
                    event_sectors=?, extraction_status=?, failure_reason=?, warnings=?, extracted_at=?,
                    retry_count=CASE WHEN ?='success' THEN retry_count ELSE retry_count+1 END
                   WHERE company_id=?""",
                (c.name, c.official_website, c.country, c.city, c.industry, c.description, c.new_products_text,
                 c.email, c.phone, c.hall, c.booth,
                 json.dumps([s.model_dump() for s in c.event_sectors], ensure_ascii=False),
                 result.status.value, "; ".join(result.warnings) or None,
                 json.dumps(result.warnings, ensure_ascii=False) if result.warnings else None, now,
                 result.status.value, company_id))
            self.conn.execute("DELETE FROM products WHERE company_id=?", (company_id,))
            for p, extra in zip(result.products, product_enrichment):
                self.conn.execute(
                    """INSERT INTO products(company_id, product_name, product_category, original_category,
                        category_basis, product_description, ingredients, raw_materials, applications,
                        product_type, services, source_url, evidence_text, evidence_type, external_ref, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (company_id, p.name, extra.get("product_category"), p.original_category,
                     extra.get("category_basis"), p.description, p.ingredients, p.raw_materials, p.applications,
                     extra.get("product_type") or p.product_type, p.services, p.source_url, p.evidence_text,
                     p.evidence_type.value, p.external_ref, now))
            self.conn.execute("DELETE FROM company_categories WHERE company_id=?", (company_id,))
            for cat in categories:
                self.conn.execute(
                    "INSERT OR IGNORE INTO company_categories(company_id, category, basis, supporting, evidence_text,"
                    " source_url) VALUES (?,?,?,?,?,?)",
                    (company_id, cat.category, cat.basis, cat.supporting, cat.evidence_text, cat.source_url))
            # Documents are re-queued whenever a profile is (re-)extracted, because
            # PDF-derived products/categories were just cleared above.
            self.conn.execute("DELETE FROM documents WHERE company_id=?", (company_id,))
            for d in result.documents:
                self.conn.execute(
                    "INSERT OR IGNORE INTO documents(company_id, title, url, doc_type, status)"
                    " VALUES (?,?,?,?, 'pending')", (company_id, d.title, d.url, d.doc_type))
            for s in result.sources:
                self._add_source(company_id, event_id, s.url, s.source_type, s.status)
            for pg in result.pages:
                self._log(event_id, company_id, row["company_name"], pg)

    def replace_classification(self, company_id: str, product_updates: list[tuple[int, dict]],
                               categories: list[CategoryAssignment]) -> None:
        """Rewrite derived categories for a company (used by --reclassify)."""
        with self.conn:
            for product_id, info in product_updates:
                self.conn.execute("UPDATE products SET product_category=?, category_basis=?, product_type=?"
                                  " WHERE product_id=?", (info.get("product_category"), info.get("category_basis"),
                                                          info.get("product_type"), product_id))
            self.conn.execute("DELETE FROM company_categories WHERE company_id=?", (company_id,))
            for cat in categories:
                self.conn.execute(
                    "INSERT OR IGNORE INTO company_categories(company_id, category, basis, supporting, evidence_text,"
                    " source_url) VALUES (?,?,?,?,?,?)",
                    (company_id, cat.category, cat.basis, cat.supporting, cat.evidence_text, cat.source_url))

    def products_for(self, company_id: str) -> list[sqlite3.Row]:
        return self.conn.execute("SELECT * FROM products WHERE company_id=? ORDER BY product_id",
                                 (company_id,)).fetchall()

    # --------------------------------------------------------------- documents
    def documents_for(self, company_id: str, only_pending: bool = True) -> list[sqlite3.Row]:
        sql = "SELECT * FROM documents WHERE company_id=?"
        if only_pending:
            sql += " AND status IN ('pending', 'error')"
        return self.conn.execute(sql + " ORDER BY id", (company_id,)).fetchall()

    def update_document(self, doc_id: int, **fields) -> None:
        fields.setdefault("retrieved_at", utcnow())
        cols = ", ".join(f"{k}=?" for k in fields)
        self.conn.execute(f"UPDATE documents SET {cols} WHERE id=?", (*fields.values(), doc_id))
        self.conn.commit()

    def add_pdf_products_and_categories(self, company_id: str, products: list[tuple],
                                        categories: list[CategoryAssignment]) -> None:
        now = utcnow()
        with self.conn:
            for (p, extra) in products:
                self.conn.execute(
                    """INSERT INTO products(company_id, product_name, product_category, original_category,
                        category_basis, product_description, ingredients, raw_materials, applications,
                        product_type, services, source_url, evidence_text, evidence_type, external_ref, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (company_id, p.name, extra.get("product_category"), p.original_category,
                     extra.get("category_basis"), p.description, p.ingredients, p.raw_materials, p.applications,
                     extra.get("product_type") or p.product_type, p.services, p.source_url, p.evidence_text,
                     p.evidence_type.value, p.external_ref, now))
            for cat in categories:
                self.conn.execute(
                    "INSERT OR IGNORE INTO company_categories(company_id, category, basis, supporting, evidence_text,"
                    " source_url) VALUES (?,?,?,?,?,?)",
                    (company_id, cat.category, cat.basis, cat.supporting, cat.evidence_text, cat.source_url))

    # ----------------------------------------------------------- sources / log
    def _add_source(self, company_id: Optional[str], event_id: int, url: str, source_type: str, status: str) -> None:
        self.conn.execute(
            "INSERT INTO sources(company_id, event_id, url, source_type, retrieval_date, status) VALUES (?,?,?,?,?,?)"
            " ON CONFLICT(company_id, url, source_type) DO UPDATE SET retrieval_date=excluded.retrieval_date,"
            " status=excluded.status", (company_id, event_id, url, source_type, utcnow(), status))

    def add_source(self, company_id: Optional[str], event_id: int, url: str, source_type: str, status: str) -> None:
        self._add_source(company_id, event_id, url, source_type, status)
        self.conn.commit()

    def _log(self, event_id: int, company_id: Optional[str], company_name: Optional[str], pg: PageLog) -> None:
        self.conn.execute(
            "INSERT INTO crawl_log(event_id, company_id, company_name, url, page_type, status, error_message,"
            " timestamp) VALUES (?,?,?,?,?,?,?,?)",
            (event_id, company_id, company_name, pg.url, pg.page_type, pg.status, pg.error_message, utcnow()))

    def log(self, event_id: int, url: str, page_type: str, status: str, error: str | None = None,
            company_id: str | None = None, company_name: str | None = None) -> None:
        self._log(event_id, company_id, company_name,
                  PageLog(url=url, page_type=page_type, status=status, error_message=error))
        self.conn.commit()

    # ------------------------------------------------------------------ stats
    def stats(self, event_id: int) -> dict:
        q = self.conn.execute
        by_status = dict(q("SELECT extraction_status, COUNT(*) FROM companies WHERE event_id=? GROUP BY 1",
                           (event_id,)).fetchall())
        products = q("SELECT COUNT(*) FROM products p JOIN companies c USING(company_id) WHERE c.event_id=?"
                     " AND p.product_type IS NOT 'Brand'", (event_id,)).fetchone()[0]
        brands = q("SELECT COUNT(*) FROM products p JOIN companies c USING(company_id) WHERE c.event_id=?"
                   " AND p.product_type='Brand'", (event_id,)).fetchone()[0]
        websites = q("SELECT COUNT(*) FROM companies WHERE event_id=? AND official_website IS NOT NULL",
                     (event_id,)).fetchone()[0]
        docs = dict(q("SELECT d.status, COUNT(*) FROM documents d JOIN companies c USING(company_id)"
                      " WHERE c.event_id=? GROUP BY 1", (event_id,)).fetchall())
        total = sum(by_status.values())
        return {
            "discovered": total,
            "processed": total - by_status.get("pending", 0),
            "success": by_status.get("success", 0),
            "partial": by_status.get("partial", 0),
            "failed": by_status.get("failed", 0) + by_status.get("skipped", 0),
            "pending": by_status.get("pending", 0),
            "products": products,
            "brands": brands,
            "websites": websites,
            "documents": docs,
        }

    # ----------------------------------------------------------------- export
    def export_rows(self, event_id: int) -> dict[str, list[sqlite3.Row]]:
        q = lambda sql: self.conn.execute(sql, (event_id,)).fetchall()  # noqa: E731
        return {
            "companies": q("SELECT * FROM companies WHERE event_id=? ORDER BY seq"),
            "products": q("SELECT p.*, c.company_name, c.seq FROM products p JOIN companies c USING(company_id)"
                          " WHERE c.event_id=? ORDER BY c.seq, p.product_id"),
            "categories": q("SELECT cc.*, c.company_name, c.seq FROM company_categories cc"
                            " JOIN companies c USING(company_id) WHERE c.event_id=? ORDER BY c.seq, cc.category"),
            "sources": q("SELECT * FROM sources WHERE event_id=? ORDER BY company_id, id"),
            "documents": q("SELECT d.*, c.company_name FROM documents d JOIN companies c USING(company_id)"
                           " WHERE c.event_id=? ORDER BY c.seq, d.id"),
            "log": q("SELECT * FROM crawl_log WHERE event_id=? ORDER BY id"),
        }

    def iter_event_companies(self, event_id: int) -> Iterable[sqlite3.Row]:
        return self.conn.execute("SELECT * FROM companies WHERE event_id=? ORDER BY seq", (event_id,))
