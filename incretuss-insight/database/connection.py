"""SQLite connection and schema.

SQLite is the persistent store; Excel is only an export. WAL mode plus a
commit after every company makes crawls safe to interrupt at any point.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS events (
    event_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT,
    start_url         TEXT,
    directory_url     TEXT NOT NULL,
    directory_url_norm TEXT NOT NULL UNIQUE,
    adapter           TEXT,
    listing_complete  INTEGER NOT NULL DEFAULT 0,
    listing_state     TEXT,
    expected_total    INTEGER,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
    company_id        TEXT PRIMARY KEY,
    event_id          INTEGER NOT NULL REFERENCES events(event_id),
    seq               INTEGER NOT NULL,
    company_name      TEXT NOT NULL,
    profile_url       TEXT NOT NULL,
    profile_url_norm  TEXT NOT NULL,
    official_website  TEXT,
    country           TEXT,
    city              TEXT,
    industry          TEXT,
    description       TEXT,
    new_products_text TEXT,
    email             TEXT,
    phone             TEXT,
    hall              TEXT,
    booth             TEXT,
    event_sectors     TEXT,          -- JSON list of {sector, subsectors}
    listing_data      TEXT,          -- JSON of what the directory listing showed
    extraction_status TEXT NOT NULL DEFAULT 'pending',
    failure_reason    TEXT,
    warnings          TEXT,
    retry_count       INTEGER NOT NULL DEFAULT 0,
    discovered_at     TEXT NOT NULL,
    extracted_at      TEXT,
    UNIQUE (event_id, profile_url_norm),
    UNIQUE (event_id, seq)
);
CREATE INDEX IF NOT EXISTS ix_companies_status ON companies(event_id, extraction_status);

CREATE TABLE IF NOT EXISTS products (
    product_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id        TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    product_name      TEXT NOT NULL,
    product_category  TEXT,
    original_category TEXT,
    category_basis    TEXT,
    product_description TEXT,
    ingredients       TEXT,
    raw_materials     TEXT,
    applications      TEXT,
    product_type      TEXT,
    services          TEXT,
    source_url        TEXT NOT NULL,
    evidence_text     TEXT,
    evidence_type     TEXT NOT NULL,
    external_ref      TEXT,
    created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_products_company ON products(company_id);

CREATE TABLE IF NOT EXISTS company_categories (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id        TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    category          TEXT NOT NULL,
    basis             TEXT NOT NULL,
    supporting        TEXT,
    evidence_text     TEXT,
    source_url        TEXT,
    UNIQUE (company_id, category, basis)
);

CREATE TABLE IF NOT EXISTS documents (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id        TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    title             TEXT,
    url               TEXT NOT NULL,
    doc_type          TEXT,
    status            TEXT NOT NULL DEFAULT 'pending',
    page_count        INTEGER,
    text_chars        INTEGER,
    text_path         TEXT,
    error             TEXT,
    retrieved_at      TEXT,
    UNIQUE (company_id, url)
);

CREATE TABLE IF NOT EXISTS sources (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id        TEXT REFERENCES companies(company_id) ON DELETE CASCADE,
    event_id          INTEGER,
    url               TEXT NOT NULL,
    source_type       TEXT NOT NULL,
    retrieval_date    TEXT NOT NULL,
    status            TEXT NOT NULL,
    UNIQUE (company_id, url, source_type)
);

CREATE TABLE IF NOT EXISTS crawl_log (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id          INTEGER,
    company_id        TEXT,
    company_name      TEXT,
    url               TEXT,
    page_type         TEXT,
    status            TEXT,
    error_message     TEXT,
    timestamp         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_log_event ON crawl_log(event_id);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.executescript(SCHEMA)
    conn.execute("INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', ?)", (str(SCHEMA_VERSION),))
    conn.commit()
    return conn
