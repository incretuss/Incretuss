// Pharma section: /pharma/, /pharma/<category>/, /pharma/<category>/<product>/,
// /pharma/partnering/ and the shared enquiry form (/pharma/enquiry/).
//
// Every product, count and therapeutic-area filter comes from
// data/pharma-catalogue.csv via src/lib/pharma.mjs.
import { SITE } from '../content/site.mjs';
import {
  COMPLIANCE,
  HOW_WE_WORK,
  LICENCE_CONFIRM,
  PARTNERING,
  PARTNERING_ENQUIRY,
  PATENT_NOTE,
  PHARMA_CATEGORIES,
} from '../content/pharma.mjs';
import { esc, icons, truncate } from '../lib/html.mjs';
import { breadcrumb } from '../lib/layout.mjs';
import {
  PHARMA,
  areaGroups,
  catHref,
  documentation,
  inPharmaCategory,
  pharmaCounts,
  relatedPharma,
} from '../lib/pharma.mjs';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&family=Inter:wght@400;500;600&display=swap';
const ENQUIRY = 'pharma/enquiry/index.html';
const TITLE_SUFFIX = ' | Incretuss Pharma';
const PER_PAGE = 50;

const total = PHARMA.length;
const productCats = PHARMA_CATEGORIES.filter((c) => !c.partnering);
const partnering = PHARMA_CATEGORIES.find((c) => c.partnering);

const icon = {
  arrow: icons.arrow,
  filter:
    '<svg class="ph-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  close:
    '<svg class="ph-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  search:
    '<svg class="ph-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  doc:
    '<svg class="ph-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M14 3v4h4M10 12h5M10 16h5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  send:
    '<svg class="ph-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-4 16-4-6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m12 14 8-10" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  box:
    '<svg class="ph-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
};

const enquiryHref = (product) =>
  '/' + ENQUIRY.replace('index.html', '') + (product ? '?product=' + encodeURIComponent(product) : '');

