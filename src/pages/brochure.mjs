// brochure.html: the event brochure. One section is shown at a time, with
// tabs to switch; which section opens first is set in data/brochure.json
// (read again at runtime by js/brochure.js, so changing it does not need a
// rebuild) or per link with ?section=<name>.
import { readFileSync } from 'node:fs';
import { SITE } from '../content/site.mjs';
import { EXTRACTION, ROUTES, SECTIONS, SECTION_ALIASES } from '../content/brochure.mjs';
import { esc, icons, inquiryHref } from '../lib/html.mjs';
import { AROMA, PRODUCTS, category, compoundGroups, content, inCategory, isCompound, isFragranceMaterial, url } from '../lib/catalogue.mjs';
import { compoundTable, inquiryBand, productMedia } from '../lib/components.mjs';
import { PHARMA_CATEGORIES } from '../content/pharma.mjs';
import { PHARMA, areaGroups, catHref, pharmaCounts } from '../lib/pharma.mjs';

const CONFIG = JSON.parse(readFileSync(new URL('../../data/brochure.json', import.meta.url), 'utf8'));
// Sections marked `hidden` stay in the code but are not rendered.
const VISIBLE = SECTIONS.filter((s) => !s.hidden);
const wanted = SECTION_ALIASES[String(CONFIG.defaultSection || '').toLowerCase()];
const DEFAULT = VISIBLE.some((s) => s.key === wanted) ? wanted : VISIBLE[0].key;

// Resolve each tab's name, tone, intro, link and products.
const TABS = VISIBLE.map((s, i) => {
  if (s.category) {
    const c = category(s.category);
    return { ...s, index: c.index, name: c.name, short: c.short, tone: c.tone, intro: c.intro, page: c.page, count: inCategory(c.key).length };
  }
  if (s.key === 'pharma') return { ...s, page: 'pharma/', count: PHARMA.length };
  const botanicals = PRODUCTS.filter((p) => !isCompound(p) && p.industries.includes('Cosmetics'));
  const fragrance = s.fragrance === false ? [] : inCategory(AROMA).filter(isFragranceMaterial);
  return { ...s, index: '', page: 'applications.html#cosmetics', botanicals, fragrance, count: botanicals.length + fragrance.length };
});

function card(p) {
  const k = content(p);
  const rows = [
    ['Botanical name', `<i>${esc(p.latin)}</i>`],
    EXTRACTION[p.slug] && ['Extraction', esc(EXTRACTION[p.slug])],
    ['Forms', esc(p.forms.join(', '))],
    [p.markers.length > 1 ? 'Markers' : 'Marker', esc(p.markers.join(', '))],
    !/^Available on request/.test(p.grade) && ['Typical grade', esc(p.grade)],
  ].filter(Boolean);
  return (
    '<article class="b-card">' +
    productMedia(p, k.imageAlt || p.name) +
    '<div class="b-card-body">' +
    `<h3><a href="/${url(p)}">${esc(p.name)}</a></h3>` +
    '<dl class="mini-spec">' +
    rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('') +
    '</dl>' +
    '<div class="entry-foot">' +
    `<a class="link-arrow" href="/${url(p)}">Specification ${icons.arrow}</a>` +
    `<a class="link-arrow" href="/${inquiryHref(p.name, 'quote')}">Request a quote</a>` +
    '</div></div></article>'
  );
}

const COMPOUND_NOTE =
  'Applications listed are the documented uses of each compound. Grade, purity, packaging and documentation are confirmed per order.';

// Pharma: every product from data/pharma-catalogue.csv, one block per
// category, grouped by therapeutic area. The dosage form is shown where it
// tells products apart (not for plain APIs).
const API_FORM = 'API (bulk drug substance)';
function pharmaBody() {
  const cats = PHARMA_CATEGORIES.filter((c) => !c.partnering);
  const partnering = PHARMA_CATEGORIES.find((c) => c.partnering);
  const jump =
    '<ul class="b-ph-jump">' +
    cats.map((c) => `<li><a href="#b-ph-${c.slug}">${esc(c.name)}<span class="menu-count">${pharmaCounts[c.slug]}</span></a></li>`).join('') +
    `<li><a href="#b-ph-${partnering.slug}">${esc(partnering.name)}</a></li>` +
    '</ul>';
  const blocks = cats
    .map(
      (c) =>
        `<section class="b-ph-cat" id="b-ph-${c.slug}" aria-labelledby="b-ph-h-${c.slug}">` +
        '<div class="b-ph-cat-head">' +
        `<h3 id="b-ph-h-${c.slug}">${esc(c.name)}<span>${pharmaCounts[c.slug]} products</span></h3>` +
        `<p>${esc(c.intro)}</p>` +
        `<a class="link-arrow" href="${catHref(c)}">On the website ${icons.arrow}</a>` +
        '</div>' +
        '<div class="b-ph-areas">' +
        areaGroups(c)
          .map(
            (g) =>
              '<div class="b-ph-area">' +
              `<h4 class="h-small">${esc(g.area)} <span>${g.items.length}</span></h4>` +
              '<ul>' +
              g.items
                .map(
                  (p) =>
                    `<li data-search="${esc((p.name + ' ' + p.dosageForm).toLowerCase())}"><a href="${p.href}">${esc(p.name)}</a>${p.dosageForm !== API_FORM ? ` <span>${esc(p.dosageForm)}</span>` : ''}</li>`
                )
                .join('') +
              '</ul></div>'
          )
          .join('') +
        '</div></section>'
    )
    .join('');
  const partner =
    `<section class="b-ph-cat b-ph-partner" id="b-ph-${partnering.slug}">` +
    '<div class="b-ph-cat-head">' +
    `<h3>${esc(partnering.name)}</h3>` +
    `<p>${esc(partnering.intro)} Send the molecule, dosage form and target markets.</p>` +
    `<a class="link-arrow" href="${catHref(partnering)}">On the website ${icons.arrow}</a>` +
    '</div></section>';
  const note =
    '<p class="table-note">Documentation on request: COA and specifications for every product; DMF for APIs; COPP and CTD dossier status for finished products. Products under patent or regulatory exclusivity are supplied only to markets where none applies; availability is confirmed per destination country. Information here is not medical advice and does not promote any product to patients.</p>';
  // Search (js/brochure.js): filters every product by name and dosage form.
  const search =
    '<div class="b-ph-search">' +
    `<label for="b-ph-q">Search ${PHARMA.length} pharma products</label>` +
    '<input type="search" id="b-ph-q" placeholder="Product name or dosage form, e.g. Amoxicillin, eye drops" autocomplete="off">' +
    '<p class="filter-status" id="b-ph-status" role="status" aria-live="polite"></p>' +
    '</div>';
  const empty =
    '<p class="filter-empty" id="b-ph-empty" hidden>No products match. Try another name, or <a href="/pharma/enquiry/">ask us for the product</a>.</p>';
  return search + jump + blocks + empty + partner + note;
}

