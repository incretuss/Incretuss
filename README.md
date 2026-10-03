# incretuss.com

Static site for Incretuss Private Limited, deployed on Netlify (publish directory: repo root).

## Editing content

The HTML pages in the repo root are **generated** — do not edit them directly.

- Company facts, categories, navigation: `src/content/site.mjs`
- Product data (all categories, used by pages and site search): `data/products.json`
- Long-form botanical copy (overview, applications, FAQs, Ginger grades): `src/content/botanicals.json`
- Page templates: `src/pages/*.mjs`; shared header/footer: `src/lib/layout.mjs`; components: `src/lib/components.mjs`
- Styles: `style.css`; scripts: `js/`

After changing anything in `src/` or `data/`, run:

    npm run build

and commit the regenerated HTML and `sitemap.xml`.

## Event brochure (`/brochure.html`)

The brochure shows one section at a time — Botanical Extracts, Nutraceutical
Ingredients or Cosmetic Ingredients — with tabs to switch. Before an event,
edit `data/brochure.json`:

    {
      "defaultSection": "cosmetics",
      "event": "Vitafoods Asia 2026"
    }

- `defaultSection`: `botanicals`, `nutraceuticals` or `cosmetics` — the section that opens first.
- `event`: optional; shows "Meet us at …" on the brochure. Leave `""` to hide it.

Commit and push; no rebuild is needed for these two settings (running
`npm run build` as well keeps the HTML in step). A link can also open a
specific section regardless of the default, e.g. for a QR code:
`https://incretuss.com/brochure.html?section=nutraceuticals`.

The contact form posts to `netlify/functions/contact.js` (Resend); see `.env.example`.
