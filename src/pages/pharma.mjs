// Pharma section: /pharma/, /pharma/<category>/, /pharma/<category>/<product>/,
// /pharma/partnering/ and the shared enquiry form (/pharma/enquiry/).
//
// Every product, count and therapeutic-area filter comes from
// data/pharma-catalogue.csv via src/lib/pharma.mjs.
//
// Look and feel: these pages reuse the site's existing components and
// classes (page-head, product-head, key-spec, register tables, steps,
// cat-links, inquiry band, contact-form fields) so the Pharma section matches
// the rest of incretuss.com. pharma.css only adds what the site had no
// component for (area chips and drawer, enquiry dialog, licence checkbox).
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
import { sectionHead } from '../lib/components.mjs';
import { pageHead } from './catalogue.mjs';
import {
  PHARMA,
  areaGroups,
  catHref,
  documentation,
  inPharmaCategory,
  pharmaCounts,
  relatedPharma,
} from '../lib/pharma.mjs';

const ENQUIRY = 'pharma/enquiry/index.html';
const TITLE_SUFFIX = ' | Incretuss Pharma';
const PER_PAGE = 50;

const total = PHARMA.length;
const productCats = PHARMA_CATEGORIES.filter((c) => !c.partnering);
const partnering = PHARMA_CATEGORIES.find((c) => c.partnering);
const num = (c) => String(PHARMA_CATEGORIES.indexOf(c) + 1).padStart(2, '0');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const close =
  '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

const enquiryHref = (product) =>
  '/' + ENQUIRY.replace('index.html', '') + (product ? '?product=' + encodeURIComponent(product) : '');

// "Request a Quote": opens the enquiry dialog (js/pharma.js) with the product
// prefilled, or the enquiry page when scripts or <dialog> are unavailable.
function quoteLink(product, { label = 'Request a Quote', cls = 'btn btn-primary', sr = true } = {}) {
  return (
    `<a class="${cls}" href="${enquiryHref(product)}" data-enquire="${esc(product || '')}">${esc(label)}` +
    (product && sr ? `<span class="sr-only">: ${esc(product)}</span>` : '') +
    '</a>'
  );
}

function shell(o) {
  return {
    ...o,
    styles: ['/pharma.css'],
    bodyClass: 'is-pharma',
    footerNote: COMPLIANCE,
    active: 'pharma',
    scripts: ['/js/pharma.js'],
    body: o.body + (o.noDialog ? '' : enquiryDialog()),
  };
}

const HOME = { label: 'Home', href: 'index.html' };
const PHARMA_CRUMB = { label: 'Pharma', href: 'pharma/index.html' };
const catCrumb = (c) => ({ label: c.name, href: `pharma/${c.slug}/index.html` });

// ---------- Enquiry form (shared; same field styles as contact.html) ----------
function enquiryForm() {
  const f = (id, label, { type = 'text', req = false, auto = '', max = 120 } = {}) =>
    `<div class="field"><label for="pe-${id}">${label}${req ? ' <span aria-hidden="true">*</span>' : ''}</label>` +
    `<input id="pe-${id}" name="${id}" type="${type}"${auto ? ` autocomplete="${auto}"` : ''}${req ? ' required' : ''} maxlength="${max}"></div>`;
  return `
<form class="contact-form" id="pharmaEnquiry" novalidate>
  <div class="field-row">${f('name', 'Name', { req: true, auto: 'name', max: 100 })}${f('company', 'Company', { req: true, auto: 'organization', max: 100 })}</div>
  <div class="field-row">${f('country', 'Country', { req: true, auto: 'country-name', max: 80 })}${f('email', 'Business email', { type: 'email', req: true, auto: 'email', max: 254 })}</div>
  <div class="field-row">${f('phone', 'Phone', { type: 'tel', auto: 'tel', max: 40 })}${f('product', 'Product', { max: 200 })}</div>
  <div class="field-row">${f('strength', 'Required form / strength')}${f('quantity', 'Quantity')}</div>
  ${f('destination', 'Destination market', { req: true })}
  <div class="field"><label for="pe-message">Message</label>
    <textarea id="pe-message" name="message" rows="4" maxlength="5000" aria-describedby="pe-message-hint"></textarea>
    <p class="field-hint" id="pe-message-hint">Registration status you need, documentation (COA, DMF, COPP, CTD dossier), packaging and target delivery.</p>
  </div>
  <div class="ph-check">
    <input type="checkbox" id="pe-licence" name="licence" required>
    <label for="pe-licence">${esc(LICENCE_CONFIRM)} <span aria-hidden="true">*</span></label>
  </div>
  <div class="hp" aria-hidden="true"><label for="pe-website">Leave this field empty</label><input id="pe-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
  <div class="form-foot">
    <button type="submit" class="btn btn-primary" id="pharmaSubmit">Send Enquiry</button>
    <p class="form-status" id="pharmaStatus" role="status" aria-live="polite"></p>
  </div>
  <p class="field-hint">Fields marked * are required. Enquiries go to <a href="mailto:${SITE.email}">${SITE.email}</a>. We use your details only to respond.</p>
  <noscript><p class="field-hint">This form needs JavaScript. You can also email your requirement to <a href="mailto:${SITE.email}">${SITE.email}</a>.</p></noscript>
</form>`;
}

