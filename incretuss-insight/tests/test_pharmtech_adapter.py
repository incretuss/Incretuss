from adapters import select_adapter
from adapters.base_adapter import ProfileContext
from adapters.pharmtech_adapter import ExhibitorOnlineManualAdapter
from database.models import ExtractionStatus
from tests.conftest import FakeFetcher, fixture_text

BASE = "https://exhibitors-itegroup.exhibitoronlinemanual.com"
DIR = f"{BASE}/pharmtech-and-ingredients-2026/en/Exhibitor"
ALIANBIO = f"{DIR}/ExbDetails/MzIzMjI="


def test_detection():
    cls, score = select_adapter(DIR, fixture_text("eom_listing.html"))
    assert cls is ExhibitorOnlineManualAdapter and score >= 0.9


def test_listing_cards_parse_all_24_including_card_without_title_link():
    stubs = ExhibitorOnlineManualAdapter._parse_cards(fixture_text("eom_listing.html"), DIR)
    assert len(stubs) == 24
    aix = next(s for s in stubs if s.name == "AIX LAB")
    assert aix.profile_url.endswith("/ExbDetails/MzIzMDc=")   # recovered from footer link
    assert aix.hall == "Pavilion 2 Hall 8" and aix.booth == "C4051" and aix.country == "Russia"
    # Names preserved exactly as published (no upper-casing, trailing whitespace removed)
    assert any(s.name == "Accumedi Solutions Co., LTD." for s in stubs)


def test_listing_pagination_resumes_from_offset(settings):
    page2 = fixture_text("eom_ajax_page2.html")
    routes = {("GET", DIR): fixture_text("eom_listing.html"),
              ("POST", f"{BASE}/en/Exhibitor/ajaxPaginationData/*"): page2}
    f = FakeFetcher(routes)
    ad = ExhibitorOnlineManualAdapter(f, settings)
    pages = ad.iter_listing(DIR, {"next_offset": 24})
    first = next(pages)
    assert first.expected_total == 516
    assert first.state == {"next_offset": 48}
    post = [c for c in f.calls if c[0] == "POST"][0]
    assert post[1].endswith("/ajaxPaginationData/24") and post[2]["event_id"] == "25"


def _profile_fetcher():
    routes = {
        ("GET", ALIANBIO): fixture_text("eom_profile_alianbio.html"),
        ("POST", f"{BASE}/pharmtech-and-ingredients-2026/Exhibitor/ProductDescription"):
            lambda url, data: (f'<div class="modal-header"><h5 class="modal-title">P{data["product_id"]}</h5></div>'
                               f'<div class="modal-body">Description of {data["product_id"]}.\n'
                               f'Applications: protein purification</div>'),
        ("POST", f"{BASE}/pharmtech-and-ingredients-2026/Exhibitor/BrandDescription"):
            '<div class="modal-body">Brand text</div>',
    }
    return FakeFetcher(routes)


def test_profile_extraction(settings):
    ad = ExhibitorOnlineManualAdapter(_profile_fetcher(), settings)
    r = ad.extract_profile(ProfileContext(company_id="E01-C0001", name="Alianbio", profile_url=ALIANBIO))
    c = r.company
    assert c.name == "Alianbio"
    assert c.official_website == "https://www.alianbio.com"
    assert c.country == "Russia" and c.hall == "Pavilion 2 Hall 8" and c.booth == "C3169"
    assert c.description.startswith("Alianbio offers")
    # e-mail exists only inside an HTML comment on this page: must NOT be collected
    assert c.email is None
    sectors = {s.sector: s.subsectors for s in c.event_sectors}
    assert "Single use bioreactors" in sectors["Equipment and consumables for biotechnology manufacturing"]
    products = [p for p in r.products if p.product_type != "Brand"]
    brands = [p for p in r.products if p.product_type == "Brand"]
    assert [p.name for p in products][:2] == ["Chromatography resins", "Lab bioreactor"]
    assert len(products) == 5 and {b.name for b in brands} == {"TJX", "LISURE", "Cobetter"}
    assert products[0].applications == "protein purification"
    assert products[0].external_ref == "product:97183"
    assert {d.title for d in r.documents} == {"Accelerated antibody development with TJX equipment",
                                              "Chromatography equipment"}
    assert all(d.url.endswith(".pdf") for d in r.documents)
    assert r.status == ExtractionStatus.SUCCESS


def test_product_detail_failure_gives_partial(settings):
    f = _profile_fetcher()
    del f.routes[("POST", f"{BASE}/pharmtech-and-ingredients-2026/Exhibitor/ProductDescription")]
    ad = ExhibitorOnlineManualAdapter(f, settings)
    r = ad.extract_profile(ProfileContext(company_id="E01-C0001", name="Alianbio", profile_url=ALIANBIO))
    assert r.status == ExtractionStatus.PARTIAL
    assert len([p for p in r.products if p.product_type != "Brand"]) == 5   # listing names still kept


def test_new_products_tab_is_not_a_product_listing(settings):
    url = f"{DIR}/ExbDetails/MzU0ODc="
    f = FakeFetcher({("GET", url): fixture_text("eom_profile_anwik.html"),
                     ("POST", f"{BASE}/pharmtech-and-ingredients-2026/Exhibitor/ProductDescription"): "<div class='modal-body'></div>"})
    r = ExhibitorOnlineManualAdapter(f, settings).extract_profile(
        ProfileContext(company_id="x", name="ANWIK RESEARCH LABS", profile_url=url))
    assert r.company.new_products_text.startswith("Anwik Research Labs is advancing")
    assert len(r.products) == 1
