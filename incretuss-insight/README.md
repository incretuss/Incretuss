# Incretuss Insight: Universal Exhibition Exhibitor Crawler (v1.0)

A local Python tool for INCRETUSS PRIVATE LIMITED. Give it an exhibition website
and it does the following:

1. finds the exhibitor directory,
2. lists every exhibitor,
3. visits each exhibitor profile (company data, products, brands, brochures),
4. reads public brochure PDFs,
5. assigns normalised product categories, each with quoted evidence,
6. stores everything in SQLite and exports a standardised Excel workbook.

It runs on your own computer. It needs no cloud services and no API keys.

---

## 1. Install

You need Python 3.11 or newer.

```bash
cd incretuss-insight
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Playwright is only used for JavaScript-only directories. If you want that
fallback, install its browser once:

```bash
python -m playwright install chromium
```

## 2. Run

From the exhibition homepage (the directory is found automatically):

```bash
python main.py --url "https://expopharmtech.com/"
```

The tool prints the directory candidates it found, the proposed crawling
strategy and the adapter it chose. Press **Enter** to accept, or paste a
different directory URL. Progress is printed per exhibitor:

```
[17/513] Alianbio - ok: 5 products, 3 brands, PDFs 2/2 (14.0s) | totals: 17/513 processed, ok 17, partial 0, failed 0, products 94, websites 17
```

When the run finishes, the workbook is written to
`data/exports/<event-name>/Event_Exhibitor_Database.xlsx`.

### Change the exhibition

Pass a different `--url`. If discovery does not find the directory (or finds
the wrong page), give the directory yourself:

```bash
python main.py --directory-url "https://example-expo.com/exhibitors"
```

Each directory URL is stored as its own event in the same database.

### Useful options

| Option | Purpose |
|---|---|
| `--discover-only` | Show the discovered directory and strategy, then stop |
| `--limit 5` | Process only 5 profiles in this run (e.g. a first test) |
| `--max-exhibitors 50` | Stop the directory listing after 50 exhibitors |
| `--no-pdf` | Skip brochure PDFs |
| `--no-browser` | Never use Playwright |
| `--delay 2` | Seconds between requests to one host (default 1.0; robots.txt `Crawl-delay` always wins if higher) |
| `--adapter generic` | Force an adapter |
| `-y` | Non-interactive (accept the proposed directory) |
| `--list-events` | Show the events stored in the database |

### Resume an interrupted crawl

All work is saved after every listing page and every company. If a run stops
(Ctrl+C, network failure, closed laptop), continue it with:

```bash
python main.py --resume
```

Or, for an older event, use `python main.py --event-id 2` (find the id with
`--list-events`).

On resume, the tool does the following:

* continues the directory listing from the last saved page, and skips it entirely if the listing was already complete;
* processes only exhibitors that are still `pending`, plus `failed`/`partial`
  ones (up to 3 attempts each);
* never re-downloads companies that were already extracted successfully.

`--refresh` re-extracts every profile. `--refresh-listing` re-scans the
directory.

### Export the results again

```bash
python main.py --export-only                 # latest event
python main.py --export-only --event-id 1 --output my.xlsx
python main.py --reclassify                  # recompute categories after editing rules, then export
```

---

## 3. The Excel workbook

| Sheet | One row per | Notes |
|---|---|---|
| **Company_Master** | company | Specified columns, then `Brands`, `New_Products_Statement`, `Possible_Duplicates`, `Extraction_Notes`, `Extracted_At` |
| **Product_Catalogue** | product or brand | Specified columns, then `Original_Category`, `Category_Basis` |
| **Product_Categories** | company × normalised category | `Supporting_Products` names the products/sectors behind the category; `Basis` and `Evidence_Text` quote the source |
| **Sources** | URL used | Directory pages, profiles, official-website links, PDFs |
| **Crawl_Log** | request/page | `Error_Message` for failures, `Notes` for successes |
| **Unprocessed_Companies** | company not fully extracted | Reason and retry status |
| Documents | brochure/PDF | Pages, characters of text, path of the extracted text file |
| About | n/a | Run statistics and a glossary of the fields |

The workbook has frozen headers, auto-filters and readable column widths.

### Data rules (what you can trust)

* **Nothing is invented.** An empty cell means the source did not publish that
  value. For example, the Pharmtech directory publishes no city and no industry
  field, so those columns are empty.
* **Company names are stored exactly as the organiser published them.** The
  site's CSS upper-casing is not applied.
* **The official website** comes from the profile's website link. It is always kept
  separate from `Exhibitor_Profile_URL`. Social networks and the organiser's own
  domains are never taken as a company website.
* **E-mail and phone** are taken only when they are visibly published. Some
  Pharmtech profiles contain an e-mail inside an HTML comment, which hides it
  from visitors. Those addresses are deliberately not collected.
* **Products are kept apart from descriptions.** Product rows come only from
  product and brand listings. The free-text "New Products" tab goes to
  `New_Products_Statement`, not into the catalogue.
* **Ingredients, Raw_Materials, Applications and Services** are filled only when
  the text explicitly labels them (for example `Applications: ...`).
* **Brands** are rows with `Product_Type = Brand`. They do not count towards
  `Number_of_Products`.
* **Duplicates.** Two records are merged only when their exhibitor-profile URL
  is identical. Records with the same name or website domain are *flagged* in
  `Possible_Duplicates` and never merged.

### Categories: explicit vs inferred

`Event_Sectors` holds the organiser's own sectors, verbatim. The normalised
categories (Essential Oils, Aroma Chemicals, ... APIs, Excipients,
Manufacturing Equipment, ... Other, Unclassified) are kept separately. Each
normalised category records its **basis**:

| Basis | Meaning |
|---|---|
| `event_sector (organiser-assigned, mapped)` | The organiser put the company in that sector. The mapping to our category is a fixed table. |
| `product_text keyword rule (inferred)` | A keyword rule matched the product's own name or description. |
| `company_description keyword rule (inferred)` | A keyword rule matched the company description. |
| `pdf_text keyword rule (inferred)` | A keyword rule matched the brochure text. |

The rules are conservative:

* Organiser sector labels such as *"Natural extracts: plant extracts, animal
  extracts, nutraceutical ingredients, ..."* are mapped by their **heading**
  only ("Natural extracts"). This avoids awarding five categories for a single tick-box.
* If a product's **name** says it is equipment (a machine, tester, system,
  press, ...), its description cannot add ingredient categories. A capsule
  filler "for APIs" is equipment, not an API.
* Service names (qualification, validation, consulting, ...) are typed as `Service`.
* A product with no matching rule is `Unclassified`. It is never guessed.

The rules live in `extractors/product_extractor.py`. Organiser-specific sector
tables live in the adapter (`sector_overrides`). After you edit either, run
`python main.py --reclassify`. It updates the stored data without crawling again.

---

## 4. Architecture

```
incretuss-insight/
├── main.py                    CLI: discovery → strategy → listing → profiles → export
├── config.py                  all settings (delays, limits, paths, keywords)
├── crawler/
│   ├── fetcher.py             HTTPX client: throttling, robots.txt, retries, SSRF-checked redirects, size caps
│   ├── discovery.py           finds the exhibitor directory (links, sitemap, redirects, one extra hop)
│   ├── link_extractor.py      groups links by URL template → exhibitor-profile links
│   ├── pagination.py          rel=next / "Next" / ?page= / ?offset= pagination
│   ├── browser.py             Playwright fallback (scroll, "Load more"), every request SSRF-checked
│   └── spider.py              CrawlEngine: incremental saving, resume, categorisation, PDFs
├── adapters/
│   ├── __init__.py            adapter registry + automatic selection
│   ├── base_adapter.py        the adapter contract
│   ├── generic_adapter.py     heuristics for ordinary server-rendered directories
│   └── pharmtech_adapter.py   ITE "Exhibitor Online Manual" platform (Pharmtech & Ingredients)
├── extractors/
│   ├── company_extractor.py   visible e-mails/phones, website choice, hall/stand, description
│   ├── product_extractor.py   normalised categories, evidence, labelled fields, classifier interface
│   └── pdf_extractor.py       PyMuPDF text extraction, image-only detection
├── database/                  SQLite schema, Pydantic models, repository
├── exporters/excel_exporter.py
├── utils/                     logging, URL normalisation + SSRF guard, duplicate flags
├── data/{database,exports,raw,processed}
└── tests/                     offline tests with saved HTML fixtures
```

**Technology choices.**

* HTTPX does the HTTP work, BeautifulSoup/lxml parses HTML, and Pydantic validates every record.
* SQLite is the store of record, and Excel is only an export. pandas and openpyxl write the workbook, and PyMuPDF reads the PDFs.
* Playwright is used only when plain HTTP shows no exhibitors.
* **Scrapy is not used in v1.** The crawl is deliberately sequential and
  throttled, so Scrapy's concurrency brings no benefit. Its Twisted reactor would
  also complicate the interactive prompts, the per-redirect SSRF validation and
  the per-company commits that resume relies on. The adapter interface leaves
  room to add it later if needed.
* Streamlit is installed for a future user interface. There is no UI yet.
* **AI hook:** `extractors.product_extractor.CategoryClassifier` is a one-method
  protocol (`classify(text) -> [(category, evidence)]`). An LLM-backed classifier
  can be passed to `Categorizer(classifier=...)` without changing anything else.
  Unknown websites can likewise get an LLM-assisted adapter.

### Responsible crawling

* robots.txt is checked before every request, including redirect targets, and
  its `Crawl-delay` is honoured.
* Requests are sequential: 1 request per second per host by default, with jitter.
  Failed requests are retried with exponential back-off on errors, 429 and 5xx.
* No logins, no authentication bypass, no password-protected PDFs, and no hidden
  (commented-out) data.
* **SSRF protection:** only `http`/`https` on standard ports. URLs with
  credentials, internal host names, and private, loopback, link-local or reserved
  IPs are refused. Redirects are followed manually and every hop is re-validated.
  The Playwright fallback applies the same check to every browser request.
* Responses are size-capped (8 MB HTML, 25 MB PDF).

---

## 5. Adding another website adapter

Use the generic adapter first (`--discover-only`, then `--limit 5`). Write an
adapter only when the generic one misses exhibitors or fields. Typical reasons are
pagination that runs only through JavaScript or AJAX, or profile data that loads
through extra requests.

1. Save a listing page and a profile page and study them. Look at the network
   requests in the browser's developer tools, because there is often a simple JSON or HTML endpoint.
2. Create `adapters/myplatform_adapter.py`:

```python
from adapters.base_adapter import BaseAdapter, ListingPage, ProfileContext
from database.models import CompanyData, ExhibitorStub, ProductData, ProfileResult

