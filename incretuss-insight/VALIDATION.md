# Validation against real websites (November 2026)

All numbers below come from real runs of this code against the live sites.
Nothing was entered by hand.

## 1. Pharmtech & Ingredients 2026 (primary test case)

Command:

```bash
python main.py --url "https://expopharmtech.com/" --yes
```

### Discovery (automatic)

| Step | Result |
|---|---|
| Start page | `https://expopharmtech.com/`. The sitemap (282 URLs) and the page links were scored. |
| Best on-site candidate | `/exhibitor-list/`. It is a "Redirecting… click here" landing page, so it has no exhibitors itself. |
| Hop | The client-side redirect was followed to `exhibitors-itegroup.exhibitoronlinemanual.com/pharmtech-and-ingredients-2026/en/Exhibitor` |
| Adapter | `exhibitoronlinemanual`, detected with confidence 1.0 (the page reports 516 companies) |
| Rejected | Country landing pages (`/indian-exhibitors/` etc.), which have only a few links each |

Two fixes came out of this test:

* negative keywords such as "manual" had matched the platform's host name, so they now apply only to the path;
* client-side redirect pages are now recognised.

### Crawl

| Metric | Value |
|---|---|
| Exhibitors reported by the directory | 516 |
| Exhibitors stored | **516** (0 duplicates, 0 missing) |
| Profiles extracted successfully | 512 |
| Partial | 4: listed **without a profile page** (only listing data exists) |
| Failed | 0 |
| Products | 1,813 (from 217 companies; the other companies list no products) |
| Brands | 110 |
| Official websites | 503 (none points to social media or organiser domains) |
| Brochure PDFs | 184: 122 with a text layer (1,584 pages, 1.76 M characters), 62 image-only |
| HTTP requests / time | ≈2,700 requests in 51 minutes (1 request/second, sequential) |
| Crawl-log errors | 0 |

Field coverage (companies with a value):

| Field | Filled | Note |
|---|---|---|
| Company_Name, Country, Booth_Number | 516 | |
| Hall_Number | 512 | 4 exhibitors publish no hall |
| Official_Website | 503 | The 13 without one publish no website link. Checked manually, e.g. "Quality+". |
| Company_Description | 497 | |
| Event_Sectors | 505 | |
| New_Products_Statement | 210 | The free-text "New Products" tab, kept out of the product catalogue |
| Applications (labelled) | 78 products | Only where the text says "Application(s): …" |
| City, Industry | 0 | Not published by this platform |
| Email, Phone | 0 | Not visibly published. Some profiles hold an e-mail inside an HTML comment; that is deliberately not collected. |

### Problems found during validation and fixed

1. **Malformed markup.** The platform emits `<h6">` tags, which lxml names `h6"`,
   and nests the stand and country inside them. The hall was lost until the
   parser matched these tags.
2. **Cards whose title link is `javascript:void(0)`** (e.g. AIX LAB). The profile
   URL is now recovered from the card's tab links.
3. **Exhibitors without a profile page.** They were first keyed with a URL
   `#fragment`. URL normalisation removes fragments, so 4 such exhibitors
   collapsed into one record, which also carried another company's stand
   number. They now get distinct keys. The corrupted record was removed and
   re-created, and a regression test was added. Result: 516 of 516.
4. **Over-eager categories.** Equipment descriptions name what the machine
   processes ("capsule filler … APIs"). When the product name says it is
   equipment, its description now cannot add ingredient categories. The same
   applies to packaging materials (vials, foils), whose descriptions talk about
   the "active ingredients" they protect.
5. **Sector bundles.** Organiser sectors such as "Natural extracts: plant
   extracts, animal extracts, …, nutraceutical ingredients, cosmeceutical
   ingredients" are mapped by their heading only.

### Categories (companies per normalised category)

Manufacturing Equipment 314 · Other 248 · APIs 168 · Pharmaceutical Ingredients 159 ·
Biotechnology 157 · Laboratory Equipment 154 · Packaging Equipment 131 ·
Nutraceutical Ingredients 120 · Excipients 95 · Contract Manufacturing 92 ·
Pharmaceutical Intermediates 84 · Natural Extracts 78 · Cosmetic Ingredients 69 ·
Botanical Extracts 22 · Food Ingredients 19 · Fragrance Ingredients 8 ·
Essential Oils 1 · Aroma Chemicals 1

Basis of the 2,737 company-category links:

| Basis | Links |
|---|---|
| organiser sector | 1,509 |
| company description | 687 |
| product text | 364 |
| PDF text | 177 |

**639 of 1,813 products (35%) are `Unclassified`.** Most are bare substance
names with only a CAS number or a dosage (e.g. "Ribavirin", "L-Citrulline
98.5%"), or Russian-only text. They were left unclassified because the page
states no category. An LLM classifier (see README) is the natural next step
for these.

**Example of why the evidence columns matter.** *Sabiha Research & Development*
is tagged "Aroma Chemicals" because its price-list PDF lists *Vanillin*.
On inspection, it is a vanillin **reference standard**, so the category is a
weak inference. The `Basis` column says `pdf_text keyword rule (inferred)`, and the
quoted evidence lets you judge it in seconds.

## 2. Naturally Good Expo 2026 (structurally different site, generic adapter)

`https://naturallygood.com.au/` is a natural-products trade show in Sydney.
Its directory is a WordPress page with cards, `?id=` query-string profiles,
`?offset=` pagination, category "chips" and `Crawl-delay: 10` in robots.txt.

```bash
python main.py --url "https://naturallygood.com.au/" --discover-only
python main.py --directory-url "https://naturallygood.com.au/exhibitor-directory/" --limit 8
```

| Check | Result |
|---|---|
| Discovery | Found `/exhibitor-directory/` automatically (page says "154 EXHIBITORS FOUND") |
| Adapter | `generic`. No site-specific code was written. |
| Listing | 16 profile links per page detected from the URL template; offset pagination followed; **154 / 154** exhibitors |
| robots.txt | `Crawl-delay: 10` honoured (~20 s per profile) |
| Profiles | Name, stand, country, official website (globe icon, not Facebook/LinkedIn), description and organiser categories were all correct on the profiles checked |
| Brochures | "Promotional PDF" links found. Their host (`divcomau.my.salesforce.com`) is outside this test machine's network allowlist, so they are recorded as errors. They will download on a normal internet connection. |
| Products | None: this site has no product listings on profiles |
| Interrupt / resume | Ctrl+C mid-run: work saved and workbook written. `--resume` skipped the finished listing and continued with the next pending exhibitors. |

**What worked automatically:** discovery, listing, pagination, names, stand,
country, website, description, organiser categories, PDF links, resume.

**What needed generic improvements** (no adapter): the call-to-action text
"View Profile" had been taken as a company name, and category chips and
PDF-labelled links without a `.pdf` URL were not recognised. These were fixed in the generic
adapter and covered by tests that use saved pages from this site.

**What would need an adapter:** nothing on this site. On Pharmtech, the generic
adapter can read only the first 24 exhibitors, because further pages load
through a JavaScript POST. That is why a platform adapter exists for it.

## 3. Limitations (honest list)

* Image-only PDFs (62 here) are detected and listed, but not OCR'd.
* The keyword categoriser is English-centric. Russian-only text often stays `Unclassified`.
* Directories behind logins, CAPTCHAs, or private infinite-scroll APIs are not crawled.
  The Playwright fallback handles ordinary JavaScript pages, scrolling and
  "Load more" buttons.
* The generic adapter is heuristic. Always run `--discover-only` and `--limit 5`
  on a new site and look at the result before a full crawl.
