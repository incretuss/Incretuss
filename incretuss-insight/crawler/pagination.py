"""Generic pagination detection for server-rendered listings.

Handles ``<link rel=next>``, ``<a rel=next>``, "Next"/"›"/"»" links and
numbered page links (``?page=N``, ``/page/N``, ``?p=N``, ``?offset=N``...).
JavaScript-only pagination (``href="javascript:..."``) and infinite scroll
are not handled here; see :mod:`crawler.browser` or write an adapter.
"""
from __future__ import annotations

import re
from urllib.parse import parse_qsl, urljoin, urlsplit

from bs4 import BeautifulSoup

from utils.url_utils import normalize_url, same_site

NEXT_TEXT = re.compile(r"^\s*(next|next page|›|»|>|→|weiter|suivant|siguiente|далее|следующая|vor)\s*[›»>→]?\s*$", re.I)
PAGE_PARAM = re.compile(r"^(page|p|pg|pagenum|page_no|pageno|paged|offset|start|from|seite)$", re.I)
PAGE_PATH = re.compile(r"/(page|p|seite)/(\d+)/?$", re.I)


def _page_number(url: str) -> int | None:
    p = urlsplit(url)
    m = PAGE_PATH.search(p.path)
    if m:
        return int(m.group(2))
    for k, v in parse_qsl(p.query):
        if PAGE_PARAM.match(k) and v.isdigit():
            return int(v)
    return None


def find_next_page(soup: BeautifulSoup, page_url: str, visited: set[str]) -> str | None:
    """Return the URL of the next listing page, or ``None``."""
    candidates: list[str] = []
    link = soup.find("link", rel=lambda v: v and "next" in v)
    if link and link.get("href"):
        candidates.append(urljoin(page_url, link["href"]))
    for a in soup.find_all("a", href=True):
        rel = a.get("rel") or []
        label = a.get_text(" ", strip=True) or a.get("aria-label", "") or a.get("title", "")
        if "next" in rel or NEXT_TEXT.match(label or "") or re.search(r"\bnext\b", a.get("aria-label", ""), re.I) \
                or "next" in " ".join(a.get("class", [])).lower():
            href = a["href"].strip()
            if href and not href.startswith(("#", "javascript:")):
                candidates.append(urljoin(page_url, href))

    # Numbered pages: pick the smallest page number greater than the current one.
    current = _page_number(page_url) or 1
    numbered = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("#", "javascript:")):
            continue
        u = urljoin(page_url, href)
        n = _page_number(u)
        if n is not None and n > current and same_site(u, page_url):
            numbered.append((n, u))
    if numbered:
        numbered.sort()
        candidates.append(numbered[0][1])

    for c in candidates:
        if same_site(c, page_url) and normalize_url(c) not in visited and normalize_url(c) != normalize_url(page_url):
            return c
    return None


def has_js_pagination(soup: BeautifulSoup) -> bool:
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("javascript:") and re.search(r"page|filter|load|more|\d+", a.get("onclick", "") +
                                                             a.get_text(" ", strip=True), re.I):
            return True
    for b in soup.find_all("button"):
        if re.search(r"load more|show more|mehr laden|загрузить|показать ещ", b.get_text(" ", strip=True), re.I):
            return True
    return False
