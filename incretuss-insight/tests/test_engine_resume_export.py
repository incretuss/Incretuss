"""End-to-end (offline): generic adapter on a synthetic site, resume, export."""
import openpyxl

from adapters.generic_adapter import GenericAdapter
from crawler.spider import CrawlEngine
from database.connection import connect
from database.repository import Repository
from exporters.excel_exporter import ExcelExporter
from tests.conftest import FakeFetcher

SITE = "https://expo.example.org"


def listing(page: int) -> str:
    start = (page - 1) * 3
    cards = "".join(
        f'<div class="exhibitor-card"><h3><a href="/exhibitors/company-{i}">Company {i} GmbH</a></h3>'
        f'<p>Hall 4 Stand {100 + i}</p></div>' for i in range(start + 1, start + 4))
    nxt = f'<a rel="next" href="/exhibitors?page={page + 1}">Next</a>' if page < 3 else ""
    return (f"<html><body><nav><a href='/about'>About</a></nav><main><h1>Exhibitors</h1>{cards}"
            f"<div class='pager'>{nxt}</div></main></body></html>")


def profile(i: int) -> str:
    products = "" if i % 2 else (
        "<h2>Products</h2><ul><li><strong>Lavender essential oil</strong> steam distilled</li>"
        "<li><strong>Paprika oleoresin</strong></li></ul>")
    return (f"<html><body><main><h1>Company {i} GmbH</h1><p>Country: Germany</p>"
            f"<a href='https://www.company{i}.de'>www.company{i}.de</a>"
            f"<a href='https://www.linkedin.com/company/c{i}'>LinkedIn</a>"
            f"<a href='mailto:info@company{i}.de'>info@company{i}.de</a><p>Hall 4, Stand {100 + i}</p>"
            f"<h2>About us</h2><p>Company {i} is a family-owned producer of natural ingredients. "
            f"We supply manufacturers worldwide.</p>{products}"
            f"<a href='/files/brochure{i}.pdf'>Brochure</a></main></body></html>")


def make_routes(fail_ids=()):
    routes = {("GET", f"{SITE}/exhibitors"): listing(1)}
    for p in (2, 3):
        routes[("GET", f"{SITE}/exhibitors?page={p}")] = listing(p)
    for i in range(1, 10):
        if i not in fail_ids:
            routes[("GET", f"{SITE}/exhibitors/company-{i}")] = profile(i)
    return routes


def test_generic_crawl_resume_and_export(settings, tmp_path):
    conn = connect(settings.db_path)
    repo = Repository(conn)
    settings.extract_pdfs = False
    event = repo.get_or_create_event(f"{SITE}/exhibitors", "Test Expo", SITE, "generic")

    # First run: profile 5 is down
    f = FakeFetcher(make_routes(fail_ids={5}))
    ad = GenericAdapter(f, settings)
    ad.exclude_domains(SITE)
    eng = CrawlEngine(settings, repo, f, ad, event["event_id"])
    eng.run_listing(f"{SITE}/exhibitors")
    eng.run_profiles(limit=6)
    st = repo.stats(event["event_id"])
    assert st["discovered"] == 9
    assert st["processed"] == 6 and st["failed"] == 1 and st["pending"] == 3

    c1 = repo.get_company("E01-C0001")
    assert c1["company_name"] == "Company 1 GmbH"
    assert c1["official_website"] == "https://www.company1.de"     # not LinkedIn, not the expo site
    assert c1["email"] == "info@company1.de"
    assert c1["country"] == "Germany" and c1["booth"] == "101"
    assert "family-owned" in c1["description"]

    # Resume: site recovered. Listing is not re-scanned; pending + failed are processed.
    f2 = FakeFetcher(make_routes())
    ad2 = GenericAdapter(f2, settings)
    ad2.exclude_domains(SITE)
    eng2 = CrawlEngine(settings, repo, f2, ad2, event["event_id"])
    eng2.run_listing(f"{SITE}/exhibitors")
    assert not any("page=" in c[1] for c in f2.calls)
    eng2.run_profiles()
    st = repo.stats(event["event_id"])
    assert st["processed"] == 9 and st["failed"] == 0 and st["success"] == 9
    fetched = {c[1] for c in f2.calls}
    assert f"{SITE}/exhibitors/company-1" not in fetched          # already done, not re-fetched
    assert f"{SITE}/exhibitors/company-5" in fetched

    # Products and categories
    prods = conn.execute("SELECT * FROM products WHERE company_id='E01-C0002'").fetchall()
    assert {p["product_name"] for p in prods} == {"Lavender essential oil", "Paprika oleoresin"}
    lav = next(p for p in prods if p["product_name"] == "Lavender essential oil")
    assert lav["product_category"] == "Essential Oils" and lav["product_type"] == "Ingredient"

    # Export
    out = ExcelExporter(repo).export(event["event_id"], tmp_path / "out.xlsx")
    wb = openpyxl.load_workbook(out)
    assert wb.sheetnames[:6] == ["Company_Master", "Product_Catalogue", "Product_Categories", "Sources",
                                 "Crawl_Log", "Unprocessed_Companies"]
    ws = wb["Company_Master"]
    header = [c.value for c in ws[1]]
    assert header[:16] == ["Company_ID", "Company_Name", "Official_Website", "Exhibitor_Profile_URL", "Country",
                           "City", "Industry", "Company_Description", "Email", "Phone", "Hall_Number",
                           "Booth_Number", "Event_Sectors", "Product_Categories", "Number_of_Products",
                           "Extraction_Status"]
    assert ws.freeze_panes == "C2" and ws.auto_filter.ref
    assert ws.max_row == 10
    pc = [c.value for c in wb["Product_Catalogue"][1]]
    assert pc[:13] == ["Company_ID", "Company_Name", "Product_Name", "Product_Category", "Product_Description",
                       "Ingredients", "Raw_Materials", "Applications", "Product_Type", "Services", "Source_URL",
                       "Evidence_Text", "Evidence_Type"]
    assert wb["Unprocessed_Companies"].max_row == 1   # header only: everything processed
    conn.close()


def test_duplicate_profile_urls_are_not_double_counted(settings):
    conn = connect(settings.db_path)
    repo = Repository(conn)
    from database.models import ExhibitorStub
    ev = repo.get_or_create_event(f"{SITE}/x", None, None, "generic")["event_id"]
    a, new1 = repo.add_stub(ev, ExhibitorStub(name="Acme", profile_url=f"{SITE}/e/1?utm_source=x"))
    b, new2 = repo.add_stub(ev, ExhibitorStub(name="Acme", profile_url=f"{SITE}/e/1#top"))
    c, new3 = repo.add_stub(ev, ExhibitorStub(name="Acme", profile_url=f"{SITE}/e/2"))
    assert a == b and new1 and not new2
    assert c != a and new3        # same name, different profile: kept separate (flagged, not merged)
    from utils.deduplication import find_possible_duplicates
    flags = find_possible_duplicates([{"company_id": a, "company_name": "Acme Ltd", "official_website": None},
                                      {"company_id": c, "company_name": "ACME", "official_website": None}])
    assert a in flags and c in flags
    conn.close()