function panel(t) {
  let body;
  if (t.key === 'pharma') {
    body = pharmaBody();
  } else if (t.key === 'cosmetics') {
    body =
      `<div class="b-grid">${t.botanicals.map(card).join('')}</div>` +
      (t.fragrance.length
        ? '<div class="b-subsection">' +
          '<h3 class="h-small">Fragrance materials</h3>' +
          '<p class="b-sub-lede">Aroma chemicals supplied for fragrance compounding. They are fragrance materials, not cosmetic actives; IFRA and regulatory status for your application is confirmed per order.</p>' +
          compoundTable(compoundGroups(isFragranceMaterial), { caption: true, compare: false }) +
          '</div>'
        : '');
  } else if (t.category === AROMA) {
    body = compoundTable(compoundGroups(), { caption: true, compare: false }) + `<p class="table-note">${COMPOUND_NOTE}</p>`;
  } else {
    body = `<div class="b-grid">${inCategory(t.category).map(card).join('')}</div>`;
  }
  return (
    `<section class="b-panel${t.key === DEFAULT ? ' is-active' : ''}" id="panel-${t.key}" data-section="${t.key}" data-tone="${t.tone}" role="tabpanel" aria-labelledby="tab-${t.key}" tabindex="0">` +
    '<div class="b-panel-head">' +
    `<span class="cat-num">${t.index}</span>` +
    `<div><h2>${esc(t.name)}</h2><p>${esc(t.intro)}</p></div>` +
    `<a class="link-arrow" href="/${t.page}">On the website ${icons.arrow}</a>` +
    '</div>' +
    body +
    '</section>'
  );
}

export default function brochurePage() {
  const event = String(CONFIG.event || '').trim();
  const tabs = TABS.map((t) => {
    const active = t.key === DEFAULT;
    return (
      `<a class="b-tab" href="?section=${t.key}" id="tab-${t.key}" data-section="${t.key}" data-tone="${t.tone}" role="tab" aria-controls="panel-${t.key}" aria-selected="${active}"${active ? '' : ' tabindex="-1"'}>` +
      `<span class="menu-index">${t.index}</span><span class="b-tab-name">${esc(t.short || t.name)}</span>` +
      `<span class="menu-count">${t.count}</span></a>`
    );
  }).join('');

  const body = `
<section class="page-head b-head">
  <div class="wrap">
    <div class="page-head-grid">
      <div>
        <p class="label">Product brochure</p>
        <h1>Botanical extracts, nutraceutical ingredients and pharmaceuticals</h1>
        <p class="b-event" data-event${event ? '' : ' hidden'}>Meet us at <strong>${esc(event)}</strong></p>
      </div>
      <div class="page-head-aside">
        <p class="page-lede">We supply formulators, brand owners and distributors with consistent, well-documented ingredients for flavor and fragrance, nutraceutical, pharmaceutical and personal-care applications. Extraction choices are made product by product, matching the method to the actives, so buyers get a specification they can build a formulation around.</p>
      </div>
    </div>
  </div>
</section>

<div class="b-tabs-bar">
  <div class="wrap">
    <nav class="b-tabs" role="tablist" aria-label="Product sections">${tabs}</nav>
  </div>
</div>

<div class="section section-first b-panels">
  <div class="wrap">
    ${TABS.map(panel).join('')}
  </div>
</div>

<section class="section section-tint">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">How we work</p>
      <h2>Two extraction routes, one standard</h2>
      <p>Botanical products ship with a Certificate of Analysis and batch documentation, with flexible MOQs.</p>
    </div>
    <div class="split-body">
      <dl class="ruled-list ruled-list-2">
        ${ROUTES.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}
        <div><dt>Custom specifications</dt><dd>We work product by product with formulators on actives percentage, particle size and private-label packaging.</dd></div>
      </dl>
    </div>
  </div>
</section>
` +
    inquiryBand({
      title: 'Have a formulation in mind?',
      text: 'Bring us your requirement (actives, purity, particle size, packaging and volume) and our team will follow up with specifications, pricing and lead times.',
      primaryLabel: 'Send an Inquiry',
      secondary: { href: '/products.html', label: 'Full product catalogue' },
    });

  return {
    path: 'brochure.html',
    title: 'Product Brochure | Incretuss',
    description: `${SITE.legalName} product brochure: botanical extracts, nutraceutical ingredients, and pharmaceutical APIs and finished generics.`,
    active: 'products',
    noindex: true,
    scripts: ['/js/brochure.js'],
    mainAttrs: `class="brochure" data-default-section="${DEFAULT}"`,
    body,
  };
}