class MyPlatformAdapter(BaseAdapter):
    name = "myplatform"
    description = "Example Expo platform"
    sector_overrides = {"Natural Ingredients": ["Natural Extracts"]}   # optional

    @classmethod
    def detect(cls, url, html):
        return 0.9 if "myplatform.com" in url else 0.0

    def iter_listing(self, directory_url, state):
        page = state.get("page", 1)
        while True:
            resp = self.fetcher.get(f"{directory_url}?page={page}")
            stubs = [...]                      # ExhibitorStub(name=..., profile_url=..., booth=...)
            yield ListingPage(stubs, resp.url, {"page": page + 1}, done=not stubs)
            if not stubs:
                return
            page += 1

    def extract_profile(self, ctx: ProfileContext) -> ProfileResult:
        resp = self.fetcher.get(ctx.profile_url)
        ...
        return ProfileResult(company=CompanyData(...), products=[ProductData(...)], documents=[...])
```

3. Register it in `adapters/__init__.py` (`ADAPTERS = [ExhibitorOnlineManualAdapter, MyPlatformAdapter, GenericAdapter]`).
4. Add a test with saved HTML fixtures (see `tests/test_pharmtech_adapter.py`).

Always use `self.fetcher`, never raw HTTP. It is what enforces robots.txt,
throttling and SSRF protection. The core engine, database and exporter stay
unchanged.

---

## 6. Tests

```bash
python -m pytest -q
```

The tests run offline from saved fixtures. They cover URL normalisation and
SSRF blocking, the categorisation rules, the Pharmtech adapter (listing,
pagination, profile, products, brands, PDFs, hidden-e-mail rule), and an
end-to-end generic crawl with a simulated failure, resume and Excel export.

---

## 7. Validation results and known limitations

See [`VALIDATION.md`](VALIDATION.md) for the real-website test results:
Pharmtech & Ingredients 2026 (full crawl) and Naturally Good Expo (generic
adapter). It records what worked automatically, what needed an adapter, and
the known gaps:

* scanned or image-only PDFs are detected but not OCR'd;
* the keyword categoriser is English-centric, so Russian-only product text often stays `Unclassified`;
* directories that need logins, or that only offer infinite scroll through private APIs, are not supported.
