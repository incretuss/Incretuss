"""Generic adapter: heuristics that work on many server-rendered directories.

Listing
    The largest family of same-site links sharing a URL template is taken as
    the set of exhibitor profiles (see :mod:`crawler.link_extractor`). Pages
    are followed via :mod:`crawler.pagination`. If plain HTTP shows no
    profile links (JavaScript-rendered directory) the page is rendered with
    Playwright, scrolling and clicking "Load more".

Profile
    Name, website, e-mail, phone, hall/booth, description, organiser
    categories, product/brand sections and PDF links are extracted with
    site-independent rules. Anything not found is left empty.

The generic adapter will not be right for every site. When it is not, write a
dedicated adapter (see README, "Adding a website adapter").
"""
from __future__ import annotations

import re
from typing import Iterator
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

from adapters.base_adapter import BaseAdapter, ListingPage, ProfileContext
from crawler.browser import BrowserUnavailable
from crawler.fetcher import FetchError
from crawler.link_extractor import CTA_TEXT, anchor_name, best_profile_family, card_container
from crawler.pagination import find_next_page, has_js_pagination
from database.models import (
    CompanyData, DocumentRef, EvidenceType, ExhibitorStub, ExtractionStatus, PageLog, ProductData,
    ProfileResult, SectorEntry, SourceRef,
)
from extractors.company_extractor import (
    CITY_LABEL_RE, COUNTRY_LABEL_RE, best_description, block_text, candidate_websites, extract_emails,
    extract_hall_booth, extract_phones, labelled_value, text_of, visible_soup,
)
from extractors.product_extractor import labelled_fields
from utils.logging import get_logger
from utils.url_utils import is_pdf_url, normalize_url, website_key

log = get_logger("adapter.generic")

PRODUCT_HEADING = re.compile(r"\b(products?|product range|portfolio|our range|offerings?|solutions|"
                             r"produkte|produits|productos|продукци\w*|товары)\b", re.I)
BRAND_HEADING = re.compile(r"\b(brands?|marken|marques|бренды)\b", re.I)
CATEGORY_HEADING = re.compile(r"\b(categor(y|ies)|sectors?|product groups?|industr(y|ies)|"
                              r"product sectors?|segments?|kategorie|catégories|категори\w*)\b", re.I)
DESCRIPTION_HEADING = re.compile(r"\b(about|profile|company description|description|overview|о компании)\b", re.I)


