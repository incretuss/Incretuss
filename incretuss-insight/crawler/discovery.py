"""Exhibitor-directory discovery.

Given any URL of an exhibition website, find the page that lists exhibitors:

1. Check whether the start page itself is a directory.
2. Score links on the start page (navigation included; cross-domain links
   are allowed because organisers often host directories on a platform
   domain) by directory keywords in URL and link text.
3. Read ``sitemap.xml`` (from robots.txt ``Sitemap:`` lines or the default
   location) for keyword-matching URLs.
4. Fetch the best candidates and evaluate each one: adapter detection score,
   number of profile-like links, "N exhibitors"-style totals. Landing pages
   (e.g. ``/exhibitor-list/`` that just links to an external platform) are
   followed one extra hop.

Nothing is assumed about the site structure; if discovery fails the user can
pass ``--directory-url`` explicitly.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from adapters import select_adapter
from config import DIRECTORY_KEYWORDS, DIRECTORY_NEGATIVE_KEYWORDS, NON_COMPANY_DOMAINS, Settings
from crawler.fetcher import FetchError, Fetcher
from crawler.link_extractor import best_profile_family
from crawler.pagination import has_js_pagination
from utils.logging import get_logger
from utils.url_utils import host_matches, normalize_url

log = get_logger("discovery")

TOTAL_RE = re.compile(r"(?:of|из|total[:\s]*)\s*(\d{2,5})\s*(?:companies|exhibitors|results|участник\w*|"
                      r"компани\w*)?|(\d{2,5})\s+(?:exhibitors|companies|participants|results|участник\w*|"
                      r"экспонент\w*)", re.I)


@dataclass
class Candidate:
    url: str
    source: str                   # where we found it: start_page | link | sitemap | hop
    link_text: str = ""
    keyword_score: float = 0.0
    evaluated: bool = False
    final_url: str | None = None
    adapter: str | None = None
    adapter_score: float = 0.0
    profile_links: int = 0
    reported_total: int | None = None
    js_pagination: bool = False
    error: str | None = None
    title: str | None = None
    redirect_to: str | None = None

    @property
    def score(self) -> float:
        if not self.evaluated or self.error:
            return -1
        s = self.adapter_score * 100 + min(self.profile_links, 200) + self.keyword_score * 5
        if self.reported_total:
            s += 10
        return s


@dataclass
class DiscoveryResult:
    start_url: str
    candidates: list[Candidate] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def best(self) -> Candidate | None:
        ok = [c for c in self.candidates if c.evaluated and not c.error and (c.profile_links >= 3 or c.adapter_score >= 0.5)]
        return max(ok, key=lambda c: c.score) if ok else None


REDIRECT_TEXT = re.compile(r"redirecting|you are being redirected|if you are not redirected|перенаправ", re.I)
JS_LOCATION = re.compile(r"""(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']|location\.replace\(["']([^"']+)["']""")


def keyword_score(url: str, text: str) -> float:
    parts = urlsplit(url)
    hay_url = url.lower()
    hay_path = (parts.path + "?" + parts.query).lower()   # negatives never apply to the host name
    hay_text = (text or "").lower()
    score = 0.0
    for kw in DIRECTORY_KEYWORDS:
        k = kw.lower()
        if k.replace(" ", "-") in hay_url or k.replace(" ", "") in hay_url:
            score += 1.0
        if k in hay_text:
            score += 1.5
    for neg in DIRECTORY_NEGATIVE_KEYWORDS:
        if neg in hay_path or neg in hay_text:
            score -= 2.5
    if re.search(r"\b(list|directory|20\d\d)\b", hay_text):
        score += 0.5
    return score


class DiscoveryEngine:
    def __init__(self, fetcher: Fetcher, settings: Settings):
        self.fetcher = fetcher
        self.settings = settings

    def _links(self, html: str, base: str) -> list[tuple[str, str]]:
        soup = BeautifulSoup(html, "lxml")
        out = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue
            url = urljoin(base, href)
            if not url.startswith(("http://", "https://")) or host_matches(url, NON_COMPANY_DOMAINS):
                continue
            out.append((url, a.get_text(" ", strip=True)))
        return out

    def _sitemap_urls(self, start_url: str) -> list[str]:
        p = urlsplit(start_url)
        origin = f"{p.scheme}://{p.netloc}"
        maps = []
        try:
            r = self.fetcher.get(origin + "/robots.txt", retries=1)
            if r.ok:
                maps = [ln.split(":", 1)[1].strip() for ln in r.text.splitlines() if ln.lower().startswith("sitemap:")]
        except FetchError:
            pass
        maps = maps or [origin + "/sitemap.xml"]
        urls: list[str] = []
        for sm in maps[:3]:
            urls.extend(self._read_sitemap(sm, depth=0))
        return urls

    def _read_sitemap(self, url: str, depth: int) -> list[str]:
        try:
            r = self.fetcher.get(url, retries=1)
        except FetchError as exc:
            log.debug("sitemap %s unavailable: %s", url, exc)
            return []
        if not r.ok or b"<" not in r.content[:200]:
            return []
        try:
            root = ET.fromstring(r.content)
        except ET.ParseError:
            return []
        locs = [e.text.strip() for e in root.iter() if e.tag.endswith("loc") and e.text]
        if root.tag.endswith("sitemapindex") and depth < 1:
            relevant = [u for u in locs if re.search(r"exhibit|compan|partic|brand|director", u, re.I)] or locs[:5]
            out = []
            for u in relevant[:5]:
                out.extend(self._read_sitemap(u, depth + 1))
            return out
        return locs

    @staticmethod
    def _client_redirect(soup: BeautifulSoup, html: str, base: str) -> str | None:
        """Target of a meta-refresh / JavaScript / "Redirecting..." landing page."""
        meta = soup.find("meta", attrs={"http-equiv": re.compile("refresh", re.I)})
        if meta and "url=" in (meta.get("content") or "").lower():
            return urljoin(base, meta["content"].split("=", 1)[1].strip(" '\""))
        m = JS_LOCATION.search(html)
        if m and len(soup.get_text(" ", strip=True)) < 5000:
            return urljoin(base, m.group(1) or m.group(2))
        for p in soup.find_all(string=REDIRECT_TEXT):
            container = p.parent
            for _ in range(3):
                if container is None:
                    break
                a = container.find("a", href=True)
                if a and not a["href"].startswith(("#", "javascript:")):
                    return urljoin(base, a["href"])
                container = container.parent
        return None

    def evaluate(self, cand: Candidate) -> Candidate:
        cand.evaluated = True
        try:
            r = self.fetcher.get(cand.url)
        except FetchError as exc:
            cand.error = str(exc)
            return cand
        if not r.ok:
            cand.error = f"HTTP {r.status}"
            return cand
        if "html" not in r.content_type and r.content_type:
            cand.error = f"not HTML ({r.content_type})"
            return cand
        cand.final_url = r.url
        html = r.text
        cls, score = select_adapter(r.url, html)
        cand.adapter, cand.adapter_score = cls.name, score
        soup = BeautifulSoup(html, "lxml")
        fam = best_profile_family(soup, r.url, min_size=3, directory_url=r.url)
        cand.profile_links = fam.size if fam else 0
        m = TOTAL_RE.search(soup.get_text(" ", strip=True))
        if m:
            cand.reported_total = int(m.group(1) or m.group(2))
        cand.js_pagination = has_js_pagination(soup)
        cand.title = soup.title.get_text(" ", strip=True)[:200] if soup.title else None
        cand.redirect_to = self._client_redirect(soup, html, r.url)
        cand._html = html  # type: ignore[attr-defined]
        return cand

    def discover(self, start_url: str) -> DiscoveryResult:
        result = DiscoveryResult(start_url=start_url)
        log.info("Inspecting %s", start_url)
        start = self.evaluate(Candidate(url=start_url, source="start_page", keyword_score=keyword_score(start_url, "")))
        result.candidates.append(start)
        if start.error:
            result.notes.append(f"start page could not be fetched: {start.error}")
            return result
        if start.adapter_score >= 0.5 or start.profile_links >= 20:
            result.notes.append("the start page itself looks like an exhibitor directory")

        seen = {normalize_url(start.final_url or start_url)}
        pool: dict[str, Candidate] = {}

        def add(url: str, text: str, source: str):
            norm = normalize_url(url)
            if norm in seen:
                return
            ks = keyword_score(url, text)
            if ks <= 0:
                return
            if norm not in pool or pool[norm].keyword_score < ks:
                pool[norm] = Candidate(url=url, source=source, link_text=text[:80], keyword_score=ks)

        for url, text in self._links(start._html, start.final_url):  # type: ignore[attr-defined]
            add(url, text, "link")
        sm = self._sitemap_urls(start.final_url or start_url)
        if sm:
            result.notes.append(f"sitemap: {len(sm)} URLs read")
        for url in sm:
            add(url, "", "sitemap")

        ranked = sorted(pool.values(), key=lambda c: -c.keyword_score)[: self.settings.max_discovery_candidates]
        hop_pool: dict[str, Candidate] = {}
        for cand in ranked:
            self.evaluate(cand)
            result.candidates.append(cand)
            seen.add(normalize_url(cand.url))
            if cand.error or cand.adapter_score >= 0.5 or cand.profile_links >= 20:
                continue
            # Landing page: look one hop further for the actual directory.
            if cand.redirect_to and normalize_url(cand.redirect_to) not in seen:
                hop_pool[normalize_url(cand.redirect_to)] = Candidate(
                    url=cand.redirect_to, source=f"client-side redirect from {cand.url}", link_text="(redirect)",
                    keyword_score=cand.keyword_score + 5)
            for url, text in self._links(cand._html, cand.final_url):  # type: ignore[attr-defined]
                norm = normalize_url(url)
                if norm in seen or norm in pool:
                    continue
                ks = keyword_score(url, text) + (1.0 if urlsplit(url).netloc != urlsplit(cand.final_url).netloc else 0)
                if ks > 1.5 and (norm not in hop_pool or hop_pool[norm].keyword_score < ks):
                    hop_pool[norm] = Candidate(url=url, source=f"hop from {cand.url}", link_text=text[:80],
                                               keyword_score=ks)
        for cand in sorted(hop_pool.values(), key=lambda c: -c.keyword_score)[:5]:
            self.evaluate(cand)
            result.candidates.append(cand)

        for c in result.candidates:
            if hasattr(c, "_html"):
                del c._html  # type: ignore[attr-defined]
        if result.best is None:
            result.notes.append("no exhibitor directory recognised automatically; use --directory-url")
        return result
