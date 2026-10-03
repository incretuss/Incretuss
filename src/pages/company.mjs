import { CATEGORIES, FLOW_CHEM, PROCESS, QUALITY, SITE } from '../content/site.mjs';
import { esc, icons } from '../lib/html.mjs';
import { SECTORS, inCategory, isCompound, sectorProducts, url } from '../lib/catalogue.mjs';
import { faqList, inquiryBand, sectionHead } from '../lib/components.mjs';
import { pageHead } from './catalogue.mjs';

const HOME = { label: 'Home', href: 'index.html' };
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

// ---------- about.html ----------
export function aboutPage() {
  const trail = [HOME, { label: 'About', href: 'about.html' }];
  const values = [
    ['Growth', 'Expanding the range deliberately, one well-manufactured botanical at a time.'],
    ['Precision', 'Batch-level checks before anything is cleared to move, on every order.'],
    ['Transparency', 'Clear specifications, honest lead times, documentation available on request.'],
    ['Partnership', 'Custom and contract arrangements scoped around what you actually need.'],
  ];
  const served = ['Pharmaceutical', 'Nutraceutical', 'Food', 'Beverage', 'Cosmetic', 'Personal care', 'Contract manufacturing', 'Export & distribution'];

  const body =
    pageHead({
      trail,
      label: 'About',
      title: 'About Incretuss',
      lede: `${SITE.legalName} manufactures botanical extracts, nutraceutical ingredients, essential oils and oleoresins, and supplies aroma chemicals, for pharmaceutical, nutraceutical, food, beverage, cosmetic and personal-care manufacturers. We do not sell to consumers — every order is bulk, B2B supply.`,
    }) +
    `
<section class="section section-first">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">What we do</p>
      <h2>Three product categories</h2>
      <p>A focused range, each product specified by botanical identity and marker compound, or by CAS number.</p>
    </div>
    <div class="split-body">
      <dl class="ruled-list">
        ${CATEGORIES.map(
          (c) =>
            `<div data-tone="${c.tone}"><dt><a href="/${c.page}">${esc(c.name)}</a></dt><dd>${esc(c.intro)} <span class="muted">${inCategory(c.key).length} ${c.key === 'cosmetics' ? 'compounds' : 'products'}.</span></dd></div>`
        ).join('')}
      </dl>
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap statement">
    <p class="label">The name</p>
    <p class="statement-text"><em>Incrementum</em> is Latin for growth. <em>Rectus</em> means natural, correct. Together: growth pursued the right way — scientifically precise, not just fast.</p>
    <div class="statement-body">
      <p>That shows up in how we operate: a focused product range rather than an unfocused one, in-house manufacturing rather than resold stock, and documentation provided as standard rather than on demand.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">How we work</p>
      <h2>Principles that carry across the range</h2>
    </div>
    <div class="split-body">
      <dl class="ruled-list ruled-list-2">
        ${values.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}
      </dl>
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">Manufacturing &amp; quality</p>
      <h2>Made in-house, documented per batch</h2>
      <p>Raw material procurement, extraction, filtration, concentration, drying, standardization and packaging run in-house, with batch traceability and raw-material and finished-goods testing.</p>
      <a class="link-arrow" href="/quality.html">Quality &amp; manufacturing ${icons.arrow}</a>
    </div>
    <div class="split-body">
      <figure class="figure">
        <img src="/images/web/facility-1280.webp" alt="Extraction and processing equipment on the production floor" width="1280" height="720" loading="lazy" decoding="async">
        <figcaption>Extraction and processing equipment, production floor</figcaption>
      </figure>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div class="split-head">
      <h2>Who we supply</h2>
      <p>Bulk ingredient supply for manufacturers across these industries, in India and for export.</p>
      <a class="link-arrow" href="/applications.html">Applications by sector ${icons.arrow}</a>
    </div>
    <div class="split-body">
      <ul class="columns-list">${served.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <dl class="ruled-list ruled-list-2 office">
        <div><dt>Registered name</dt><dd>${esc(SITE.legalName)}</dd></div>
        <div><dt>Office</dt><dd>${SITE.address.lines.join('<br>')}</dd></div>
      </dl>
    </div>
  </div>
</section>` +
    inquiryBand({
      title: 'Want to know more about how we manufacture?',
      text: 'Our team can walk you through our process, capabilities and documentation for the products you are evaluating.',
      primaryLabel: 'Contact Incretuss',
    });

  return {
    path: 'about.html',
    title: 'About Incretuss Private Limited | Botanical & Specialty Ingredients',
    description:
      'Incretuss Private Limited, Bengaluru: manufacturer and supplier of botanical extracts, nutraceutical ingredients, essential oils, oleoresins and aroma chemicals for B2B customers.',
    active: 'about',
    trail,
    body,
  };
}

