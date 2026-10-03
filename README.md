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

The contact form posts to `netlify/functions/contact.js` (Resend); see `.env.example`.
