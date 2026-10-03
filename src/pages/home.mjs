import { CATEGORIES, PROCESS, QUALITY, SITE } from '../content/site.mjs';
import { esc, icons } from '../lib/html.mjs';
import { PRODUCTS, SECTORS, compoundGroups, counts, inCategory, isCompound, sectorProducts, url } from '../lib/catalogue.mjs';
import { inquiryBand, sectionHead } from '../lib/components.mjs';

function hero() {
  const botanicals = PRODUCTS.filter((p) => !isCompound(p)).length;
  return `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="label">${esc(SITE.legalName)} · Bengaluru, India</p>
      <h1>Botanical extracts, nutraceutical and cosmetic ingredients for manufacturers.</h1>
      <p class="hero-lede">Standardized extracts, oleoresins, CO₂ extracts, essential oils and aroma chemicals, supplied in bulk. Each product is specified by its marker compound or CAS number and documented batch by batch.</p>
      <div class="actions">
        <a class="btn btn-primary" href="/products.html">View the product range</a>
        <a class="link-arrow" href="/contact.html">Request product information ${icons.arrow}</a>
      </div>
    </div>
    <figure class="hero-media">
      <picture>
        <source media="(max-width: 700px)" srcset="/images/web/facility-800.webp">
        <img src="/images/web/facility-1280.webp" alt="Extraction and processing equipment on the production floor, with chillers, process vessels and gas cylinders" width="1280" height="720" fetchpriority="high">
      </picture>
      <figcaption>Extraction and processing equipment, production floor</figcaption>
    </figure>
  </div>
  <div class="wrap">
    <dl class="facts">
      <div><dt>Product forms</dt><dd>Extracts, oleoresins, CO₂ extracts, essential oils, aroma chemicals</dd></div>
      <div><dt>Catalogue</dt><dd>${botanicals} botanicals and ${counts.cosmetics} cosmetic compounds across three categories</dd></div>
      <div><dt>Documentation</dt><dd>Certificate of Analysis with every batch; TDS, SDS and specification sheets on request</dd></div>
      <div><dt>Supply</dt><dd>Bulk supply to manufacturers, for domestic and export orders</dd></div>
    </dl>
  </div>
</section>`;
}

function categoryIndex() {
  const rows = CATEGORIES.map((c) => {
    const items = inCategory(c.key);
    let media;
    if (c.key === 'cosmetics') {
      const sample = compoundGroups().map((g) => g.items[0].p);
      media =
        '<div class="cat-register" aria-hidden="true">' +
        sample.map((p) => `<span><b>${esc(p.name)}</b><i>${esc(p.cas || '')}</i></span>`).join('') +
        '</div>';
    } else {
      const pick = items[0];
      media = `<div class="plate"><img src="/${pick.image}" alt="" width="383" height="266" loading="lazy" decoding="async"></div>`;
    }
    const names = c.key === 'cosmetics' ? compoundGroups().map((g) => g.label) : items.map((p) => p.name.replace(/ \(.*\)/, ''));
    return `
      <li class="cat-row" data-tone="${c.tone}">
        <span class="cat-num">${c.index}</span>
        <div class="cat-text">
          <h3><a href="/${c.page}">${esc(c.name)}</a></h3>
          <p>${esc(c.intro)}</p>
          <p class="cat-items">${names.map(esc).join('<span aria-hidden="true"> · </span>')}</p>
        </div>
        <div class="cat-media">${media}</div>
        <a class="cat-link link-arrow" href="/${c.page}" aria-label="${esc(c.name)}: view ${items.length} ${c.key === 'cosmetics' ? 'compounds' : 'products'}">${items.length} ${c.key === 'cosmetics' ? 'compounds' : 'products'} ${icons.arrow}</a>
      </li>`;
  }).join('');
  return `
<section class="section">
  <div class="wrap">
    ${sectionHead({ title: 'What we supply', lede: 'The catalogue is organised in three categories. Every entry lists its botanical or chemical identity, marker compound or CAS number, and the forms we supply.' })}
    <ol class="cat-index">${rows}</ol>
  </div>
</section>`;
}

