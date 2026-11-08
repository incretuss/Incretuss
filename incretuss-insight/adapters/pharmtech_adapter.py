"""Adapter for the ITE Group "Exhibitor Online Manual" platform.

First used for Pharmtech & Ingredients 2026
(https://exhibitors-itegroup.exhibitoronlinemanual.com/pharmtech-and-ingredients-2026/en/Exhibitor),
but written against the *platform*, not the single event: any directory on
``*.exhibitoronlinemanual.com/<event-slug>/<lang>/Exhibitor`` uses the same
markup and endpoints.

Platform behaviour (inspected 2026-11):

* Listing: first page is server-rendered (24 cards). Further pages are loaded
  by ``POST {base}/{lang}/Exhibitor/ajaxPaginationData/{offset}`` with the
  event id from the hidden ``selected_pass_event`` input; offsets step by 24.
  A session cookie from the first GET is required.
* Profile: ``.../Exhibitor/ExbDetails/<base64 id>``. All tabs (About,
  Products, Brands, Brochures, Press, Video, New Products) are in one HTML
  page; ``/product``, ``/brand``... suffixes return the same page.
* Product and brand details come from ``POST {base}{event}/Exhibitor/
  ProductDescription`` / ``BrandDescription`` (modal HTML).
* Some contact e-mails exist only inside HTML comments. They are treated as
  deliberately unpublished and are NOT extracted.
"""
from __future__ import annotations

import re
from typing import Iterator
from urllib.parse import quote, urljoin, urlsplit

from bs4 import BeautifulSoup, NavigableString

from adapters.base_adapter import BaseAdapter, ListingPage, ProfileContext
from crawler.fetcher import FetchError
from database.models import (
    CompanyData, DocumentRef, EvidenceType, ExhibitorStub, ExtractionStatus, PageLog, ProductData,
    ProfileResult, SectorEntry, SourceRef,
)
from extractors.company_extractor import block_text, extract_emails, extract_phones, text_of, visible_soup
from extractors.product_extractor import labelled_fields
from utils.logging import get_logger
from utils.url_utils import clean_website, is_pdf_url

log = get_logger("adapter.eom")

SHOWING_RE = re.compile(r"Showing\s*\(companies\)\s*(\d+)\s*to\s*(\d+)\s*of\s*(\d+)", re.I)
# The platform emits malformed '<h6">' tags, which lxml names 'h6"'.
H6 = lambda tag: bool(tag.name) and tag.name.startswith("h6")  # noqa: E731
ONCLICK_RE = re.compile(r"open(Product|Brand)Desc\((\d+)\s*,\s*(\d+)\)")