class GenericAdapter(BaseAdapter):
    name = "generic"
    description = "Heuristic adapter for server-rendered directories (with Playwright fallback)"

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._exclude_domains: set[str] = set()

    @classmethod
    def detect(cls, url: str, html: str) -> float:
        return 0.1  # always applicable, lowest priority

    def describe_strategy(self, directory_url: str) -> list[str]:
        return [
            f"Adapter: {self.name} - {self.description}",
            f"Directory: {directory_url}",
            "Listing: detect the largest family of profile-like links; follow next/numbered pages",
            "Fallback: Playwright rendering with scroll / 'Load more' when HTTP shows no profile links",
            "Profiles: heuristic extraction of name, website, contacts, stand, description, products, PDFs",
        ]

    # ------------------------------------------------------------- fetching
    def _get_html(self, url: str, want_profiles: bool = False) -> tuple[str, str, bool]:
        """Return (final_url, html, rendered_with_browser)."""
        resp = self.fetcher.get(url)
        if not resp.ok:
            raise FetchError(f"HTTP {resp.status}", url, resp.status)
        html, final = resp.text, resp.url
        if not want_profiles:
            return final, html, False
        soup = BeautifulSoup(html, "lxml")
        fam = best_profile_family(soup, final, min_size=3, directory_url=url)
        if fam is None and self.settings.use_browser_fallback and self.browser is not None:
            log.info("no profile links in static HTML of %s; rendering with Playwright", url)
            try:
                final, html = self.browser.render(url, scroll=True, click_load_more=True)
                return final, html, True
            except (BrowserUnavailable, PermissionError) as exc:
                log.warning("browser fallback unavailable: %s", exc)
        return final, html, False

    # -------------------------------------------------------------- listing
    def _stubs_from(self, html: str, page_url: str, directory_url: str) -> list[ExhibitorStub]:
        soup = visible_soup(html)
        fam = best_profile_family(soup, page_url, min_size=3, directory_url=directory_url)
        if fam is None:
            return []
        stubs = []
        for url in fam.urls:
            anchors = fam.anchors[url]
            name = anchor_name(anchors)
            container = card_container(anchors[0], url)
            if not name:
                heading = container.find(["h2", "h3", "h4", "h5", "strong"])
                name = text_of(heading)
            if not name:
                continue
            ctext = container.get_text("\n", strip=True)
            hall, booth = extract_hall_booth(ctext)
            country = labelled_value(ctext, COUNTRY_LABEL_RE)
            stubs.append(ExhibitorStub(name=name, profile_url=url, hall=hall, booth=booth, country=country,
                                       listing_url=page_url))
        return stubs

    def iter_listing(self, directory_url: str, state: dict) -> Iterator[ListingPage]:
        self._exclude_domains.add(website_key(directory_url))
        url = state.get("next_url") or directory_url
        visited: set[str] = set(state.get("visited", []))
        pages = 0
        while url and pages < self.settings.max_listing_pages:
            pages += 1
            final, html, rendered = self._get_html(url, want_profiles=True)
            visited.add(normalize_url(url))
            visited.add(normalize_url(final))
            stubs = self._stubs_from(html, final, directory_url)
            soup = BeautifulSoup(html, "lxml")
            nxt = None if rendered else find_next_page(soup, final, visited)
            note = None
            if not stubs:
                note = "no exhibitor profile links recognised on this page"
            elif nxt is None and not rendered and has_js_pagination(soup):
                note = "page uses JavaScript pagination; only the visible page was read (an adapter may be needed)"
            state = {"next_url": nxt, "visited": sorted(visited)[-200:]}
            yield ListingPage(stubs, final, state, None, done=nxt is None or not stubs, note=note)
            if not stubs:
                return
            url = nxt

    # -------------------------------------------------------------- profile
    @staticmethod
    def _section_after(heading: Tag) -> list[Tag]:
        """Siblings after ``heading`` until the next heading of the same or higher level."""
        level = int(heading.name[1]) if re.fullmatch(r"h[1-6]", heading.name or "") else 6
        out = []
        for sib in heading.find_next_siblings():
            if re.fullmatch(r"h[1-6]", sib.name or "") and int(sib.name[1]) <= level:
                break
            out.append(sib)
        if not out and heading.parent is not None:
            # heading wrapped in its own container: use the parent's following content
            for sib in heading.parent.find_next_siblings():
                if sib.find(re.compile(r"^h[1-6]$")) and sib.find(string=PRODUCT_HEADING) is None:
                    break
                out.append(sib)
                if len(out) > 5:
                    break
        return out

    @staticmethod
    def _items_in(nodes: list[Tag]) -> list[tuple[str, str | None, str | None]]:
        """(name, description, link) for list items / cards inside ``nodes``."""
        items = []
        for node in nodes:
            cards = node.select("li, .card, .product, [class*=product-item], [class*=productItem], article")
            if not cards and node.name == "li":
                cards = [node]
            for c in cards:
                if c.find(["li", "article"]) and c.name in ("li", "article"):
                    continue
                title_el = c.find(["h3", "h4", "h5", "h6", "strong", "b", "figcaption"]) or c.find("a")
                name = text_of(title_el) or text_of(c)
                if not name or len(name) > 200:
                    continue
                desc = text_of(c)
                if desc == name:
                    desc = None
                a = c.find("a", href=True)
                items.append((name, desc, a["href"] if a else None))
        return items

    def extract_profile(self, ctx: ProfileContext) -> ProfileResult:
        final, html, rendered = self._get_html(ctx.profile_url)
        soup = visible_soup(html)
        if len(soup.get_text(" ", strip=True)) < 200 and self.browser is not None and self.settings.use_browser_fallback:
            try:
                final, html = self.browser.render(ctx.profile_url)
                soup = visible_soup(html)
                rendered = True
            except (BrowserUnavailable, PermissionError) as exc:
                log.debug("browser fallback unavailable: %s", exc)
        pages = [PageLog(url=final, page_type="exhibitor_profile" + (" (rendered)" if rendered else ""), status="ok")]
        sources = [SourceRef(url=final, source_type="exhibitor_profile")]
        main = soup.find("main") or soup.find("article") or soup.body or soup
        text = main.get_text("\n", strip=True)

        h1 = text_of(main.find("h1")) or text_of(main.select_one("[class*=compname], [class*=company-name], "
                                                                 "[class*=exhibitor-name]"))
        name = ctx.name
        if h1 and (not ctx.name or CTA_TEXT.fullmatch(ctx.name)):
            name = h1          # the listing only showed a call-to-action text
        elif h1 and ctx.name and (ctx.name.lower() in h1.lower() or h1.lower() in ctx.name.lower()):
            name = h1 if len(h1) <= len(ctx.name) + 40 else ctx.name

        excl = set(self._exclude_domains) | {website_key(ctx.profile_url)}
        sites = candidate_websites(main, final, excl)
        website = sites[0] if sites else None
        emails = extract_emails(main)
        phones = extract_phones(main)
        hall, booth = extract_hall_booth(text)
        country = labelled_value(text, COUNTRY_LABEL_RE)
        city = labelled_value(text, CITY_LABEL_RE)

        description = None
        for h in main.find_all(re.compile(r"^h[2-4]$")):
            if DESCRIPTION_HEADING.search(text_of(h) or ""):
                nodes = self._section_after(h)
                parts = [block_text(n) for n in nodes if n.name in ("p", "div", "section")]
                description = "\n".join(p for p in parts if p) or None
                if description:
                    break
        description = description or best_description(BeautifulSoup(str(main), "lxml"))

        sectors: list[SectorEntry] = []
        products: list[ProductData] = []
        for h in main.find_all(re.compile(r"^h[2-5]$")):
            htext = text_of(h) or ""
            nodes = self._section_after(h)
            if CATEGORY_HEADING.search(htext) and not PRODUCT_HEADING.search(htext.replace("product categor", "")):
                for nm, _, _ in self._items_in(nodes):
                    if len(nm) < 120:
                        sectors.append(SectorEntry(sector=nm))
            elif PRODUCT_HEADING.search(htext) or BRAND_HEADING.search(htext):
                is_brand = bool(BRAND_HEADING.search(htext)) and not PRODUCT_HEADING.search(htext)
                for nm, desc, href in self._items_in(nodes):
                    fields = labelled_fields(desc)
                    products.append(ProductData(
                        name=nm, description=desc, product_type="Brand" if is_brand else None,
                        ingredients=fields.get("ingredients"), raw_materials=fields.get("raw_materials"),
                        applications=fields.get("applications"), services=fields.get("services"),
                        source_url=urljoin(final, href) if href and not href.startswith("javascript") else final,
                        evidence_text=f"Listed under heading '{htext}': {nm}" + (f" | {desc[:300]}" if desc else ""),
                        evidence_type=EvidenceType.PROFILE_BRAND if is_brand else EvidenceType.PROFILE_PRODUCT))
        # Organiser category "chips"/tags without a heading (class names say what they are).
        if not sectors:
            for el in main.select("[class*=cat], [class*=sector], [class*=industr]"):
                cls = " ".join(el.get("class", [])).lower()
                if re.search(r"stand|booth|location|cart|catch|cater|scatter", cls) or el.find(["p", "div", "li"]):
                    continue
                t = text_of(el)
                if t and 2 < len(t) < 80 and not CTA_TEXT.fullmatch(t) and t not in {x.sector for x in sectors}:
                    sectors.append(SectorEntry(sector=t))
        # de-duplicate products by name within the profile
        seen = set()
        products = [p for p in products if not (p.name.lower() in seen or seen.add(p.name.lower()))]

        documents = []
        for a in main.find_all("a", href=True):
            u = urljoin(final, a["href"])
            label = text_of(a) or ""
            icon = " ".join(" ".join(i.get("class", [])) for i in a.find_all("i"))
            if is_pdf_url(u) or (u.startswith("http") and (re.search(r"\bpdf\b|brochure|catalog", label, re.I)
                                                           or "file-pdf" in icon)):
                documents.append(DocumentRef(title=label or None, url=u, doc_type="brochure"))
        documents = list({d.url: d for d in documents}.values())[: self.settings.max_pdfs_per_company]

        if website:
            sources.append(SourceRef(url=website, source_type="official_website_link"))
        warnings = []
        if not (website or description or products):
            warnings.append("generic adapter found little structured data on this profile")
        company = CompanyData(name=name, official_website=website, country=country, city=city, hall=hall,
                              booth=booth, description=description, email="; ".join(emails[:3]) or None,
                              phone="; ".join(phones[:3]) or None, event_sectors=sectors)
        status = ExtractionStatus.SUCCESS if (website or description or products) else ExtractionStatus.PARTIAL
        return ProfileResult(company=company, products=products, documents=documents, sources=sources,
                             pages=pages, status=status, warnings=warnings)

    # used by discovery to exclude the event's own domains from "official website"
    def exclude_domains(self, *urls: str) -> None:
        for u in urls:
            if u:
                self._exclude_domains.add(website_key(u))
