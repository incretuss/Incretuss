"""Standardised Excel export (SQLite -> Event_Exhibitor_Database.xlsx).

Sheets 1-6 follow the agreed specification column-for-column. A few extra
columns are appended at the *end* of some sheets (never re-ordering the
specified ones) where they are needed to keep explicit and inferred data
apart, e.g. ``Category_Basis``. Two extra sheets follow: ``Documents`` and
``About`` (run metadata and a field glossary).
"""
from __future__ import annotations

import json
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from openpyxl import load_workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from database.repository import Repository
from extractors.product_extractor import NORMALIZED_CATEGORIES
from utils.deduplication import find_possible_duplicates

MAX_CELL = 32000
WIDE_COLUMNS = {"Company_Description", "Product_Description", "Evidence_Text", "Supporting_Products",
                "Event_Sectors", "Error_Message", "Notes", "New_Products_Statement", "Failure_Reason",
                "Extraction_Notes", "Value"}
URL_COLUMNS = {"Official_Website", "Exhibitor_Profile_URL", "Source_URL", "URL", "Available_Website"}

HEADER_FILL = PatternFill("solid", fgColor="1F4E78")
HEADER_FONT = Font(bold=True, color="FFFFFF")


def _clean(v):
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    if isinstance(v, str):
        v = ILLEGAL_CHARACTERS_RE.sub("", v)
        if len(v) > MAX_CELL:
            v = v[:MAX_CELL] + " …[truncated]"
        # openpyxl stores any string starting with "=" as a formula; scraped
        # text must never become a formula.
        if v.startswith("="):
            v = " " + v
    return v


def _sectors_text(raw: str | None) -> str | None:
    if not raw:
        return None
    items = json.loads(raw)
    parts = [f"{s['sector']}: {', '.join(s['subsectors'])}" if s.get("subsectors") else s["sector"] for s in items]
    return " | ".join(parts) or None


def _cat_order(c: str) -> int:
    return NORMALIZED_CATEGORIES.index(c) if c in NORMALIZED_CATEGORIES else 999