// ---------- quality.html ----------
export function qualityPage() {
  const trail = [HOME, { label: 'Quality & Manufacturing', href: 'quality.html' }];
  const docs = [
    ['Certificate of Analysis (COA)', 'Test results for the batch supplied', 'With every batch'],
    ['Specification sheet', 'The agreed specification for the product and grade', 'On request'],
    ['Technical Data Sheet (TDS)', 'Technical properties, handling and use of the product', 'On request'],
    ['Safety Data Sheet (SDS)', 'Safety, storage and transport information', 'On request'],
  ];
  const faqs = [
    { q: 'Can I get a Certificate of Analysis?', a: 'Yes — COAs are provided per batch alongside your order.' },
    { q: 'Can you formulate to a custom purity or specification?', a: 'Yes. Share your specification or target application and we will scope a custom formulation or grade.' },
    { q: 'Do you provide samples?', a: 'Get in touch with the product you are interested in and we can discuss sample availability.' },
    { q: 'Do you ship internationally?', a: 'Yes. Let us know your destination when you reach out, and we will confirm shipping options and documentation.' },
  ];

  const body =
    pageHead({
      trail,
      label: 'Quality & Manufacturing',
      title: 'Quality and manufacturing',
      lede: 'Every product runs through the same sequence in-house, from raw-material procurement to standardized, packed and documented batch.',
    }) +
    `
<section class="section section-first">
  <div class="wrap">
    <figure class="figure figure-wide">
      <img src="/images/web/facility-1280.webp" alt="Extraction and processing equipment on the production floor, with chillers, process vessels and gas cylinders" width="1280" height="720" fetchpriority="high">
      <figcaption>Extraction and processing equipment, production floor</figcaption>
    </figure>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">Process</p>
      <h2>Manufacturing sequence</h2>
      <p>Run in-house from specification to finished product. The extraction route — solvent, supercritical CO₂ or steam distillation — depends on the product and the fraction required.</p>
    </div>
    <div class="split-body">
      <ol class="steps">
        ${PROCESS.map(([t, d], i) => `<li><span class="process-num">${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}
      </ol>
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">Quality control</p>
      <h2>Checks on every batch</h2>
      <p>The two things every inquiry eventually comes down to: what was tested, and what documentation comes with it.</p>
    </div>
    <div class="split-body">
      <dl class="ruled-list ruled-list-2">
        ${QUALITY.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}
      </dl>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead({ label: 'Documentation', title: 'Documents supplied', lede: 'Request any of these from a product page or through the inquiry form.' })}
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th scope="col">Document</th><th scope="col">Covers</th><th scope="col">Provided</th></tr></thead>
        <tbody>${docs.map(([a, b, c]) => `<tr><th scope="row">${a}</th><td data-label="Covers">${b}</td><td data-label="Provided">${c}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  </div>
</section>

<section class="section section-tint" id="flow-chemistry">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">Process capability</p>
      <h2>Flow and vapour-phase chemistry</h2>
      <p>Used for our <a href="/cosmetic-ingredients.html">cosmetic ingredients</a> range of ketones and acetophenones.</p>
    </div>
    <div class="split-body">
      <p class="prose">${esc(FLOW_CHEM.vapour)}</p>
      <dl class="ruled-list ruled-list-2">
        ${FLOW_CHEM.infrastructure.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b.charAt(0).toUpperCase() + b.slice(1))}</dd></div>`).join('')}
      </dl>
      <h3 class="h-small">Reaction types</h3>
      <ul class="tags">${FLOW_CHEM.reactions.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div class="split-head">
      <h2>Quality questions we are asked most</h2>
    </div>
    <div class="split-body">${faqList(faqs)}</div>
  </div>
</section>` +
    inquiryBand({
      title: 'Ask about our process',
      text: 'Tell us the product you are evaluating and the documentation your quality team needs. We will confirm what is available for your grade and market.',
      primaryLabel: 'Contact our team',
    });

  return {
    path: 'quality.html',
    title: 'Quality & Manufacturing | Incretuss',
    description:
      'How Incretuss manufactures: in-house extraction, standardization and packaging, batch traceability, raw-material and finished-goods testing, COA per batch, and flow chemistry capability.',
    active: 'quality',
    trail,
    body,
  };
}

// ---------- applications.html ----------
export function applicationsPage() {
  const trail = [HOME, { label: 'Applications', href: 'applications.html' }];
  const sections = SECTORS.map((s, i) => {
    const items = sectorProducts(s);
    const botanicals = items.filter((x) => !isCompound(x.p));
    const compounds = items.filter((x) => isCompound(x.p)).map((x) => x.p);
    const list = botanicals.length
      ? '<ul class="sector-products">' +
        botanicals
          .map(
            ({ p, notes }) =>
              `<li><div class="sp-head"><a href="/${url(p)}">${esc(p.name)}</a><i>${esc(p.latin)}</i></div>` +
              (notes.length
                ? notes.map((n) => `<p>${capitalize(n.replace(/^<b>.*?<\/b>\s*(&mdash;|—)\s*/, ''))}</p>`).join('')
                : `<p>${esc(p.blurb)}</p>`) +
              '</li>'
          )
          .join('') +
        '</ul>'
      : '';
    const table = compounds.length
      ? `<p class="sector-compounds"><span class="row-k">${compounds.length} aroma chemicals</span>` +
        compounds.map((p) => `<a href="/${url(p)}">${esc(p.name)}</a>`).join(', ') +
        ` <a class="link-arrow" href="/cosmetic-ingredients.html">Register with CAS numbers ${icons.arrow}</a></p>`
      : '';
    return `
<section class="sector${i % 2 ? ' section-tint' : ''}" id="${s.key}" aria-labelledby="h-${s.key}">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">${String(i + 1).padStart(2, '0')}</p>
      <h2 id="h-${s.key}">${esc(s.name)}</h2>
      <p>${esc(s.lede)}</p>
    </div>
    <div class="split-body">${list}${table}</div>
  </div>
</section>`;
  }).join('');

  const body =
    pageHead({
      trail,
      label: 'Applications',
      title: 'Applications by sector',
      lede: 'Where our ingredients are used, drawn from the catalogue. Each product is listed under the sectors its specification supports.',
      extra: '<ul class="jump-links jump-links-plain">' + SECTORS.map((s) => `<li><a href="#${s.key}">${esc(s.name)}</a></li>`).join('') + '</ul>',
    }) +
    sections +
    inquiryBand({
      title: 'Formulating for a different application?',
      text: 'Tell us the end product and target specification. We will advise which grade or form fits, or scope a custom specification.',
    });

  return {
    path: 'applications.html',
    title: 'Applications — Nutraceutical, Food, Cosmetic & Pharmaceutical | Incretuss',
    description:
      'Incretuss ingredients by application: nutraceuticals, food and beverage, pharmaceuticals, cosmetics and personal care, fragrance and flavor, and specialty chemicals.',
    active: 'applications',
    trail,
    body,
  };
}

// ---------- contact.html ----------
export function contactPage() {
  const trail = [HOME, { label: 'Contact', href: 'contact.html' }];
  const faqs = [
    { q: 'What is the minimum order quantity?', a: 'MOQs vary by product and format. Send us your requirement and we will confirm current minimums for that line.' },
    { q: 'What are typical lead times?', a: 'Lead times depend on the product and batch size. Our team will confirm a schedule once we understand your order.' },
    { q: 'Can you formulate to a custom purity or specification?', a: 'Yes. Share your specification or target application and we will scope a custom formulation.' },
    { q: 'Do you provide samples?', a: 'Get in touch with the product you are interested in and we can discuss sample availability.' },
    { q: 'Do you ship internationally?', a: 'Yes. Let us know your destination when you reach out, and we will confirm shipping options and documentation.' },
    { q: 'Can I get a Certificate of Analysis?', a: 'Yes — COAs are provided per batch alongside your order.' },
  ];
  const options = CATEGORIES.map(
    (c) =>
      `<optgroup label="${esc(c.name)}">` +
      inCategory(c.key)
        .map((p) => `<option>${esc(p.name)}</option>`)
        .join('') +
      '</optgroup>'
  ).join('');

  const body =
    pageHead({
      trail,
      label: 'Contact',
      title: 'Send an inquiry',
      lede: 'Send your specification, target application or a rough idea of what you need. Our team will reply with grade options, pricing, lead time and documentation.',
    }) +
    `
<section class="section section-first">
  <div class="wrap contact-grid">
    <div class="contact-form-wrap">
      <!-- Posts to /api/contact (netlify.toml) -> netlify/functions/contact.js, which emails the submission via Resend. -->
      <form class="contact-form" id="contactForm">
        <div class="field-row">
          <div class="field"><label for="name">Name <span aria-hidden="true">*</span></label><input id="name" name="name" type="text" autocomplete="name" required maxlength="100"></div>
          <div class="field"><label for="company">Company</label><input id="company" name="company" type="text" autocomplete="organization" maxlength="100"></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="email">Business email <span aria-hidden="true">*</span></label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254"></div>
          <div class="field"><label for="product">Product of interest</label>
            <select id="product" name="product">${options}<option>Custom / Not listed</option></select>
          </div>
        </div>
        <div class="field"><label for="message">Requirement <span aria-hidden="true">*</span></label>
          <textarea id="message" name="message" rows="7" required maxlength="5000" aria-describedby="message-hint"></textarea>
          <p class="field-hint" id="message-hint">Form and grade (or marker content), approximate volume, packaging, destination country and any documentation you need.</p>
        </div>
        <div class="hp" aria-hidden="true"><label for="website">Leave this field empty</label><input id="website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        <div class="form-foot">
          <button type="submit" class="btn btn-primary" id="contactSubmit">Send Inquiry</button>
          <p class="form-status" id="contactStatus" role="status" aria-live="polite"></p>
        </div>
        <p class="field-hint">Fields marked * are required. We use your details only to respond to this inquiry.</p>
      </form>
    </div>
    <aside class="contact-aside">
      <dl class="contact-details">
        <div><dt>Email</dt><dd><a href="mailto:${SITE.email}">${SITE.email}</a></dd></div>
        <div><dt>Phone</dt><dd><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></dd></div>
        <div><dt>Office</dt><dd><address>${SITE.legalName}<br>${SITE.address.lines.join('<br>')}</address></dd></div>
        <div><dt>Hours</dt><dd>${SITE.hours}</dd></div>
      </dl>
      <p id="geoNote" class="geo-note" role="status" hidden></p>
    </aside>
  </div>
</section>

<section class="section section-tint" id="faq">
  <div class="wrap split">
    <div class="split-head">
      <h2>Frequently asked</h2>
    </div>
    <div class="split-body">${faqList(faqs)}</div>
  </div>
</section>`;

  return {
    path: 'contact.html',
    title: 'Contact Incretuss — Send a Product Inquiry',
    description:
      'Contact Incretuss Private Limited, Bengaluru, for specifications, pricing, samples and documentation on botanical extracts, nutraceutical and cosmetic ingredients.',
    active: 'contact',
    trail,
    scripts: ['/js/contact.js'],
    body,
  };
}

// ---------- compare.html ----------
export function comparePage() {
  const trail = [HOME, { label: 'Products', href: 'products.html' }, { label: 'Compare', href: 'compare.html' }];
  const body =
    pageHead({
      trail,
      label: 'Products',
      title: 'Compare products',
      lede: 'Selected products side by side, taken from each product’s specification. Select two to four products in the catalogue to compare.',
    }) +
    `
<section class="section section-first">
  <div class="wrap">
    <div class="compare-toolbar">
      <p class="filter-status" id="compareCount" role="status"></p>
      <div class="actions">
        <a href="/products.html" class="btn btn-secondary btn-sm">Add products</a>
        <button type="button" class="btn btn-secondary btn-sm" id="compareClear">Clear selection</button>
      </div>
    </div>
    <div class="table-scroll"><table class="data-table compare-table" id="compareTable" hidden></table></div>
    <p class="filter-empty" id="compareEmpty" hidden>Select two to four products in the <a href="/products.html">product catalogue</a> to compare them here.</p>
  </div>
</section>`;
  return {
    path: 'compare.html',
    title: 'Compare Products | Incretuss',
    description: 'Compare Incretuss products side by side: botanical name, part used, forms, marker compounds, typical grade and industries.',
    active: 'products',
    trail,
    noindex: true,
    scripts: ['/js/compare.js'],
    body,
  };
}

// ---------- 404.html ----------
export function notFoundPage() {
  const body = `
<section class="page-head page-head-404">
  <div class="wrap">
    <div class="page-head-grid">
      <div>
        <p class="label">Error 404</p>
        <h1>This page does not exist</h1>
      </div>
      <div class="page-head-aside">
        <p class="page-lede">The link may be out of date, or the page may have moved.</p>
        <ul class="cat-links cat-links-compact">
          ${CATEGORIES.map((c) => `<li data-tone="${c.tone}"><a href="/${c.page}"><span class="menu-index">${c.index}</span><span class="cat-links-name">${esc(c.name)}</span>${icons.arrow}</a></li>`).join('')}
          <li><a href="/products.html"><span class="menu-index">—</span><span class="cat-links-name">Full catalogue</span>${icons.arrow}</a></li>
          <li><a href="/contact.html"><span class="menu-index">—</span><span class="cat-links-name">Contact Incretuss</span>${icons.arrow}</a></li>
        </ul>
      </div>
    </div>
  </div>
</section>`;
  return {
    path: '404.html',
    title: 'Page not found | Incretuss',
    description: 'The page you were looking for could not be found.',
    active: '',
    noindex: true,
    body,
  };
}

