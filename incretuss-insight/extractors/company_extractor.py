"""Site-independent helpers for pulling company fields out of HTML.

These are used by the generic adapter and may be reused by specialised
adapters. Every helper returns ``None``/empty when nothing explicit is found;
nothing is guessed.

Only *rendered* content is considered: HTML comments, ``<script>``,
``<style>`` and ``<template>`` are dropped first, so data an organiser has
deliberately hidden (e.g. an e-mail address commented out of the page) is not
harvested.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup, Comment, Tag

from config import NON_COMPANY_DOMAINS
from utils.url_utils import clean_website, host_matches, looks_like_url, same_site

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}\b")
PHONE_LABEL_RE = re.compile(
    r"(?:phone|tel(?:ephone)?|mob(?:ile)?|contact number|телефон|тел)\.?\s*[:：]?\s*(\+?[\d][\d\s().\-]{6,}\d)", re.I)
HALL_RE = re.compile(r"\b(?:Pavilion\s+[\w.-]+\s*,?\s*)?Hall\s*(?:No\.?|#|:)?\s*([A-Z]?\d+[A-Z]?(?:[.\-]\d+)?)", re.I)
BOOTH_RE = re.compile(r"\b(?:Stand|Booth)\s*(?:No\.?|Number|#)?\s*[-:–]?\s*([A-Z]{0,3}\d[\w.\-/]*)", re.I)
COUNTRY_LABEL_RE = re.compile(r"\bCountry\s*[:：]\s*([^\n|;]{2,60})", re.I)
CITY_LABEL_RE = re.compile(r"\bCity\s*[:：]\s*([^\n|;]{2,60})", re.I)

PLACEHOLDER_TEXT = re.compile(r"lorem ipsum", re.I)


def visible_soup(html: str) -> BeautifulSoup:
    soup = BeautifulSoup(html, "lxml")
    for c in soup.find_all(string=lambda t: isinstance(t, Comment)):
        c.extract()
    for t in soup(["script", "style", "noscript", "template", "svg"]):
        t.decompose()
    return soup


def text_of(node: Tag | None, sep: str = " ") -> str | None:
    if node is None:
        return None
    t = node.get_text(sep, strip=True)
    t = re.sub(r"\s+", " ", t).strip()
    return t or None


def block_text(node: Tag | None) -> str | None:
    """Text of a block keeping paragraph / line breaks."""
    if node is None:
        return None
    for br in node.find_all("br"):
        br.replace_with("\n")
    parts = []
    for el in node.find_all(["p", "li", "div"], recursive=True) or [node]:
        if el.find(["p", "li", "div"]):
            continue
        t = el.get_text(" ", strip=False)
        t = "\n".join(re.sub(r"[ \t]+", " ", ln).strip() for ln in t.split("\n"))
        if t.strip():
            parts.append(t.strip())
    if not parts:
        parts = [node.get_text("\n", strip=True)]
    text = "\n".join(parts)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if PLACEHOLDER_TEXT.search(text or ""):
        return None
    return text or None


def extract_emails(soup: BeautifulSoup) -> list[str]:
    found: list[str] = []
    for a in soup.select("a[href^='mailto:' i]"):
        addr = a["href"].split(":", 1)[1].split("?")[0].strip()
        if EMAIL_RE.fullmatch(addr):
            found.append(addr)
    text = soup.get_text(" ", strip=True)
    found.extend(EMAIL_RE.findall(text))
    bad_ext = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")
    return list(dict.fromkeys(e for e in found if not e.lower().endswith(bad_ext)))


def extract_phones(soup: BeautifulSoup) -> list[str]:
    found: list[str] = []
    for a in soup.select("a[href^='tel:' i]"):
        num = a["href"].split(":", 1)[1].strip()
        if len(re.sub(r"\D", "", num)) >= 7:
            found.append(num)
    text = soup.get_text("\n", strip=True)
    for m in PHONE_LABEL_RE.finditer(text):
        num = m.group(1).strip()
        if len(re.sub(r"\D", "", num)) >= 7:
            found.append(num)
    return list(dict.fromkeys(found))


def candidate_websites(soup: BeautifulSoup, page_url: str, extra_excluded: set[str] | None = None) -> list[str]:
    """External links that may be the company's own website, best first."""
    excluded = set(NON_COMPANY_DOMAINS) | (extra_excluded or set())
    scored: dict[str, int] = {}
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.lower().startswith(("http://", "https://", "www.")):
            continue
        href = clean_website(href)
        if same_site(href, page_url) or host_matches(href, excluded):
            continue
        if re.search(r"\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?)(\?|$)", href, re.I):
            continue
        label = (a.get_text(" ", strip=True) or "").lower()
        score = 1
        if looks_like_url(label) or "website" in label or "web site" in label or "сайт" in label:
            score += 5
        icon = a.find_previous_sibling("i")
        if icon and "globe" in " ".join(icon.get("class", [])):
            score += 5
        if label and same_site(clean_website(label) if looks_like_url(label) else "http://x.invalid", href):
            score += 3
        scored[href] = max(scored.get(href, 0), score)
    return [u for u, _ in sorted(scored.items(), key=lambda kv: -kv[1])]


def extract_hall_booth(text: str) -> tuple[str | None, str | None]:
    hall = booth = None
    m = HALL_RE.search(text or "")
    if m:
        hall = re.sub(r"\s+", " ", m.group(0)).strip()
    m = BOOTH_RE.search(text or "")
    if m:
        booth = m.group(1).strip()
    return hall, booth


def labelled_value(text: str, pattern: re.Pattern) -> str | None:
    m = pattern.search(text or "")
    return m.group(1).strip() if m else None


def best_description(soup: BeautifulSoup, min_len: int = 120) -> str | None:
    """Longest prose paragraph in the main content area (not nav/footer)."""
    root = soup.find("main") or soup.find("article") or soup.body or soup
    for t in root.find_all(["nav", "header", "footer", "aside", "form"]):
        t.decompose()
    best = None
    for p in root.find_all(["p", "div", "section"]):
        if p.find(["p", "div", "section", "ul", "table"]):
            continue
        t = re.sub(r"\s+", " ", p.get_text(" ", strip=True))
        if len(t) < min_len or PLACEHOLDER_TEXT.search(t):
            continue
        # prose: has sentences and few links
        if t.count(".") < 1 or len(p.find_all("a")) > 3:
            continue
        if best is None or len(t) > len(best):
            best = t
    return best


def absolute(url: str, base: str) -> str:
    return urljoin(base, url)


def path_of(url: str) -> str:
    return urlsplit(url).path