// "Request a Quote" link: opens the enquiry dialog (js/pharma.js) with the
// product prefilled, or the enquiry page when scripts are unavailable.
function quoteLink(product, { label = 'Request a Quote', cls = 'ph-btn ph-btn-quote', srSuffix = true } = {}) {
  return (
    `<a class="${cls}" href="${enquiryHref(product)}" data-enquire="${esc(product || '')}">` +
    esc(label) +
    (product && srSuffix ? `<span class="sr-only">: ${esc(product)}</span>` : '') +
    '</a>'
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function eyebrow(text) {
  return `<p class="ph-eyebrow">${text}</p>`;
}

function shell(o) {
  return {
    ...o,
    title: o.title,
    fonts: FONTS,
    styles: ['/pharma.css'],
    bodyClass: 'is-pharma',
    mainAttrs: 'class="ph"',
    footerNote: COMPLIANCE,
    active: 'pharma',
    scripts: ['/js/pharma.js', ...(o.scripts || [])],
    body: o.body + (o.noDialog ? '' : enquiryDialog()),
  };
}

// ---------- Enquiry form (shared) ----------
function enquiryForm(product = '') {
  const field = (id, label, { type = 'text', required = false, auto = '', max = 120, value = '', wide = false } = {}) =>
    `<div class="ph-field${wide ? ' ph-field-wide' : ''}"><label for="pe-${id}">${label}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>` +
    `<input id="pe-${id}" name="${id}" type="${type}"${auto ? ` autocomplete="${auto}"` : ''}${required ? ' required' : ''} maxlength="${max}"${value ? ` value="${esc(value)}"` : ''}></div>`;
  return `
<form class="ph-form" id="pharmaEnquiry" novalidate>
  <div class="ph-form-grid">
    ${field('name', 'Name', { required: true, auto: 'name', max: 100 })}
    ${field('company', 'Company', { required: true, auto: 'organization', max: 100 })}
    ${field('country', 'Country', { required: true, auto: 'country-name', max: 80 })}
    ${field('email', 'Business email', { type: 'email', required: true, auto: 'email', max: 254 })}
    ${field('phone', 'Phone', { type: 'tel', auto: 'tel', max: 40 })}
    ${field('product', 'Product', { max: 200, value: product })}
    ${field('strength', 'Required form / strength', { max: 120 })}
    ${field('quantity', 'Quantity', { max: 120 })}
    ${field('destination', 'Destination market', { required: true, max: 120, wide: true })}
    <div class="ph-field ph-field-wide"><label for="pe-message">Message</label>
      <textarea id="pe-message" name="message" rows="4" maxlength="5000" aria-describedby="pe-message-hint"></textarea>
      <p class="ph-hint" id="pe-message-hint">Registration status you need, documentation (COA, DMF, COPP, CTD dossier), packaging and target delivery.</p>
    </div>
  </div>
  <div class="ph-check">
    <input type="checkbox" id="pe-licence" name="licence" required>
    <label for="pe-licence">${esc(LICENCE_CONFIRM)} <span aria-hidden="true">*</span></label>
  </div>
  <div class="hp" aria-hidden="true"><label for="pe-website">Leave this field empty</label><input id="pe-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
  <div class="ph-form-foot">
    <button type="submit" class="ph-btn ph-btn-primary" id="pharmaSubmit">Send Enquiry</button>
    <p class="ph-status" id="pharmaStatus" role="status" aria-live="polite"></p>
  </div>
  <p class="ph-hint">Fields marked * are required. Enquiries go to <a href="mailto:${SITE.email}">${SITE.email}</a>. We use your details only to respond.</p>
  <noscript><p class="ph-hint">This form needs JavaScript. You can also email your requirement to <a href="mailto:${SITE.email}">${SITE.email}</a>.</p></noscript>
</form>`;
}

function enquiryDialog() {
  return `
<dialog class="ph-dialog" id="pharmaDialog" aria-labelledby="pharmaDialogTitle">
  <div class="ph-dialog-head">
    <div>
      ${eyebrow('Enquiry')}
      <h2 id="pharmaDialogTitle">Request a quote.</h2>
    </div>
    <button type="button" class="ph-icon-btn" data-close-dialog>${icon.close}<span class="sr-only">Close</span></button>
  </div>
  ${enquiryForm()}
</dialog>`;
}

// ---------- Shared fragments ----------
function head({ trail, label, title, lede, meta = '', aside = '' }) {
  return `
<section class="ph-head">
  <div class="ph-wrap">
    ${breadcrumb(trail)}
    <div class="ph-head-grid">
      <div>
        ${label ? eyebrow(label) : ''}
        <h1>${title}</h1>
        ${lede ? `<p class="ph-lede">${lede}</p>` : ''}
        ${meta}
      </div>
      ${aside}
    </div>
  </div>
</section>`;
}

function ctaBand({ title = 'Send your requirement.', text, label = 'Request a Quote', product = '' } = {}) {
  return `
<section class="ph-band">
  <div class="ph-wrap ph-band-grid">
    <div>
      <h2>${title}</h2>
      <p>${text || 'Product, dosage form and strength, quantity and destination market. We reply with specifications, COA and dossier status for your market.'}</p>
    </div>
    <div class="ph-band-actions">
      ${quoteLink(product, { label, cls: 'ph-btn ph-btn-light', srSuffix: false })}
      <p class="ph-band-contact"><a href="mailto:${SITE.email}">${SITE.email}</a><br><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></p>
    </div>
  </div>
</section>`;
}

const pharmaTrail = { label: 'Pharma', href: 'pharma/index.html' };
const catTrail = (c) => ({ label: c.name, href: `pharma/${c.slug}/index.html` });

// ---------- /pharma/ ----------
function landing() {
  const cards = PHARMA_CATEGORIES.map((c, i) => {
    const n = pharmaCounts[c.slug];
    const count = c.partnering ? 'Licensing · dossiers · transfer' : plural(n, 'product', 'products');
    return `
      <li><a class="ph-card" href="${catHref(c)}">
        <span class="ph-card-index">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.intro)}</p>
        <span class="ph-card-foot"><span>${count}</span>${icon.arrow}</span>
      </a></li>`;
  }).join('');

  const body = `
<section class="ph-hero">
  <div class="ph-wrap ph-hero-grid">
    <div>
      ${eyebrow('Incretuss Pharma')}
      <h1>Pharmaceutical supply, <em>precisely</em> sourced.</h1>
      <p class="ph-lede">APIs and finished generics for manufacturers, importers and tender buyers worldwide.</p>
      <div class="ph-actions">
        ${quoteLink('', { srSuffix: false })}
        <a class="ph-btn ph-btn-outline" href="#range">View the Range</a>
      </div>
    </div>
    <dl class="ph-spec ph-hero-spec">
      <div><dt>Catalogue</dt><dd>${total} products in ${productCats.length} categories</dd></div>
      <div><dt>Scope</dt><dd>APIs, intermediates and finished generics</dd></div>
      <div><dt>Buyers</dt><dd>Manufacturers, importers, distributors, tender buyers</dd></div>
      <div><dt>Documents</dt><dd>COA, specifications, DMF, COPP, CTD on request</dd></div>
    </dl>
  </div>
</section>

<section class="ph-section" id="range">
  <div class="ph-wrap">
    <div class="ph-section-head">
      ${eyebrow('Categories')}
      <h2>Our pharma range.</h2>
      <p>Each category is filtered by therapeutic area. Open a product for its dosage form and documentation.</p>
    </div>
    <ul class="ph-cards">${cards}</ul>
  </div>
</section>

<section class="ph-section ph-tint">
  <div class="ph-wrap">
    <div class="ph-section-head">
      ${eyebrow('How we work')}
      <h2>Three steps to supply.</h2>
    </div>
    <ol class="ph-steps">
      ${HOW_WE_WORK.map(
        ([t, d], i) =>
          `<li><span class="ph-step-icon">${[icon.send, icon.doc, icon.box][i]}</span><span class="ph-step-num">Step ${String(i + 1).padStart(2, '0')}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`
      ).join('')}
    </ol>
  </div>
</section>
${ctaBand({ title: 'Request a quote.' })}`;

  return shell({
    path: 'pharma/index.html',
    title: 'Pharmaceutical APIs & Finished Generics' + TITLE_SUFFIX,
    description: `APIs, intermediates and finished generic medicines for pharmaceutical manufacturers, importers, distributors and tender buyers: ${total} products across tablets, injectables, inhalers, eye care and more.`,
    trail: [pharmaTrail],
    body,
  });
}

// ---------- /pharma/<category>/ ----------
function row(p) {
  return (
    `<li class="ph-row" data-area="${p.areaSlug}" data-name="${esc(p.name.toLowerCase())}">` +
    `<a class="ph-row-name" href="${p.href}">${esc(p.name)}</a>` +
    `<span class="ph-row-meta"><span class="ph-k">Form</span>${esc(p.dosageForm)}</span>` +
    `<span class="ph-row-meta"><span class="ph-k">Area</span>${esc(p.area)}</span>` +
    quoteLink(p.name, { cls: 'ph-btn ph-btn-sm ph-btn-quote-line' }) +
    '</li>'
  );
}

function categoryPage(c, index) {
  const items = inPharmaCategory(c);
  const groups = areaGroups(c);
  const trail = [pharmaTrail, catTrail(c)];
  const chips =
    `<button type="button" class="ph-chip" data-area="" aria-pressed="true">All areas <span>${items.length}</span></button>` +
    groups
      .map((g) => `<button type="button" class="ph-chip" data-area="${g.slug}" aria-pressed="false">${esc(g.area)} <span>${g.items.length}</span></button>`)
      .join('');

  const body =
    head({
      trail,
      label: `Category ${String(index + 1).padStart(2, '0')}`,
      title: esc(c.name),
      lede: esc(c.intro),
      meta: `<p class="ph-meta">${plural(items.length, 'product', 'products')} · ${plural(groups.length, 'therapeutic area', 'therapeutic areas')}</p>`,
    }) +
    `
<section class="ph-section ph-section-first">
  <div class="ph-wrap" data-catalogue data-per-page="${PER_PAGE}">
    <div class="ph-toolbar">
      <div class="ph-search">
        <label class="sr-only" for="ph-q">Search ${esc(c.name)} by product name</label>
        ${icon.search}
        <input type="search" id="ph-q" placeholder="Search by product name" autocomplete="off">
      </div>
      <button type="button" class="ph-btn ph-btn-outline ph-filter-open" aria-expanded="false" aria-controls="ph-filters">${icon.filter}Therapeutic Area<span class="ph-filter-current"></span></button>
    </div>
    <div class="ph-filters" id="ph-filters" role="group" aria-labelledby="ph-filters-title">
      <div class="ph-filters-head">
        <p class="ph-eyebrow" id="ph-filters-title">Therapeutic area</p>
        <button type="button" class="ph-icon-btn ph-filter-close">${icon.close}<span class="sr-only">Close filters</span></button>
      </div>
      <div class="ph-chips">${chips}</div>
    </div>
    <p class="ph-results" id="ph-results" role="status" aria-live="polite"></p>
    ${groups
      .map(
        (g) => `
    <section class="ph-group" data-group="${g.slug}" aria-labelledby="area-${g.slug}">
      <h2 class="ph-group-title" id="area-${g.slug}">${esc(g.area)}<span>${g.items.length}</span></h2>
      <ul class="ph-rows">${g.items.map(row).join('')}</ul>
    </section>`
      )
      .join('')}
    <p class="ph-empty" id="ph-empty" hidden>No products match. <button type="button" class="ph-text-btn" data-reset>Clear the search</button> or ${quoteLink('', { label: 'ask us for the product', cls: 'ph-text-link', srSuffix: false })}.</p>
    <div class="ph-more-wrap"><button type="button" class="ph-btn ph-btn-outline" id="ph-more" hidden>Show More Products</button></div>
  </div>
</section>` +
    ctaBand({ text: `Send the product, dosage form and strength, quantity and destination market. We reply with specifications, COA and the documentation available for ${esc(c.name.toLowerCase())} in your market.` });

  return shell({
    path: `pharma/${c.slug}/index.html`,
    title: c.name + TITLE_SUFFIX,
    description: truncate(
      `${c.name} for B2B supply: ${items.length} products across ${groups.length} therapeutic areas. ${c.intro} Specifications and documentation on request.`,
      160
    ),
    trail,
    body,
  });
}

// ---------- /pharma/<category>/<product>/ ----------
function productPage(p) {
  const trail = [pharmaTrail, catTrail(p.cat), { label: p.name, href: p.path }];
  const doc = documentation(p);
  const related = relatedPharma(p);
  const others = PHARMA.filter((q) => q.name === p.name && q !== p);

  const body =
    head({
      trail,
      label: esc(p.cat.name),
      title: esc(p.name),
      aside: '',
    }) +
    `
<section class="ph-section ph-section-first">
  <div class="ph-wrap ph-product">
    <div>
      <dl class="ph-spec">
        <div><dt>Category</dt><dd><a href="${catHref(p.cat)}">${esc(p.cat.name)}</a></dd></div>
        <div><dt>Dosage form</dt><dd>${esc(p.dosageForm)}</dd></div>
        <div><dt>Therapeutic area</dt><dd><a href="${catHref(p.cat)}?area=${p.areaSlug}">${esc(p.area)}</a></dd></div>
        <div><dt>Documentation</dt><dd>${esc(doc)}</dd></div>
      </dl>
      ${p.patent ? `<p class="ph-note">${esc(PATENT_NOTE)}</p>` : ''}
      ${
        others.length
          ? `<p class="ph-also">Also available as: ${others.map((q) => `<a href="${q.href}">${esc(q.cat.name)}</a>`).join(', ')}.</p>`
          : ''
      }
    </div>
    <aside class="ph-product-aside">
      ${eyebrow('Enquiry')}
      <p>Send the strength, quantity and destination market. We confirm availability, specifications and dossier status for that market.</p>
      ${quoteLink(p.name, { srSuffix: false })}
      <a class="ph-link" href="${catHref(p.cat)}">All ${esc(p.cat.name)} ${icon.arrow}</a>
    </aside>
  </div>
</section>
${
  related.length
    ? `
<section class="ph-section ph-tint">
  <div class="ph-wrap">
    <div class="ph-section-head">
      ${eyebrow(esc(p.area))}
      <h2>Related products.</h2>
    </div>
    <ul class="ph-related">
      ${related
        .map(
          (q) =>
            `<li><a href="${q.href}"><span class="ph-related-cat">${esc(q.cat.short || q.cat.name)}</span><span class="ph-related-name">${esc(q.name)}</span><span class="ph-related-form">${esc(q.dosageForm)}</span></a></li>`
        )
        .join('')}
    </ul>
  </div>
</section>`
    : ''
}
${ctaBand({ title: 'Request a quote.', product: p.name })}`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.titleName,
    description: `${p.name}, ${p.dosageForm}. Therapeutic area: ${p.area}. ${doc}.`,
    category: `${p.cat.name} > ${p.area}`,
    url: `${SITE.url}${p.href}`,
    brand: { '@type': 'Brand', name: 'Incretuss Pharma' },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Dosage form', value: p.dosageForm },
      { '@type': 'PropertyValue', name: 'Therapeutic area', value: p.area },
    ],
  };

  return shell({
    path: p.path,
    title: p.titleName + TITLE_SUFFIX,
    description: truncate(
      `${p.titleName} for B2B supply. Form: ${p.dosageForm}. Area: ${p.area}. ${doc.replace(' available on request', '')} on request for licensed importers and distributors.`,
      160
    ),
    trail,
    ld: [ld],
    body,
  });
}

