// brochure.html — the event brochure. One catalogue section is shown at a
// time, with tabs to switch; which section opens first is set in
// data/brochure.json (read again at runtime by js/brochure.js, so changing
// it does not need a rebuild) or per link with ?section=<name>.
import { readFileSync } from 'node:fs';
import { CATEGORIES, FLOW_CHEM, SITE } from '../content/site.mjs';
import { EXTRACTION, ROUTES, SECTION_ALIASES } from '../content/brochure.mjs';
import { esc, icons, inquiryHref } from '../lib/html.mjs';
import { compoundGroups, content, inCategory, url } from '../lib/catalogue.mjs';
import { compoundTable, inquiryBand, plate } from '../lib/components.mjs';

const CONFIG = JSON.parse(readFileSync(new URL('../../data/brochure.json', import.meta.url), 'utf8'));
const DEFAULT = SECTION_ALIASES[String(CONFIG.defaultSection || '').toLowerCase()] || CATEGORIES[0].key;

// Short tab keys shown in ?section= links.
const TAB_KEY = { 'botanical-extracts': 'botanicals', nutraceuticals: 'nutraceuticals', cosmetics: 'cosmetics' };

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
    plate(p.image, k.imageAlt || p.name, 383, 266) +
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

function panel(c) {
  const items = inCategory(c.key);
  const active = c.key === DEFAULT;
  let body;
  if (c.key === 'cosmetics') {
    body =
      compoundTable(compoundGroups(), { caption: true, compare: false }) +
      '<div class="b-capability">' +
      '<h3 class="h-small">Flow &amp; vapour-phase chemistry</h3>' +
      '<dl class="ruled-list ruled-list-2">' +
      FLOW_CHEM.infrastructure.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b.charAt(0).toUpperCase() + b.slice(1))}</dd></div>`).join('') +
      '</dl>' +
      `<ul class="tags">${FLOW_CHEM.reactions.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` +
      '</div>';
  } else {
    body = `<div class="b-grid">${items.map(card).join('')}</div>`;
  }
  return (
    `<section class="b-panel${active ? ' is-active' : ''}" id="panel-${TAB_KEY[c.key]}" data-section="${TAB_KEY[c.key]}" data-tone="${c.tone}" role="tabpanel" aria-labelledby="tab-${TAB_KEY[c.key]}" tabindex="0">` +
    '<div class="b-panel-head">' +
    `<span class="cat-num">${c.index}</span>` +
    `<div><h2>${esc(c.name)}</h2><p>${esc(c.intro)}</p></div>` +
    `<a class="link-arrow" href="/${c.page}">On the website ${icons.arrow}</a>` +
    '</div>' +
    body +
    '</section>'
  );
}

export default function brochurePage() {
  const event = String(CONFIG.event || '').trim();
  const tabs = CATEGORIES.map((c) => {
    const key = TAB_KEY[c.key];
    const active = c.key === DEFAULT;
    return (
      `<a class="b-tab" href="?section=${key}" id="tab-${key}" data-section="${key}" data-tone="${c.tone}" role="tab" aria-controls="panel-${key}" aria-selected="${active}"${active ? '' : ' tabindex="-1"'}>` +
      `<span class="menu-index">${c.index}</span><span class="b-tab-name">${esc(c.name)}</span>` +
      `<span class="menu-count">${inCategory(c.key).length}</span></a>`
    );
  }).join('');

  const body = `
<section class="page-head b-head">
  <div class="wrap">
    <div class="page-head-grid">
      <div>
        <p class="label">Product brochure</p>
        <h1>Botanical, nutraceutical and cosmetic ingredients</h1>
        <p class="b-event" data-event${event ? '' : ' hidden'}>Meet us at <strong>${esc(event)}</strong></p>
      </div>
      <div class="page-head-aside">
        <p class="page-lede">We supply formulators, brand owners and distributors with consistent, well-documented ingredients for flavor and fragrance, nutraceutical, pharmaceutical and cosmetic applications. Extraction choices are made product by product, matching the method to the actives, so buyers get a specification they can build a formulation around.</p>
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
    ${CATEGORIES.map(panel).join('')}
  </div>
</div>

<section class="section section-tint">
  <div class="wrap split">
    <div class="split-head">
      <p class="label">How we work</p>
      <h2>Two extraction routes, one standard</h2>
      <p>Every product ships with a Certificate of Analysis and batch documentation, with flexible MOQs.</p>
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
      text: 'Bring us your requirement — actives, purity, particle size, packaging and volume — and our team will follow up with specifications, pricing and lead times.',
      primaryLabel: 'Send an Inquiry',
      secondary: { href: '/products.html', label: 'Full product catalogue' },
    });

  return {
    path: 'brochure.html',
    title: 'Product Brochure | Incretuss',
    description: `${SITE.legalName} product brochure: botanical extracts, nutraceutical ingredients and cosmetic ingredients.`,
    active: 'products',
    noindex: true,
    scripts: ['/js/brochure.js'],
    mainAttrs: `class="brochure" data-default-section="${TAB_KEY[DEFAULT]}"`,
    body,
  };
}
