"""Link classification and exhibitor-profile link detection.

The key idea for site-independent directory parsing: on an exhibitor list the
profile links form the largest *family* of links that share a URL template
(e.g. ``/exhibitors/<slug>`` or ``/Exhibitor/ExbDetails/<id>``). We group all
links by template and pick the family that looks most like profiles.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

from config import NON_COMPANY_DOMAINS
from utils.url_utils import host_matches, is_pdf_url, normalize_url, same_site

PROFILE_HINTS = re.compile(r"exhibitor|exhibitors|company|companies|participant|profile|brand|aussteller|"
                           r"exposant|partner|member|vendor|supplier|showroom|stand|booth|details?", re.I)
NOT_PROFILE = re.compile(r"/(tag|tags|category|categories|search|login|register|cart|news|blog|events?|"
                         r"page|wp-content|static|assets|media|images?|feed|rss|privacy|terms|cookie|"
                         r"contact|about|faq)(/|$)|[?&](page|sort|lang|filter|letter)=", re.I)
NAV_CONTAINERS = ("nav", "header", "footer")
# Call-to-action link texts that are never a company name.
CTA_TEXT = re.compile(
    r"\W*((view|see|visit|open|read|learn|find out|show|go to|more|click here)\s*(the\s+|our\s+)?"
    r"(profile|details?|more|exhibitor|company|info(rmation)?|stand|booth|page|website)?|more info|details?|"
    r"profile|products?|brands?|brochures?|videos?|press releases?|contact|website|»|→|›)\W*", re.I)
ID_SEGMENT = re.compile(r"^(?=.*\d)[\w=+.-]{1,}$|^[\w-]{3,}$")


@dataclass
class LinkFamily:
    template: str
    urls: list[str] = field(default_factory=list)
    anchors: dict[str, list[Tag]] = field(default_factory=lambda: defaultdict(list))

    @property
    def size(self) -> int:
        return len(self.urls)


def _template(url: str) -> str:
    p = urlsplit(url)
    segs = [s for s in p.path.split("/") if s]
    if not segs and not p.query:
        return ""
    # Replace the last path segment (the identifier) with '*'; keep query keys.
    tmpl_segs = segs[:-1] + ["*"] if segs else []
    qkeys = sorted(k for k, _ in parse_qsl(p.query))
    return f"{p.netloc.lower()}/{'/'.join(tmpl_segs)}" + (f"?{'&'.join(qkeys)}" if qkeys else "")


def _in_nav(a: Tag) -> bool:
    return any(a.find_parent(n) is not None for n in NAV_CONTAINERS)


def anchor_name(anchors: list[Tag]) -> str | None:
    """Best display name for a profile from all anchors that point to it."""
    texts = []
    for a in anchors:
        # A heading or "title"/"name" element inside the link is the strongest signal.
        titled = a.find(["h1", "h2", "h3", "h4", "h5"]) or a.find(class_=re.compile(r"title|name", re.I))
        if titled is not None:
            t = re.sub(r"\s+", " ", titled.get_text(" ", strip=True))
            if t and not CTA_TEXT.fullmatch(t):
                return t[:300]
        t = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        if not t:
            img = a.find("img", alt=True)
            t = (img["alt"].strip() if img else "") or (a.get("title") or "").strip()
        if t and not CTA_TEXT.fullmatch(t) and not re.fullmatch(r"(image|logo|\.\.\.)", t, re.I):
            texts.append(t)
    if not texts:
        return None
    # The shortest informative text is usually the clean company name.
    texts.sort(key=len)
    for t in texts:
        if len(t) >= 2:
            return t[:300]
    return None


def profile_families(soup: BeautifulSoup, page_url: str, directory_url: str | None = None) -> list[LinkFamily]:
    """All link families on the page, most profile-like first."""
    families: dict[str, LinkFamily] = {}
    dir_norm = normalize_url(directory_url or page_url)
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        url = urljoin(page_url, href)
        if not url.startswith(("http://", "https://")) or is_pdf_url(url):
            continue
        if not same_site(url, page_url) or host_matches(url, NON_COMPANY_DOMAINS):
            continue
        if _in_nav(a):
            continue
        norm = normalize_url(url)
        if norm == dir_norm:
            continue
        # Sub-pages of a profile (".../product", ".../brand") collapse to the profile.
        norm_profile = re.sub(r"/(product|products|brand|brands|brochures?|video|press_release|contact)$", "",
                              norm, flags=re.I)
        tmpl = _template(norm_profile)
        if not tmpl:
            continue
        fam = families.setdefault(tmpl, LinkFamily(tmpl))
        if norm_profile not in fam.anchors:
            fam.urls.append(norm_profile)
        fam.anchors[norm_profile].append(a)

    def score(f: LinkFamily) -> float:
        s = float(f.size)
        if PROFILE_HINTS.search(f.template):
            s *= 2.0
        if NOT_PROFILE.search(f.template.split("/", 1)[-1] if "/" in f.template else f.template):
            s *= 0.1
        named = sum(1 for u in f.urls if anchor_name(f.anchors[u]))
        s *= 0.3 + 0.7 * (named / max(f.size, 1))
        return s

    return sorted(families.values(), key=score, reverse=True)


def best_profile_family(soup: BeautifulSoup, page_url: str, min_size: int = 3,
                        directory_url: str | None = None) -> LinkFamily | None:
    fams = profile_families(soup, page_url, directory_url)
    for f in fams:
        if f.size >= min_size and not NOT_PROFILE.search(f.template.split("/", 1)[-1]):
            return f
    return None


def card_container(a: Tag, profile_url: str, max_up: int = 6) -> Tag:
    """Climb from an anchor to the largest ancestor that contains only this profile."""
    node = a
    best = a
    for _ in range(max_up):
        parent = node.parent
        if parent is None or parent.name in ("body", "html", "[document]"):
            break
        hrefs = {normalize_url(urljoin(profile_url, x["href"])) for x in parent.find_all("a", href=True)
                 if not x["href"].startswith(("#", "javascript:", "mailto:", "tel:"))}
        hrefs = {re.sub(r"/(product|products|brand|brands|brochures?|video|press_release)$", "", h, flags=re.I)
                 for h in hrefs}
        others = [h for h in hrefs if h != normalize_url(profile_url) and same_site(h, profile_url)
                  and _template(h) == _template(normalize_url(profile_url))]
        if others:
            break
        best = parent
        node = parent
    return best


def classify_link(url: str, text: str = "") -> str:
    """Rough page type for logging and source tracking."""
    u = url.lower()
    t = (text or "").lower()
    if is_pdf_url(url):
        return "pdf"
    if re.search(r"brochure|catalog", u + t):
        return "brochure_page"
    if re.search(r"/products?(/|$)|product", u):
        return "product_page"
    if re.search(r"/brands?(/|$)", u):
        return "brand_page"
    if re.search(r"exhibitor|participant|aussteller|exposant", u):
        return "exhibitor_page"
    return "page"