class ExcelExporter:
    def __init__(self, repo: Repository):
        self.repo = repo

    def build_frames(self, event_id: int) -> "OrderedDict[str, pd.DataFrame]":
        rows = self.repo.export_rows(event_id)
        event = self.repo.get_event(event_id)
        companies = rows["companies"]

        products_by_company = defaultdict(list)
        for p in rows["products"]:
            products_by_company[p["company_id"]].append(p)
        cats_by_company = defaultdict(list)
        for c in rows["categories"]:
            cats_by_company[c["company_id"]].append(c)
        dupes = find_possible_duplicates([dict(c) for c in companies])

        # ---- Sheet 1: Company_Master
        master = []
        for c in companies:
            prods = [p for p in products_by_company[c["company_id"]] if p["product_type"] != "Brand"]
            brands = [p["product_name"] for p in products_by_company[c["company_id"]] if p["product_type"] == "Brand"]
            cats = sorted({x["category"] for x in cats_by_company[c["company_id"]]}, key=_cat_order)
            if c["extraction_status"] == "pending":
                cat_text = None
            else:
                cat_text = "; ".join(cats) if cats else "Unclassified"
            master.append({
                "Company_ID": c["company_id"],
                "Company_Name": c["company_name"],
                "Official_Website": c["official_website"],
                "Exhibitor_Profile_URL": c["profile_url"],
                "Country": c["country"],
                "City": c["city"],
                "Industry": c["industry"],
                "Company_Description": c["description"],
                "Email": c["email"],
                "Phone": c["phone"],
                "Hall_Number": c["hall"],
                "Booth_Number": c["booth"],
                "Event_Sectors": _sectors_text(c["event_sectors"]),
                "Product_Categories": cat_text,
                "Number_of_Products": len(prods) if c["extraction_status"] != "pending" else None,
                "Extraction_Status": c["extraction_status"],
                # --- appended columns
                "Brands": "; ".join(brands) or None,
                "New_Products_Statement": c["new_products_text"],
                "Possible_Duplicates": "; ".join(dupes.get(c["company_id"], [])) or None,
                "Extraction_Notes": c["failure_reason"],
                "Extracted_At": c["extracted_at"],
            })

        # ---- Sheet 2: Product_Catalogue
        catalogue = [{
            "Company_ID": p["company_id"],
            "Company_Name": p["company_name"],
            "Product_Name": p["product_name"],
            "Product_Category": p["product_category"],
            "Product_Description": p["product_description"],
            "Ingredients": p["ingredients"],
            "Raw_Materials": p["raw_materials"],
            "Applications": p["applications"],
            "Product_Type": p["product_type"],
            "Services": p["services"],
            "Source_URL": p["source_url"],
            "Evidence_Text": p["evidence_text"],
            "Evidence_Type": p["evidence_type"],
            # --- appended
            "Original_Category": p["original_category"],
            "Category_Basis": p["category_basis"],
        } for p in rows["products"]]

        # ---- Sheet 3: Product_Categories (one row per company-category)
        cat_rows = []
        name_of = {c["company_id"]: c["company_name"] for c in companies}
        for cid, entries in cats_by_company.items():
            by_cat = OrderedDict()
            for e in sorted(entries, key=lambda e: (_cat_order(e["category"]), e["basis"])):
                by_cat.setdefault(e["category"], []).append(e)
            for cat, es in by_cat.items():
                urls = list(dict.fromkeys(e["source_url"] for e in es if e["source_url"]))
                cat_rows.append({
                    "Company_ID": cid,
                    "Company_Name": name_of.get(cid),
                    "Product_Category": cat,
                    "Supporting_Products": " || ".join(f"[{e['basis'].split(' ')[0]}] {e['supporting']}" for e in es),
                    "Source_URL": "\n".join(urls) or None,
                    # --- appended
                    "Basis": "; ".join(e["basis"] for e in es),
                    "Evidence_Text": " || ".join(e["evidence_text"] for e in es if e["evidence_text"]),
                })
        cat_rows.sort(key=lambda r: (r["Company_ID"], _cat_order(r["Product_Category"])))

        # ---- Sheet 4: Sources
        sources = [{
            "Company_ID": s["company_id"],
            "Source_URL": s["url"],
            "Source_Type": s["source_type"],
            "Retrieval_Date": s["retrieval_date"],
            "Extraction_Status": s["status"],
        } for s in rows["sources"]]

        # ---- Sheet 5: Crawl_Log
        log_rows = [{
            "Company_ID": r["company_id"],
            "Company_Name": r["company_name"],
            "URL": r["url"],
            "Page_Type": r["page_type"],
            "Crawl_Status": r["status"],
            "Error_Message": r["error_message"] if r["status"] != "ok" else None,
            "Timestamp": r["timestamp"],
            # --- appended
            "Notes": r["error_message"] if r["status"] == "ok" else None,
        } for r in rows["log"]]

        # ---- Sheet 6: Unprocessed_Companies
        unprocessed = []
        for c in companies:
            st = c["extraction_status"]
            if st == "success":
                continue
            if st == "pending":
                reason, retry = "not yet processed", "pending - will be processed on next run"
            elif st == "skipped":
                reason, retry = c["failure_reason"], "not retried (access restriction)"
            else:
                reason = c["failure_reason"] or st
                retry = (f"attempt {c['retry_count']}/3 - will retry on next run" if c["retry_count"] < 3
                         else "max retries reached")
                if st == "partial":
                    retry = "partial data saved; " + retry
            unprocessed.append({
                "Company_Name": c["company_name"],
                "Exhibitor_Profile_URL": c["profile_url"],
                "Available_Website": c["official_website"],
                "Failure_Reason": reason,
                "Retry_Status": retry,
            })

        # ---- Extra: Documents
        documents = [{
            "Company_ID": d["company_id"],
            "Company_Name": d["company_name"],
            "Document_Title": d["title"],
            "Document_Type": d["doc_type"],
            "Source_URL": d["url"],
            "Status": d["status"],
            "Pages": d["page_count"],
            "Text_Characters": d["text_chars"],
            "Extracted_Text_File": d["text_path"],
            "Notes": d["error"],
        } for d in rows["documents"]]

        st = self.repo.stats(event_id)
        about = [
            ("Event", event["name"]), ("Start URL", event["start_url"]), ("Directory URL", event["directory_url"]),
            ("Adapter", event["adapter"]), ("Directory-reported total", event["expected_total"]),
            ("Exhibitors stored", st["discovered"]), ("Profiles processed", st["processed"]),
            ("Successful", st["success"]), ("Partial", st["partial"]), ("Failed/skipped", st["failed"]),
            ("Products", st["products"]), ("Brands", st["brands"]), ("Official websites found", st["websites"]),
            ("Exported at (UTC)", datetime.now(timezone.utc).replace(microsecond=0).isoformat()),
            ("", ""),
            ("Data rules", "Nothing is fabricated. Empty cells mean the source did not publish the value."),
            ("Company_Name", "Exactly as published by the organiser (CSS upper-casing on the site is not applied)."),
            ("Event_Sectors", "Organiser-assigned sectors, verbatim: 'Sector: sub-sector, ...' separated by ' | '."),
            ("Product_Categories", "Normalised categories, each backed by evidence on the Product_Categories sheet."),
            ("Category_Basis / Basis", "event_sector = organiser sector mapped to a normalised category; "
                                       "'keyword rule (inferred)' = derived from published text by a keyword rule."),
            ("Product_Type", "Brand = listed on the Brands tab. Equipment/Ingredient/Service is inferred from the "
                             "product's normalised category."),
            ("Number_of_Products", "Products only (brands excluded)."),
            ("Unclassified", "No explicit evidence for any normalised category."),
            ("Possible_Duplicates", "Flag only - records are never merged on name similarity."),
            ("Email / Phone", "Only contact details visibly published on the profile; hidden/commented data is "
                              "not collected."),
        ]
        about_df = pd.DataFrame(about, columns=["Field", "Value"])

        return OrderedDict([
            ("Company_Master", pd.DataFrame(master)),
            ("Product_Catalogue", pd.DataFrame(catalogue, columns=[
                "Company_ID", "Company_Name", "Product_Name", "Product_Category", "Product_Description",
                "Ingredients", "Raw_Materials", "Applications", "Product_Type", "Services", "Source_URL",
                "Evidence_Text", "Evidence_Type", "Original_Category", "Category_Basis"])),
            ("Product_Categories", pd.DataFrame(cat_rows, columns=[
                "Company_ID", "Company_Name", "Product_Category", "Supporting_Products", "Source_URL", "Basis",
                "Evidence_Text"])),
            ("Sources", pd.DataFrame(sources, columns=[
                "Company_ID", "Source_URL", "Source_Type", "Retrieval_Date", "Extraction_Status"])),
            ("Crawl_Log", pd.DataFrame(log_rows, columns=[
                "Company_ID", "Company_Name", "URL", "Page_Type", "Crawl_Status", "Error_Message", "Timestamp",
                "Notes"])),
            ("Unprocessed_Companies", pd.DataFrame(unprocessed, columns=[
                "Company_Name", "Exhibitor_Profile_URL", "Available_Website", "Failure_Reason", "Retry_Status"])),
            ("Documents", pd.DataFrame(documents, columns=[
                "Company_ID", "Company_Name", "Document_Title", "Document_Type", "Source_URL", "Status", "Pages",
                "Text_Characters", "Extracted_Text_File", "Notes"])),
            ("About", about_df),
        ])

    def export(self, event_id: int, path: Path) -> Path:
        frames = self.build_frames(event_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with pd.ExcelWriter(path, engine="openpyxl") as xw:
            for name, df in frames.items():
                df = df.map(_clean) if not df.empty else df
                df.to_excel(xw, sheet_name=name, index=False)
        self._format(path)
        return path

    @staticmethod
    def _format(path: Path) -> None:
        wb = load_workbook(path)
        for ws in wb.worksheets:
            headers = [c.value for c in ws[1]]
            for cell in ws[1]:
                cell.fill = HEADER_FILL
                cell.font = HEADER_FONT
                cell.alignment = Alignment(vertical="center", wrap_text=False)
            ws.freeze_panes = "A2" if ws.title == "About" else "C2" if ws.title in (
                "Company_Master", "Product_Catalogue", "Product_Categories") else "A2"
            if ws.max_row > 1 and ws.title != "About":
                ws.auto_filter.ref = ws.dimensions
            for idx, h in enumerate(headers, 1):
                letter = get_column_letter(idx)
                values = [str(c.value) for c in ws[letter][1:200] if c.value is not None]
                longest = max([len(h or "")] + [min(len(v), 120) for v in values])
                if h in WIDE_COLUMNS:
                    width = 70
                elif h in URL_COLUMNS:
                    width = min(max(longest, 25), 60)
                else:
                    width = min(max(longest + 2, 10), 45)
                ws.column_dimensions[letter].width = width
                wrap = h in WIDE_COLUMNS
                for cell in ws[letter][1:]:
                    if wrap:
                        cell.alignment = Alignment(wrap_text=True, vertical="top")
                    else:
                        cell.alignment = Alignment(vertical="top")
                    if h in URL_COLUMNS and isinstance(cell.value, str) and cell.value.startswith("http") \
                            and "\n" not in cell.value:
                        cell.hyperlink = cell.value
                        cell.font = Font(color="0563C1", underline="single")
            # keep rows readable: cap row height for wrapped text
            for r in range(2, ws.max_row + 1):
                ws.row_dimensions[r].height = None
        wb.save(path)
