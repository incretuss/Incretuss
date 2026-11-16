# incretuss.com

Static site for Incretuss Private Limited, deployed on Netlify (publish directory: repo root).

## Editing content

The HTML pages in the repo root are **generated**. Do not edit them directly.

- Company facts, categories, navigation: `src/content/site.mjs`
- Product data (all categories, used by pages and site search): `data/products.json`
- Long-form botanical copy (overview, applications, FAQs, Ginger grades): `src/content/botanicals.json`
- Page templates: `src/pages/*.mjs`; shared header/footer: `src/lib/layout.mjs`; components: `src/lib/components.mjs`
- Styles: `style.css`; scripts: `js/`

After changing anything in `src/` or `data/`, run:

    npm run build

and commit the regenerated HTML and `sitemap.xml`.

## Event brochure (`/brochure.html`)

The brochure shows one section at a time (Botanical Extracts, Nutraceutical
Ingredients, Aroma Chemicals, or Cosmetics & Personal Care, which gathers the
botanicals and fragrance materials relevant to cosmetics) with tabs to switch. Before an event,
edit `data/brochure.json`:

    {
      "defaultSection": "cosmetics",
      "event": "Vitafoods Asia 2026"
    }

- `defaultSection`: `botanicals`, `nutraceuticals`, `aroma` or `cosmetics`: the section that opens first.
- `event`: optional; shows "Meet us at …" on the brochure. Leave `""` to hide it.

Commit and push; no rebuild is needed for these two settings (running
`npm run build` as well keeps the HTML in step). A link can also open a
specific section regardless of the default, e.g. for a QR code:
`https://incretuss.com/brochure.html?section=nutraceuticals`.

## Aroma chemicals data

Compounds in `data/products.json` (category `aroma-chemicals`) carry only
verified fields: `name`, `synonym`, `cas`, `group` (methyl / ethyl /
symmetric / aryl, see `COMPOUND_GROUPS` in `src/content/site.mjs`) and
`applications`. Set `"casUnverified": true` to keep a CAS number in the data
without showing it until it is confirmed. Do not describe these compounds as
cosmetic ingredients or claim regulatory status (IFRA, FEMA, etc.) without
supporting documents.

The contact form posts to `netlify/functions/contact.js` (Resend); see `.env.example`.

## Pharma section (`/pharma/`)

Generated from `data/pharma-catalogue.csv` (the single source of truth;
columns `product, category, therapeutic_area, dosage_form, patent_note`).
To update the range, replace the CSV and run `npm run build`; the whole
`pharma/` folder is regenerated, and products removed from the CSV lose
their pages.

- Category names, intro lines, documentation and compliance wording:
  `src/content/pharma.mjs` (`category` in the CSV must match a name there).
- Templates: `src/pages/pharma.mjs`; data helpers: `src/lib/pharma.mjs`.
- Styles: `pharma.css` (pharma pages only); script: `js/pharma.js`.
- Enquiries post to `/api/contact` with `type: "pharma"` and go to
  `PHARMA_RECEIVER_EMAIL` (default `info@incretuss.com`).
- Brief and catalogue sources (including the Arene Lifesciences APIs):
  `src/content/pharma-brief.md`.