function markerTable() {
  const rows = PRODUCTS.filter((p) => !isCompound(p) && !/^Available on request/.test(p.grade))
    .map(
      (p) => `
        <tr>
          <th scope="row"><a href="/${url(p)}">${esc(p.name)}</a></th>
          <td data-label="Botanical name"><i>${esc(p.latin)}</i></td>
          <td data-label="Part used">${esc(p.part)}</td>
          <td data-label="Marker">${esc(p.markers.join(', '))}</td>
          <td data-label="Typical grade">${esc(p.grade)}</td>
        </tr>`
    )
    .join('');
  return `
<section class="section section-tint">
  <div class="wrap">
    ${sectionHead({ title: 'Standardized to marker compounds', lede: 'Typical grades for our standardized botanicals. The exact grade is agreed per order and confirmed on the Certificate of Analysis.' })}
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th scope="col">Product</th><th scope="col">Botanical name</th><th scope="col">Part used</th><th scope="col">Marker compound</th><th scope="col">Typical grade</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="table-note"><a class="link-arrow" href="/products.html">Full catalogue, including forms and cosmetic compounds ${icons.arrow}</a></p>
  </div>
</section>`;
}

function manufacturing() {
  return `
<section class="section">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">Quality &amp; manufacturing</p>
      <h2>From raw material to documented batch</h2>
      <p>Procurement, extraction, filtration, concentration, drying, standardization and packaging are run in-house, from specification to finished product.</p>
      <a class="link-arrow" href="/quality.html">Quality &amp; manufacturing ${icons.arrow}</a>
    </div>
    <div class="split-body">
      <ol class="process">
        ${PROCESS.map(([t], i) => `<li><span class="process-num">${String(i + 1).padStart(2, '0')}</span>${esc(t)}</li>`).join('')}
      </ol>
      <dl class="ruled-list">
        ${QUALITY.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}
        <div><dt>Flow &amp; vapour-phase chemistry</dt><dd>High-pressure operation up to 50 bar and reactions up to 600 °C, with reactor configurations for scale-up from pilot to commercial scale.</dd></div>
      </dl>
    </div>
  </div>
</section>`;
}

function applications() {
  const list = SECTORS.map((s) => {
    const items = sectorProducts(s);
    const names = items.filter((x) => !isCompound(x.p)).map((x) => x.p);
    const compounds = items.filter((x) => isCompound(x.p)).length;
    const parts = names.map((p) => `<a href="/${url(p)}">${esc(p.name.replace(/ \(.*\)/, ''))}</a>`);
    if (compounds) parts.push(`<a href="/cosmetic-ingredients.html">${compounds} aroma chemicals</a>`);
    return `<div><dt><a href="/applications.html#${s.key}">${esc(s.name)}</a></dt><dd>${parts.join(', ')}</dd></div>`;
  }).join('');
  return `
<section class="section section-tint">
  <div class="wrap split split-reverse">
    <div class="split-head">
      <p class="label">Applications</p>
      <h2>Where our ingredients are used</h2>
      <p>Sectors our customers formulate for, with the products typically supplied into each.</p>
      <a class="link-arrow" href="/applications.html">Browse by application ${icons.arrow}</a>
    </div>
    <dl class="sector-list">${list}</dl>
  </div>
</section>`;
}

function about() {
  return `
<section class="section">
  <div class="wrap statement">
    <p class="label">About Incretuss</p>
    <p class="statement-text">The name comes from the Latin <em>incrementum</em>, growth, and <em>rectus</em>, correct: growth that is precise, not just fast.</p>
    <div class="statement-body">
      <p>In practice that means a focused product range rather than an unfocused one, in-house manufacturing rather than resold stock, and documentation provided as standard rather than on demand.</p>
      <a class="link-arrow" href="/about.html">About the company ${icons.arrow}</a>
    </div>
  </div>
</section>`;
}

export default function home() {
  return {
    path: 'index.html',
    title: 'Incretuss | Botanical Extracts, Nutraceutical & Cosmetic Ingredients',
    description:
      'Incretuss Private Limited supplies standardized botanical extracts, oleoresins, essential oils, nutraceutical ingredients and aroma chemicals in bulk to manufacturers. Bengaluru, India.',
    active: 'home',
    body:
      hero() +
      categoryIndex() +
      markerTable() +
      manufacturing() +
      applications() +
      about() +
      inquiryBand({
        title: 'Send us your specification',
        text: 'Tell us the product, target grade or marker content, form, annual volume and destination. We will come back with grade options, pricing, lead time and documentation.',
        primaryLabel: 'Send an Inquiry',
        secondary: { href: '/products.html', label: 'Browse the catalogue' },
      }),
  };
}
