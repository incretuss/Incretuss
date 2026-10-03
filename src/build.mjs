// Static site generator for incretuss.com.
//
// Usage: npm run build   (node src/build.mjs)
//
// Renders every page from src/pages/* and the product data in
// data/products.json + src/content/botanicals.json, then writes the HTML
// files and sitemap.xml to the repository root, which is what Netlify
// publishes. No dependencies: Node 18+ only.
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { page } from './lib/layout.mjs';
import { CATEGORIES } from './content/site.mjs';
import { PRODUCTS, counts } from './lib/catalogue.mjs';
import home from './pages/home.mjs';
import brochurePage from './pages/brochure.mjs';
import { productsIndex, categoryPage } from './pages/catalogue.mjs';
import { productPage } from './pages/product.mjs';
import { aboutPage, applicationsPage, comparePage, contactPage, notFoundPage, qualityPage } from './pages/company.mjs';

const root = new URL('../', import.meta.url);

const pages = [
  home(),
  productsIndex(),
  ...CATEGORIES.map(categoryPage),
  ...PRODUCTS.map(productPage),
  applicationsPage(),
  qualityPage(),
  aboutPage(),
  contactPage(),
  comparePage(),
  brochurePage(),
  notFoundPage(),
];

const seen = new Set();
for (const p of pages) {
  if (seen.has(p.path)) throw new Error('Duplicate output path: ' + p.path);
  seen.add(p.path);
  writeFileSync(new URL(p.path, root), page({ ...p, counts }));
}

// Superseded by one static page per compound (see netlify.toml redirect).
for (const old of ['cosmetic.html', 'js/cosmetic-page.js', 'js/products-page.js', 'brochure_styles.css', 'brochure_script.js']) {
  if (existsSync(new URL(old, root))) unlinkSync(new URL(old, root));
}

const today = new Date().toISOString().slice(0, 10);
const priority = (path) =>
  path === 'index.html' ? '1.0' : path === 'products.html' || CATEGORIES.some((c) => c.page === path) ? '0.9' : '0.7';
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages
    .filter((p) => !p.noindex)
    .map(
      (p) =>
        `  <url><loc>https://incretuss.com/${p.path === 'index.html' ? '' : p.path}</loc><lastmod>${today}</lastmod><priority>${priority(p.path)}</priority></url>`
    )
    .join('\n') +
  '\n</urlset>\n';
writeFileSync(new URL('sitemap.xml', root), sitemap);

console.log(`Built ${pages.length} pages + sitemap.xml`);
