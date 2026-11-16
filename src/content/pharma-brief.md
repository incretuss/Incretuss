Add a new "Pharma" section to the Incretuss website (incretuss.com). Incretuss is a B2B export company. Today the site sells botanical extracts, nutraceutical ingredients and aroma chemicals. This section adds pharmaceutical products that we source and export: APIs, API intermediates and finished generic medicines. The audience is pharmaceutical manufacturers, importers, distributors and tender buyers, not patients.

The file `data/pharma-catalogue.csv` (831 rows) is the full product list. Columns: product, category, therapeutic_area, dosage_form, patent_note. Use it as the only source of products. Do not invent, rename or add products. Do not show prices.

### Catalogue sources
- 802 rows: the original `incretuss_pharma_catalogue.csv`.
- 29 rows: the named portfolio of Arene Lifesciences (API and intermediates maker, Hyderabad; company report of 27 October 2026), added to **Active Pharmaceutical Ingredients**:
  - Antivirals (HIV & Hepatitis): Tenofovir Disoproxil Fumarate, Tenofovir Alafenamide Fumarate, Tenofovir Intermediates, Emtricitabine, Abacavir Sulphate, Zidovudine, Efavirenz, Nevirapine, Etravirine Intermediates, Atazanavir Sulphate, Darunavir, Lopinavir, Ritonavir, Saquinavir Mesylate, Fosamprenavir Calcium, Dolutegravir Sodium, Raltegravir, Bictegravir Intermediates, Daclatasvir, Valganciclovir Hydrochloride, Acyclovir, Oseltamivir Phosphate, Nirmatrelvir.
  - Anti-infectives: Bedaquiline Intermediates, Linezolid.
  - Cardiovascular: Amlodipine Besylate.
  - Blood & Haematology: Clopidogrel Bisulphate.
  - CNS & Psychiatry: Trazodone.
  - Pain & Inflammation: Tapentadol.
  - Not added: Rilpivirine HCl (already listed as Rilpivirine).
  - Etravirine, Bictegravir and Bedaquiline are offered as intermediates only; Tenofovir is also offered as intermediates. These rows use dosage_form "Intermediate (for API synthesis)".
  - patent_note = yes for Tenofovir Alafenamide Fumarate, Dolutegravir Sodium, Raltegravir, Bictegravir Intermediates, Daclatasvir, Nirmatrelvir, Bedaquiline Intermediates and Tapentadol.
- Never name a supplier (Arene or any other) on the website.

## 1. Navigation and URLs
- Add "Pharma" to the main navigation, next to the existing product menu.
- /pharma: landing page
- /pharma/[category-slug]: one page per category
- /pharma/[category-slug]/[product-slug]: one page per product (if a product appears in two categories, give it a page in each)
- /pharma/partnering: a page with no product list

## 2. Categories (level 1), in this order, with these intro lines
1. Active Pharmaceutical Ingredients: Bulk drug substances and intermediates for formulators. Antiretroviral, inhalation, cardiovascular, CNS, oncology and specialty molecules.
2. Tablets & Capsules: Finished tablets and capsules, including dispersible, sustained-release and effervescent forms.
3. Injectables & Sterile Products: Liquid and lyophilised vials, ampoules, pre-filled syringes and dental cartridges.
4. Inhalers & Nasal Products: Metered-dose inhalers, inhalation solutions, nasal sprays and drops.
5. Eye & Ear Care: Sterile eye drops, eye ointments and ear drops.
6. Syrups, Suspensions & Sachets: Syrups, dry syrups, oral drops, granules and oral jellies.
7. Creams, Ointments & Solutions: Dermatological creams, gels, ointments, antiseptic and topical solutions.
8. Suppositories & Pessaries: Rectal and vaginal dosage forms.
9. Veterinary: Intramammary suspensions and livestock products.
10. Partnering & Licensing: Regulated-market generics for licensing, dossier supply or technology transfer. List no products here. Show a short explanation and a "Discuss a Partnership" button that opens the enquiry form.

## 3. Therapeutic area (level 2)
Use therapeutic_area as a filter on every category page, not as a separate menu. Show only the areas present in that category, each with its product count. Sort products alphabetically within each area.