function enquiryDialog() {
  return `
<dialog class="ph-dialog" id="pharmaDialog" aria-labelledby="pharmaDialogTitle">
  <div class="ph-dialog-head">
    <div>
      <p class="label">Enquiry</p>
      <h2 id="pharmaDialogTitle">Request a quote.</h2>
    </div>
    <button type="button" class="icon-btn" data-close-dialog>${close}<span class="sr-only">Close</span></button>
  </div>
  ${enquiryForm()}
</dialog>`;
}

// ---------- Shared fragments ----------
// Same markup and classes as inquiryBand() in src/lib/components.mjs; the
// button opens the pharma enquiry form instead of contact.html.
function band({ title = 'Request a quote.', text, label = 'Request a Quote', product = '', secondary } = {}) {
  return `
<section class="inquiry">
  <div class="wrap inquiry-grid">
    <div class="inquiry-main">
      <h2>${title}</h2>
      <p>${text || 'Send the product, dosage form and strength, quantity and destination market. We reply with specifications, COA and dossier status for your market.'}</p>
      <div class="actions">
        ${quoteLink(product, { label, cls: 'btn btn-light', sr: false })}
        ${secondary ? `<a class="link-arrow link-light" href="${secondary.href}">${secondary.label} ${icons.arrow}</a>` : ''}
      </div>
    </div>
    <dl class="inquiry-contact">
      <div><dt>Email</dt><dd><a href="mailto:${SITE.email}">${SITE.email}</a></dd></div>
      <div><dt>Phone</dt><dd><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></dd></div>
      <div><dt>Office</dt><dd>Bengaluru, Karnataka, India</dd></div>
    </dl>
  </div>
</section>`;
}

function catLinks(cats, cls = '') {
  return (
    `<ul class="cat-links ph-cat-links ${cls}">` +
    cats
      .map((c) => {
        const count = c.partnering ? 'Licensing, dossiers, technology transfer' : plural(pharmaCounts[c.slug], 'product', 'products');
        return (
          `<li><a href="${catHref(c)}"><span class="menu-index">${num(c)}</span><span class="cat-links-name">${esc(c.name)}</span>${icons.arrow}` +
          `<span class="cat-links-lede">${esc(c.intro)}</span><span class="cat-links-lede ph-count">${count}</span></a></li>`
        );
      })
      .join('') +
    '</ul>'
  );
}