// ---------- /pharma/partnering/ ----------
function partneringPage() {
  const trail = [pharmaTrail, catTrail(partnering)];
  const body =
    head({
      trail,
      label: 'Category 10',
      title: esc(partnering.name),
      lede: esc(partnering.intro),
    }) +
    `
<section class="ph-section ph-section-first">
  <div class="ph-wrap ph-product">
    <div>
      <div class="ph-section-head">
        ${eyebrow('What we can discuss')}
        <h2>Three ways to partner.</h2>
      </div>
      <dl class="ph-options">
        ${PARTNERING.options.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}
      </dl>
      <h3 class="ph-h3">How a partnership starts.</h3>
      <ol class="ph-numbered">${PARTNERING.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </div>
    <aside class="ph-product-aside">
      ${eyebrow('Partnering')}
      <p>Tell us the molecule, dosage form and the markets you want to register in.</p>
      ${quoteLink(PARTNERING_ENQUIRY, { label: 'Discuss a Partnership', cls: 'ph-btn ph-btn-primary', srSuffix: false })}
    </aside>
  </div>
</section>` +
    ctaBand({ title: 'Discuss a partnership.', label: 'Discuss a Partnership', product: PARTNERING_ENQUIRY, text: 'Licensing, dossier supply or technology transfer for regulated-market generics. Send the molecule, dosage form and target markets.' });

  return shell({
    path: `pharma/${partnering.slug}/index.html`,
    title: partnering.name + TITLE_SUFFIX,
    description: 'Partnering and licensing with Incretuss Pharma: regulated-market generics for out-licensing, CTD dossier supply or technology transfer.',
    trail,
    body,
  });
}