class ExhibitorOnlineManualAdapter(BaseAdapter):
    name = "exhibitoronlinemanual"
    description = "ITE Group Exhibitor Online Manual platform (e.g. Pharmtech & Ingredients)"

    # Organiser sector label -> normalised categories. Labels not listed here
    # are mapped by the generic keyword rules on the label head; anything still
    # unmapped becomes "Other" (with the sector quoted as evidence).
    sector_overrides = {
        "Natural extracts": ["Natural Extracts"],
        "APIs": ["APIs"],
        "API contract manufacturing": ["Contract Manufacturing"],
        "API registration processes": ["Other"],
        "Intermediates": ["Pharmaceutical Intermediates"],
        "Fine chemicals": ["Pharmaceutical Ingredients"],
        "Functional ingredients": ["Excipients"],
        "Low-tonnage chemistry for the production of AFI and igredients": ["Pharmaceutical Ingredients"],
        "Raw materials and ingredients for manufacturing medicines or veterinary products": ["Pharmaceutical Ingredients"],
        "Raw materials and ingredients for manufacturing BAS": ["Nutraceutical Ingredients"],
        "Raw Materials and Ingredients for Eubiotics": ["Nutraceutical Ingredients"],
        "Raw Materials and Ingredients for Nutraceuticals": ["Nutraceutical Ingredients"],
        "Raw Materials and Ingredients for Parapharmaceuticals": ["Pharmaceutical Ingredients"],
        "Raw materials for cosmetics manufacturing": ["Cosmetic Ingredients"],
        "Equipment for raw materials production": ["Manufacturing Equipment"],
        "Equipment for cosmetics manufacturing": ["Manufacturing Equipment"],
        "Equipment and raw materials for cosmetics manufacturing": [],
        "Laboratory equipment": ["Laboratory Equipment"],
        "Laboratory furniture": ["Laboratory Equipment"],
        "Laboratory equipment and reagents": ["Laboratory Equipment"],
        "Clinical research": ["Other"],
        "Packing & packaging equipment": ["Packaging Equipment"],
        "Packaging and packaging equipment": ["Packaging Equipment"],
        "Packaging materials": ["Other"],
        "Polymer & glass containers": ["Other"],
        "Equipment for production of containers": ["Packaging Equipment"],
        "Equipment and consumables for biotechnology manufacturing": ["Biotechnology"],
        "Biotechnology consumables": ["Biotechnology"],
        "Centrifuges": ["Biotechnology"],
        "Freeze dryers": ["Biotechnology"],
        "Filtration equipment": ["Manufacturing Equipment"],
        "Plasticiser": ["Other"],
        "Manufacturing and general equipment": ["Manufacturing Equipment"],
        "Complete production lines": ["Manufacturing Equipment"],
        "Concentration & purification equipment": ["Manufacturing Equipment"],
        "Control & instrumentation equipment": ["Manufacturing Equipment"],
        "Cleanrooms": ["Manufacturing Equipment"],
        "Cleanroom components": ["Manufacturing Equipment"],
        "Sterilizers": ["Manufacturing Equipment"],
        "Cleanrooms clothing": ["Other"],
        "Individual safety devices for cleanrooms": ["Other"],
        "Industrial cleaning and disinfection of pharmaceutical production rooms": ["Other"],
        "Turnkey projects": ["Other"],
        "Pharmaceutical engineering and design works": ["Other"],
        "Contract services": ["Other"],
        "Contract manufacturing of medicines": ["Contract Manufacturing"],
        "Packaging contract manufacturing": ["Contract Manufacturing"],
        "Other contract services": ["Other"],
        "Preclincal & Clinical Trials and Outlicensing": ["Other"],
        "Recycle and waste management": ["Other"],
        "Warehouse and logistics": ["Other"],
        "Equipment for raw materials and finished products storage": ["Other"],
        "IT services and products, software, automation and robotics systems": ["Other"],
        "Real-time processing of listing and monitoring of FPP using IT solutions": ["Other"],
        "Up-to-date IT for the optimization of logistic process": ["Other"],
        "Media": ["Other"],
        "Training, consulting": ["Other"],
    }

    # ------------------------------------------------------------ detection
    @classmethod
    def detect(cls, url: str, html: str) -> float:
        host = (urlsplit(url).hostname or "").lower()
        score = 0.0
        if host.endswith("exhibitoronlinemanual.com"):
            score += 0.6
        if "ajaxPaginationData" in html or "Exhibitor/ExbDetails/" in html:
            score += 0.4
        return min(score, 1.0)

    def describe_strategy(self, directory_url: str) -> list[str]:
        return [
            f"Adapter: {self.name} - {self.description}",
            f"Directory: {directory_url}",
            "Listing: server-rendered first page + POST ajaxPaginationData/<offset> for the rest (HTTP only, no browser)",
            "Profiles: one GET per exhibitor (all tabs in one page)",
            "Products/brands: one POST per item for the detail text",
            "Brochures: PDF links on the profile, downloaded and text-extracted",
        ]

    # ------------------------------------------------------------- helpers
    @staticmethod
    def _hidden(soup: BeautifulSoup, name: str) -> str | None:
        el = soup.find("input", attrs={"id": name}) or soup.find("input", attrs={"name": name})
        return el.get("value") if el and el.get("value") else None

    @staticmethod
    def _own_text(tag) -> str:
        """Text directly inside ``tag`` (not in child elements) - the markup has
        malformed, nested <h6> tags that would otherwise swallow siblings."""
        t = " ".join(str(c) for c in tag.children if isinstance(c, NavigableString))
        return re.sub(r"\s+", " ", t).strip()

    @classmethod
    def _h6_text(cls, h6) -> str:
        if h6.find(H6) or h6.find("p"):
            return cls._own_text(h6)
        return text_of(h6) or ""

    @classmethod
    def _parse_cards(cls, html: str, page_url: str) -> list[ExhibitorStub]:
        soup = visible_soup(html)
        stubs = []
        for card in soup.select("div.card"):
            title = card.select_one(".card-title")
            if title is None:
                continue
            name = text_of(title)
            profile = None
            for a in card.find_all("a", href=True):
                m = re.search(r"^(.*?/Exhibitor/ExbDetails/[^/?#]+)", a["href"])
                if m:
                    profile = urljoin(page_url, m.group(1))
                    break
            hall = booth = None
            for h6 in card.find_all(H6):
                t = cls._h6_text(h6)
                if re.search(r"stand\s*no", t, re.I):
                    booth = re.sub(r"(?i)^.*?stand\s*no\.?\s*[-:–]?\s*", "", t).strip() or None
                elif re.search(r"\bhall\b|pavilion", t, re.I):
                    hall = t
            country = text_of(card.select_one("p.card-text"))
            actions = [text_of(x) for x in card.select(".footer-actions .tooltip-text")]
            extra = {"listing_tabs": [x for x in actions if x]}
            if not name:
                continue
            if profile is None:
                # Listed without a profile page: keep the listing data, keyed by name.
                # (A query parameter, not a #fragment: URL normalisation drops
                # fragments, which would collapse all such exhibitors into one.)
                base = page_url.split("#")[0]
                profile = f"{base}{'&' if '?' in base else '?'}no_profile={quote(name)}"
                extra["no_profile"] = True
            stubs.append(ExhibitorStub(name=name, profile_url=profile, country=country, hall=hall,
                                       booth=booth, listing_url=page_url, extra=extra))
        return stubs

    # -------------------------------------------------------------- listing
    def iter_listing(self, directory_url: str, state: dict) -> Iterator[ListingPage]:
        first = self.fetcher.get(directory_url)
        if not first.ok:
            raise FetchError(f"HTTP {first.status}", directory_url, first.status)
        soup = BeautifulSoup(first.text, "lxml")
        base = (self._hidden(soup, "baseurl") or f"{urlsplit(directory_url).scheme}://{urlsplit(directory_url).netloc}/")
        base = base.rstrip("/") + "/"
        event_id = self._hidden(soup, "selected_pass_event")
        lang = self._hidden(soup, "language") or "en"
        m = SHOWING_RE.search(first.text)
        total = int(m.group(3)) if m else None
        first_stubs = self._parse_cards(first.text, first.url)
        page_size = len(first_stubs) or 24

        offset = int(state.get("next_offset", 0))
        if offset == 0:
            yield ListingPage(first_stubs, first.url, {"next_offset": page_size}, total,
                              done=total is not None and page_size >= total)
            offset = page_size
        if not event_id:
            yield ListingPage([], first.url, {"next_offset": offset}, total, done=True,
                              note="event id not found on page; only the first page could be read")
            return

        endpoint = f"{base}{lang}/Exhibitor/ajaxPaginationData/"
        pages = 0
        while total is None or offset < total:
            pages += 1
            if pages > self.settings.max_listing_pages:
                break
            data = {
                "page": offset, "keywords": "", "keyword_search": "", "country_id": "", "event_prod_cat_id": "",
                "exb_listed_as": "", "sortBy": "", "event_id": event_id, "InitialKey": "", "ExhibitorDataView": "",
                "certificationId": "", "language": lang, "sub_product": "", "sectorData": "{}",
                "sub_sub_product": "",
            }
            resp = self.fetcher.post(endpoint + str(offset), data=data,
                                     headers={"X-Requested-With": "XMLHttpRequest", "Referer": directory_url})
            if not resp.ok:
                raise FetchError(f"listing page offset {offset}: HTTP {resp.status}", resp.url, resp.status)
            stubs = self._parse_cards(resp.text, directory_url)
            for s in stubs:
                s.listing_url = f"{directory_url}#offset={offset}"
            m = SHOWING_RE.search(resp.text)
            if m:
                total = int(m.group(3))
            nxt = offset + page_size
            done = not stubs or (total is not None and nxt >= total)
            yield ListingPage(stubs, f"{endpoint}{offset}", {"next_offset": nxt}, total, done=done)
            if done:
                return
            offset = nxt

    # -------------------------------------------------------------- profile
    def _detail(self, kind: str, item_id: str, exb_id: str, event_base: str, referer: str) -> tuple[str | None, str | None]:
        """POST the product/brand modal endpoint. Returns (title, text)."""
        endpoint = f"{event_base}/Exhibitor/{'ProductDescription' if kind == 'Product' else 'BrandDescription'}"
        key = "product_id" if kind == "Product" else "brand_id"
        resp = self.fetcher.post(endpoint, data={key: item_id, "exhibitor_id": exb_id, "language": "en"},
                                 headers={"X-Requested-With": "XMLHttpRequest", "Referer": referer})
        if not resp.ok:
            raise FetchError(f"HTTP {resp.status}", endpoint, resp.status)
        soup = visible_soup(resp.text)
        title = text_of(soup.select_one(".modal-title"))
        body = block_text(soup.select_one(".modal-body"))
        return title, body

    def extract_profile(self, ctx: ProfileContext) -> ProfileResult:
        url = ctx.profile_url
        if (ctx.listing.get("extra") or {}).get("no_profile"):
            lst = ctx.listing
            return ProfileResult(
                company=CompanyData(name=ctx.name, country=lst.get("country"), hall=lst.get("hall"),
                                    booth=lst.get("booth")),
                pages=[PageLog(url=url, page_type="exhibitor_profile", status="skipped",
                               error_message="organiser lists this exhibitor without a profile page")],
                status=ExtractionStatus.PARTIAL,
                warnings=["listed in the directory without a profile page; only listing data available"])
        resp = self.fetcher.get(url)
        if not resp.ok:
            raise FetchError(f"HTTP {resp.status}", url, resp.status)
        soup = visible_soup(resp.text)
        pages = [PageLog(url=url, page_type="exhibitor_profile", status="ok")]
        sources = [SourceRef(url=url, source_type="exhibitor_profile")]
        warnings: list[str] = []
        details = soup.select_one(".company-details") or soup

        name = text_of(details.select_one("h1.company-title")) or ctx.name
        head = details.select_one(".col-md-8") or details
        country = hall = booth = None
        for h6 in head.find_all(H6):
            if h6.find_parent(class_="company-info"):
                continue
            t = self._h6_text(h6)
            if re.search(r"stand\s*no", t, re.I):
                booth = re.sub(r"(?i)^.*?stand\s*no\.?\s*[-:–]?\s*", "", t).strip() or None
            elif re.search(r"\bhall\b|pavilion", t, re.I):
                hall = t
            elif country is None and t and not h6.find_parent("table"):
                country = t

        sectors = []
        for tr in details.select("table.cat-table tr"):
            parent = text_of(tr.select_one(".parent-cat"))
            subs = [text_of(s) for s in tr.select(".child-cat .tag")]
            if parent:
                sectors.append(SectorEntry(sector=parent, subsectors=[s for s in subs if s]))

        info = details.select_one(".company-info") or details
        website = None
        for a in info.find_all("a", href=True):
            href = a["href"].strip()
            if href.lower().startswith(("http://", "https://", "www.")) and "exhibitoronlinemanual" not in href:
                website = clean_website(href)
                break
        emails = extract_emails(info) if info is not details else []
        phones = extract_phones(info) if info is not details else []

        about = block_text(soup.select_one("#pills-About"))
        new_products = block_text(soup.select_one("#pills-NewProduct"))

        company = CompanyData(
            name=name, official_website=website, country=country, hall=hall, booth=booth,
            description=about, new_products_text=new_products, email="; ".join(emails) or None,
            phone="; ".join(phones) or None, event_sectors=sectors)
        if website:
            sources.append(SourceRef(url=website, source_type="official_website_link"))

        event_base = url.split("/en/Exhibitor/")[0] if "/en/Exhibitor/" in url else \
            re.sub(r"/[a-z]{2}/Exhibitor/.*$", "", url)

        products: list[ProductData] = []
        partial = False
        for pane_id, kind in (("#pills-Products", "Product"), ("#pills-Brands", "Brand")):
            pane = soup.select_one(pane_id)
            if not pane:
                continue
            for card in pane.select(".card"):
                holder = card.select_one(".product-image-holder")
                listed_name = (holder.get("data-caption") if holder else None) or text_of(card.select_one("figcaption"))
                trigger = card.select_one("[onclick]")
                m = ONCLICK_RE.search(trigger.get("onclick", "")) if trigger else None
                desc = None
                detail_title = None
                ref = None
                if m:
                    ref = f"{kind.lower()}:{m.group(2)}"
                    try:
                        detail_title, desc = self._detail(kind, m.group(2), m.group(3), event_base, url)
                        pages.append(PageLog(url=f"{event_base}/Exhibitor/{kind}Description#{m.group(2)}",
                                             page_type=f"{kind.lower()}_detail", status="ok"))
                    except FetchError as exc:
                        partial = True
                        warnings.append(f"{kind} detail '{listed_name}' failed: {exc}")
                        pages.append(PageLog(url=f"{event_base}/Exhibitor/{kind}Description#{m.group(2)}",
                                             page_type=f"{kind.lower()}_detail", status="error",
                                             error_message=str(exc)))
                pname = listed_name or detail_title
                if not pname:
                    continue
                fields = labelled_fields(desc)
                is_brand = kind == "Brand"
                products.append(ProductData(
                    name=pname,
                    description=desc,
                    ingredients=fields.get("ingredients"),
                    raw_materials=fields.get("raw_materials"),
                    applications=fields.get("applications"),
                    services=fields.get("services"),
                    product_type="Brand" if is_brand else None,
                    source_url=f"{url}/{'brand' if is_brand else 'product'}",
                    evidence_text=(f"Listed under '{'Brands' if is_brand else 'Products'}' tab: {pname}"
                                   + (f" | Detail: {desc[:300]}" if desc else "")),
                    evidence_type=(EvidenceType.PROFILE_BRAND if is_brand else
                                   EvidenceType.PROFILE_PRODUCT_DETAIL if desc else EvidenceType.PROFILE_PRODUCT),
                    external_ref=ref,
                ))

        documents: list[DocumentRef] = []
        for pane_id, doc_type in (("#pills-Brochures", "brochure"), ("#pills-Press", "press_release")):
            pane = soup.select_one(pane_id)
            if not pane:
                continue
            for tr in pane.select("tr"):
                tds = tr.find_all("td")
                if not tds:
                    continue
                title = None
                for td in tds:
                    if not td.find(["a", "img"]):
                        title = text_of(td)
                        break
                view = None
                for a in tr.find_all("a", href=True):
                    if "View" in (a.get_text() or "") or is_pdf_url(a["href"]):
                        view = urljoin(url, a["href"])
                        break
                if not view:
                    continue
                if is_pdf_url(view):
                    documents.append(DocumentRef(title=title, url=view, doc_type=doc_type))
                else:
                    sources.append(SourceRef(url=view, source_type=f"{doc_type}_non_pdf"))

        status = ExtractionStatus.PARTIAL if partial else ExtractionStatus.SUCCESS
        return ProfileResult(company=company, products=products, documents=documents, sources=sources,
                             pages=pages, status=status, warnings=warnings)