## 4. Page templates
**Landing page (/pharma)**
- Hero heading: "Pharmaceutical supply, precisely sourced." Subline: "APIs and finished generics for manufacturers, importers and tender buyers worldwide."
- A grid of the 10 category cards, each with its name, intro line and product count.
- A short "How we work" strip with three steps: Send your requirement → We share specs, COA and dossier status → Quote and supply.
- Closing call-to-action band with a "Request a Quote" button.

**Category page**
- Heading, intro line and product count.
- Therapeutic-area filter chips.
- Search box that filters by product name as you type.
- Product list: a compact card or table row per product, showing name, dosage form and therapeutic area, plus a "Request a Quote" button.
- Paginate or lazy-load at 50 items. Tablets & Capsules has 371 products and Injectables has 204, so the page must stay fast.

**Product page**
- Product name as H1.
- Spec rows in a monospace key–value list: Category, Dosage form, Therapeutic area, Documentation ("COA, specifications, COPP and CTD dossier available on request").
- For APIs, use Documentation: "COA, specifications and DMF available on request".
- For intermediates (dosage_form "Intermediate (for API synthesis)"), use Documentation: "COA and specifications available on request".
- If patent_note = yes, show this note under the specs: "Supplied only to markets where no valid patent or regulatory exclusivity applies. Availability is confirmed per destination country."
- "Request a Quote" button. The enquiry form is prefilled with the product name.
- Related products: up to 6 from the same therapeutic area.

## 5. Enquiry form (shared)
- Fields: Name, Company, Country, Email, Phone, Product (prefilled), Required form/strength, Quantity, Destination market, Message.
- Add a required checkbox: "I confirm we hold the licence required to import or distribute pharmaceutical products in our country."
- Send submissions to info@incretuss.com (the PHARMA_RECEIVER_EMAIL variable in Netlify overrides this; see `.env.example`).

## 6. Compliance text (show in the footer of every /pharma page)
"Products listed are available for business-to-business supply to licensed pharmaceutical companies, distributors and government buyers only. Product availability depends on registration and patent status in the destination country. Information on this site is not medical advice and does not promote any product to patients."
- No health claims, no "cures"/"treats" language, no prices, no patient-facing copy, no stock images of pills or people.

## 7. Design (identical to the existing Incretuss site)
- The Pharma pages must look exactly like the rest of incretuss.com. Do not introduce new fonts, colours, corner radii or shadows, and do not restyle the site.
- Use the site's existing tokens in `style.css`: warm paper ground (#F6F5F0), ink (#1A1D1B), deep green (#1F3A26) for buttons, bands and footer, square 2px corners, 1px hairline rules, no shadows.
- Use the site's existing fonts: Source Serif 4 for headings, IBM Plex Sans for body and buttons, IBM Plex Mono for spec values.
- Reuse the site's existing components: page header, labels, key-spec rows, register tables (Aroma Chemicals page), steps, category links, inquiry band and contact-form fields. Only add styles for things the site has no component for (area filter chips and mobile drawer, enquiry dialog, licence checkbox).
- No gradients, blue or purple. 24px outline icons, no emoji.
- Voice: manufacturer to manufacturer. Section headings are short statements ending in a full stop ("Our pharma range."). Buttons are verb-first Title Case ("Request a Quote"). No superlatives, no exclamation marks, no urgency.
- Use the existing Incretuss logo files; do not redraw the logo.
- Text contrast must meet WCAG AA.

## 8. Technical
- Generate category and product pages from the CSV so the list can be updated by replacing the file.
- Make the CSV the single source of truth: replace `data/pharma-catalogue.csv`, run `npm run build`, and commit the regenerated `pharma/` folder and `sitemap.xml`.
- Fully responsive. The filters collapse into a drawer on mobile.
- SEO:
  - Unique title and meta description per page, e.g. "Atorvastatin Tablets | Incretuss Pharma".
  - Product schema (no price or offers).
  - Breadcrumbs: Home / Pharma / Category / Product, in the site's existing breadcrumb style.
  - Add every /pharma page to the sitemap.
- Do not change existing botanical pages, except for adding the nav link and one "Also from Incretuss: Pharma" link on the home page.