// ---------- /pharma/enquiry/ ----------
function enquiryPage() {
  const trail = [pharmaTrail, { label: 'Enquiry', href: ENQUIRY }];
  const body =
    head({
      trail,
      label: 'Enquiry',
      title: 'Request a quote.',
      lede: 'Send your requirement. We reply with specifications, COA and dossier status for your destination market.',
    }) +
    `
<section class="ph-section ph-section-first">
  <div class="ph-wrap ph-product">
    <div class="ph-form-panel">${enquiryForm()}</div>
    <aside class="ph-product-aside">
      ${eyebrow('Contact')}
      <dl class="ph-spec">
        <div><dt>Email</dt><dd><a href="mailto:${SITE.email}">${SITE.email}</a></dd></div>
        <div><dt>Phone</dt><dd><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></dd></div>
        <div><dt>Hours</dt><dd>${SITE.hours}</dd></div>
      </dl>
    </aside>
  </div>
</section>`;
  return shell({
    path: ENQUIRY,
    title: 'Request a Quote' + TITLE_SUFFIX,
    description: 'Send a pharmaceutical product enquiry to Incretuss: product, form and strength, quantity and destination market.',
    trail,
    noindex: true,
    noDialog: true,
    body,
  });
}

export function pharmaPages() {
  return [
    landing(),
    ...productCats.map((c) => categoryPage(c, PHARMA_CATEGORIES.indexOf(c))),
    partneringPage(),
    ...PHARMA.map(productPage),
    enquiryPage(),
  ];
}