// ---------- /pharma/ ----------
function landing() {
  const body = `
<section class="hero">
  <div class="wrap">
    <div class="hero-copy">
      <p class="label">Incretuss Pharma</p>
      <h1>Pharmaceutical supply, <em>precisely</em> sourced.</h1>
      <p class="hero-lede">APIs and finished generics for manufacturers, importers and tender buyers worldwide.</p>
      <div class="actions">
        ${quoteLink('', { sr: false })}
        <a class="link-arrow" href="#range">View the pharma range ${icons.arrow}</a>
      </div>
    </div>
    <dl class="facts">
      <div><dt>Catalogue</dt><dd>${total} products in ${productCats.length} categories, plus partnering and licensing</dd></div>
      <div><dt>Scope</dt><dd>APIs, API intermediates and finished generic medicines</dd></div>
      <div><dt>Buyers</dt><dd>Manufacturers, importers, distributors and tender buyers</dd></div>
      <div><dt>Documentation</dt><dd>COA and specifications; DMF, COPP and CTD dossier status on request</dd></div>
    </dl>
  </div>
</section>

<section class="section" id="range">
  <div class="wrap">
    ${sectionHead({ label: 'Categories', title: 'Our pharma range.', lede: 'Each category can be filtered by therapeutic area. Open a product for its dosage form and documentation.' })}
    ${catLinks(PHARMA_CATEGORIES)}
  </div>
</section>

<section class="section section-tint">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">How we work</p>
      <h2>Three steps to supply.</h2>
      <p>From your requirement to a quotation for the product and market you confirm.</p>
    </div>
    <div class="split-body">
      <ol class="steps">
        ${HOW_WE_WORK.map(([t, d], i) => `<li><span class="process-num">${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}
      </ol>
    </div>
  </div>
</section>
${band()}`;

  return shell({
    path: 'pharma/index.html',
    title: 'Pharmaceutical APIs & Finished Generics' + TITLE_SUFFIX,
    description: `APIs, intermediates and finished generic medicines for pharmaceutical manufacturers, importers, distributors and tender buyers: ${total} products across tablets, injectables, inhalers, eye care and more.`,
    trail: [HOME, PHARMA_CRUMB],
    body,
  });
}

// ---------- /pharma/<category>/ ----------
// Register table rows (same table as the Aroma Chemicals page; it stacks on
// small screens without horizontal scrolling).
function row(p) {
  return (
    `<tr class="ph-row" data-area="${p.areaSlug}" data-name="${esc(p.name.toLowerCase())}">` +
    `<th scope="row"><a href="${p.href}">${esc(p.name)}</a></th>` +
    `<td class="mono">${esc(p.dosageForm)}</td>` +
    `<td>${esc(p.area)}</td>` +
    `<td class="register-actions">${quoteLink(p.name, { cls: 'btn btn-secondary btn-sm' })}</td>` +
    '</tr>'
  );
}

function categoryPage(c) {
  const items = inPharmaCategory(c);
  const groups = areaGroups(c);
  const trail = [HOME, PHARMA_CRUMB, catCrumb(c)];
  const chips =
    `<button type="button" class="ph-chip" data-area="" aria-pressed="true">All areas <span>${items.length}</span></button>` +
    groups.map((g) => `<button type="button" class="ph-chip" data-area="${g.slug}" aria-pressed="false">${esc(g.area)} <span>${g.items.length}</span></button>`).join('');

  const body =
    pageHead({
      trail,
      label: `Pharma · Category ${num(c)}`,
      title: esc(c.name),
      lede: esc(c.intro),
      extra: `<p class="page-meta">${plural(items.length, 'product', 'products')} in ${plural(groups.length, 'therapeutic area', 'therapeutic areas')} · <a href="${enquiryHref('')}" data-enquire="">Request a quote</a></p>`,
    }) +
    `
<section class="section section-first">
  <div class="wrap" data-catalogue data-per-page="${PER_PAGE}">
    <div class="ph-tools">
      <div class="filter-field ph-search">
        <label for="ph-q">Search</label>
        <input type="search" id="ph-q" placeholder="Product name" autocomplete="off">
      </div>
      <button type="button" class="btn btn-secondary ph-filter-open" aria-expanded="false" aria-controls="ph-filters">Therapeutic area<span class="ph-filter-current"></span></button>
      <div class="ph-filters" id="ph-filters" role="group" aria-labelledby="ph-filters-title">
        <div class="ph-filters-panel">
          <div class="ph-filters-head">
            <p class="ph-filters-title" id="ph-filters-title">Therapeutic area</p>
            <button type="button" class="icon-btn ph-filter-close">${close}<span class="sr-only">Close filters</span></button>
          </div>
          <div class="ph-chips">${chips}</div>
        </div>
      </div>
    </div>
    <p class="filter-status ph-results" id="ph-results" role="status" aria-live="polite"></p>
    ${groups
      .map(
        (g) => `
    <div class="register-group ph-group" data-group="${g.slug}">
      <h2 class="register-title" id="area-${g.slug}">${esc(g.area)}<span>${plural(g.items.length, 'product', 'products')}</span></h2>
      <div class="table-scroll"><table class="register" aria-labelledby="area-${g.slug}">
        <thead><tr><th scope="col">Product</th><th scope="col">Dosage form</th><th scope="col">Therapeutic area</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${g.items.map(row).join('')}</tbody>
      </table></div>
    </div>`
      )
      .join('')}
    <p class="filter-empty" id="ph-empty" hidden>No products match. <button type="button" class="text-btn" data-reset>Clear the search</button> or <a href="${enquiryHref('')}" data-enquire="">ask us for the product</a>.</p>
    <div class="ph-more"><button type="button" class="btn btn-secondary" id="ph-more" hidden>Show More Products</button></div>
  </div>
</section>

<section class="section section-tight">
  <div class="wrap">
    <h2 class="h-small">Other pharma categories</h2>
    ${catLinks(PHARMA_CATEGORIES.filter((x) => x !== c))}
  </div>
</section>` +
    band({ text: `Send the product, dosage form and strength, quantity and destination market. We reply with specifications, COA and the documentation available for your market.` });

  return shell({
    path: `pharma/${c.slug}/index.html`,
    title: c.name + TITLE_SUFFIX,
    description: truncate(`${c.name} for B2B supply: ${items.length} products across ${groups.length} therapeutic areas. ${c.intro} Specifications and documentation on request.`, 160),
    trail,
    body,
  });
}

// ---------- /pharma/<category>/<product>/ ----------
function productPage(p) {
  const c = p.cat;
  const trail = [HOME, PHARMA_CRUMB, catCrumb(c), { label: p.name, href: p.path }];
  const doc = documentation(p);
  const related = relatedPharma(p);
  const others = PHARMA.filter((q) => q.name === p.name && q !== p);
  const mono = (v) => `<span class="mono">${v}</span>`;

  const body = `
<section class="product-head">
  <div class="wrap">
    ${breadcrumb(trail)}
    <div class="product-grid">
      <div class="product-media">
        <div class="compound-plate" aria-hidden="true">
          <span class="cp-top">${esc(p.area)}</span>
          <span class="cp-name">${esc(p.name)}</span>
          <span class="cp-cas">${esc(p.dosageForm)}</span>
          <span class="cp-foot">Incretuss · Pharma · ${esc(c.short || c.name)}</span>
        </div>
      </div>
      <div class="product-summary">
        <p class="label"><a href="${catHref(c)}">${esc(c.name)}</a></p>
        <h1>${esc(p.name)}</h1>
        <dl class="key-spec">
          <div><dt>Category</dt><dd>${mono(`<a href="${catHref(c)}">${esc(c.name)}</a>`)}</dd></div>
          <div><dt>Dosage form</dt><dd>${mono(esc(p.dosageForm))}</dd></div>
          <div><dt>Therapeutic area</dt><dd>${mono(`<a href="${catHref(c)}?area=${p.areaSlug}">${esc(p.area)}</a>`)}</dd></div>
          <div><dt>Documentation</dt><dd>${mono(esc(doc))}</dd></div>
        </dl>
        ${p.patent ? `<p class="geo-note ph-patent">${esc(PATENT_NOTE)}</p>` : ''}
        <div class="actions">
          ${quoteLink(p.name, { sr: false })}
          <a class="btn btn-secondary" href="${catHref(c)}">All ${esc(c.short || c.name)}</a>
        </div>
        ${others.length ? `<p class="doc-links"><span>Also available as:</span> ${others.map((q) => `<a href="${q.href}">${esc(q.cat.name)}</a>`).join('<span aria-hidden="true"> · </span>')}</p>` : ''}
      </div>
    </div>
  </div>
</section>
${
  related.length
    ? `
<section class="section section-tint">
  <div class="wrap">
    ${sectionHead({ label: esc(p.area), title: 'Related products.', lede: `More products in ${esc(p.area.toLowerCase())}.` })}
    <ul class="related">
      ${related
        .map(
          (q) =>
            `<li><a href="${q.href}"><span class="related-cas ph-related-form">${esc(q.dosageForm)}</span><span class="related-name">${esc(q.name)}</span><span class="related-sub">${esc(q.cat.name)}</span></a></li>`
        )
        .join('')}
    </ul>
  </div>
</section>`
    : ''
}
${band({ product: p.name, text: 'Send the strength, quantity and destination market. We confirm availability, specifications and dossier status for that market.', secondary: { href: catHref(c), label: `More ${esc(c.name.toLowerCase())}` } })}`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.titleName,
    description: `${p.name}, ${p.dosageForm}. Therapeutic area: ${p.area}. ${doc}.`,
    category: `${c.name} > ${p.area}`,
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
    ogType: 'product',
    ld: [ld],
    body,
  });
}

// ---------- /pharma/partnering/ ----------
function partneringPage() {
  const trail = [HOME, PHARMA_CRUMB, catCrumb(partnering)];
  const body =
    pageHead({
      trail,
      label: `Pharma · Category ${num(partnering)}`,
      title: esc(partnering.name),
      lede: esc(partnering.intro),
      extra: `<div class="actions">${quoteLink(PARTNERING_ENQUIRY, { label: 'Discuss a Partnership', sr: false })}</div>`,
    }) +
    `
<section class="section">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">What we can discuss</p>
      <h2>Three ways to partner.</h2>
      <p>Tell us the molecule, dosage form and the markets you want to register in.</p>
    </div>
    <div class="split-body">
      <dl class="ruled-list">
        ${PARTNERING.options.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}
      </dl>
      <h3 class="h-small ph-h-gap">How a partnership starts</h3>
      <ol class="steps">
        ${PARTNERING.steps.map((s, i) => `<li><span class="process-num">${String(i + 1).padStart(2, '0')}</span><div><p>${esc(s)}</p></div></li>`).join('')}
      </ol>
      <div class="actions">${quoteLink(PARTNERING_ENQUIRY, { label: 'Discuss a Partnership', sr: false })}</div>
    </div>
  </div>
</section>` +
    band({
      title: 'Discuss a partnership.',
      label: 'Discuss a Partnership',
      product: PARTNERING_ENQUIRY,
      text: 'Licensing, dossier supply or technology transfer for regulated-market generics. Send the molecule, dosage form and target markets.',
    });

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
  const trail = [HOME, PHARMA_CRUMB, { label: 'Request a Quote', href: ENQUIRY }];
  const body =
    pageHead({
      trail,
      label: 'Pharma',
      title: 'Request a quote.',
      lede: 'Send your requirement. We reply with specifications, COA and dossier status for your destination market.',
    }) +
    `
<section class="section section-first">
  <div class="wrap contact-grid">
    <div class="contact-form-wrap">${enquiryForm()}</div>
    <aside class="contact-aside">
      <dl class="contact-details">
        <div><dt>Email</dt><dd><a href="mailto:${SITE.email}">${SITE.email}</a></dd></div>
        <div><dt>Phone</dt><dd><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></dd></div>
        <div><dt>Office</dt><dd><address>${SITE.legalName}<br>${SITE.address.lines.join('<br>')}</address></dd></div>
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
  return [landing(), ...productCats.map(categoryPage), partneringPage(), ...PHARMA.map(productPage), enquiryPage()];
}
