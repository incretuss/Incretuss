// Reusable page fragments. Every repeated UI pattern on the site is
// defined once here.
import { SITE } from '../content/site.mjs';
import { esc, icons, inquiryHref, join } from './html.mjs';
import { category, groupLabel, isCompound, sentenceCase, url } from './catalogue.mjs';

export function sectionHead({ label, title, lede, id, level = 2, aside }) {
  const h = `h${level}`;
  return (
    `<div class="section-head">` +
    `<div class="section-head-main">` +
    (label ? `<p class="label">${label}</p>` : '') +
    `<${h}${id ? ` id="${id}"` : ''}>${title}</${h}>` +
    '</div>' +
    (lede || aside ? `<div class="section-head-aside">${lede ? `<p>${lede}</p>` : ''}${aside || ''}</div>` : '') +
    '</div>'
  );
}

export function compareToggle(p) {
  return (
    `<button type="button" class="compare-toggle" data-compare="${esc(p.slug)}" aria-pressed="false">` +
    `<span class="compare-box" aria-hidden="true"></span><span class="compare-text">Compare</span>` +
    `<span class="sr-only"> ${esc(p.name)}</span></button>`
  );
}

// White "specimen" plate for product photography (photos are shot on
// white, so they sit in a framed white panel at their natural size).
export function plate(src, alt, w, h, { eager = false, cls = '' } = {}) {
  return (
    `<div class="plate ${cls}">` +
    `<img src="/${src}" alt="${esc(alt)}" width="${w}" height="${h}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">` +
    '</div>'
  );
}

// Catalogue entry for the category pages (botanicals): photograph plus a
// short specification list.
export function productEntry(p, alt) {
  const rows = [
    ['Botanical name', `<i>${esc(p.latin)}</i>`],
    ['Part used', esc(p.part)],
    [p.markers.length > 1 ? 'Marker compounds' : 'Marker compound', esc(p.markers.join(', '))],
    ['Forms', esc(p.forms.join(', '))],
  ];
  return (
    `<article class="entry" data-slug="${esc(p.slug)}">` +
    `<a class="entry-media" href="/${url(p)}" tabindex="-1" aria-hidden="true">${plate(p.image, '', 383, 266)}</a>` +
    '<div class="entry-body">' +
    `<h3 class="entry-title"><a href="/${url(p)}">${esc(p.name)}</a></h3>` +
    `<p class="entry-blurb">${esc(p.blurb)}</p>` +
    '<dl class="mini-spec">' +
    rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('') +
    '</dl>' +
    '<div class="entry-foot">' +
    `<a class="link-arrow" href="/${url(p)}">Specification ${icons.arrow}</a>` +
    compareToggle(p) +
    '</div>' +
    '</div>' +
    '</article>'
  );
}

// Compact row for the catalogue index (products.html) and filters.
export function catalogueRow(p) {
  const compound = isCompound(p);
  const sub = compound ? `CAS ${p.cas || '—'}` : `<i>${esc(p.latin)}</i>`;
  const detail = compound
    ? esc(p.listings.map((l) => groupLabel(l.group)).join(' · '))
    : esc(p.markers.join(', '));
  const forms = compound ? esc(sentenceCase(p.listings.map((l) => l.opportunity).join('; '))) : esc(p.forms.join(', '));
  const search = [p.name, p.latin, p.cas, p.part, ...(p.forms || []), ...(p.markers || []), ...(p.industries || []), ...(p.listings || []).map((l) => l.group + ' ' + l.opportunity)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    `<li class="row" data-slug="${esc(p.slug)}" data-category="${p.category}" data-industries="${esc((p.industries || []).join('|'))}" data-search="${esc(search)}">` +
    (compound
      ? '<span class="row-thumb row-thumb-blank" aria-hidden="true"></span>'
      : `<img class="row-thumb" src="/${p.image}" alt="" width="96" height="67" loading="lazy" decoding="async">`) +
    `<span class="row-name"><a href="/${url(p)}">${esc(p.name)}</a><span class="row-sub">${sub}</span></span>` +
    `<span class="row-detail"><span class="row-k">${compound ? 'Class' : 'Marker'}</span>${detail}</span>` +
    `<span class="row-forms"><span class="row-k">${compound ? 'Applications' : 'Forms'}</span>${forms}</span>` +
    `<span class="row-actions">${compareToggle(p)}</span>` +
    '</li>'
  );
}

// Register-style table for the cosmetic compounds.
export function compoundTable(groups, { caption, compare = true } = {}) {
  return groups
    .map(
      (g) =>
        '<div class="register-group">' +
        `<h3 class="register-title">${esc(g.label)}<span>${g.items.length} ${g.items.length === 1 ? 'compound' : 'compounds'}</span></h3>` +
        '<div class="table-scroll"><table class="register">' +
        (caption ? `<caption class="sr-only">${esc(g.label)}</caption>` : '') +
        '<thead><tr><th scope="col">Compound</th><th scope="col">CAS No.</th><th scope="col">Main applications</th>' +
        (compare ? '<th scope="col"><span class="sr-only">Actions</span></th>' : '') +
        '</tr></thead><tbody>' +
        g.items
          .map(
            ({ p, listing }) =>
              `<tr data-slug="${esc(p.slug)}">` +
              `<th scope="row"><a href="/${url(p)}">${esc(p.name)}</a></th>` +
              `<td class="mono">${esc(p.cas || '—')}</td>` +
              `<td>${esc(sentenceCase(listing.opportunity))}</td>` +
              (compare ? `<td class="register-actions">${compareToggle(p)}</td>` : '') +
              '</tr>'
          )
          .join('') +
        '</tbody></table></div></div>'
    )
    .join('');
}

// Two-column technical table: [[label, value-markup], …] grouped under
// optional sub-headings: [{title, rows}]
export function specTable(groups) {
  return (
    '<div class="spec-table">' +
    groups
      .map(
        (g) =>
          '<table>' +
          (g.title ? `<caption>${esc(g.title)}</caption>` : '') +
          '<tbody>' +
          g.rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('') +
          '</tbody></table>'
      )
      .join('') +
    '</div>'
  );
}

export function faqList(faqs) {
  return (
    '<div class="faq">' +
    faqs
      .map(
        (f) =>
          '<details class="faq-item">' +
          `<summary><span>${f.q}</span>${icons.plus}</summary>` +
          `<div class="faq-a"><p>${f.a}</p></div>` +
          '</details>'
      )
      .join('') +
    '</div>'
  );
}

export function tagList(items) {
  return '<ul class="tags">' + items.map((i) => `<li>${esc(i)}</li>`).join('') + '</ul>';
}

// Closing inquiry band used at the foot of most pages.
export function inquiryBand({ title, text, product, primaryLabel = 'Send an Inquiry', secondary }) {
  return (
    '<section class="inquiry">' +
    '<div class="wrap inquiry-grid">' +
    '<div class="inquiry-main">' +
    `<h2>${title}</h2>` +
    `<p>${text}</p>` +
    '<div class="actions">' +
    `<a class="btn btn-light" href="/${inquiryHref(product, product ? 'quote' : null)}">${primaryLabel}</a>` +
    (secondary ? `<a class="link-arrow link-light" href="${secondary.href}">${secondary.label} ${icons.arrow}</a>` : '') +
    '</div>' +
    '</div>' +
    '<dl class="inquiry-contact">' +
    `<div><dt>Email</dt><dd><a href="mailto:${SITE.email}">${SITE.email}</a></dd></div>` +
    `<div><dt>Phone</dt><dd><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></dd></div>` +
    `<div><dt>Office</dt><dd>Bengaluru, Karnataka, India</dd></div>` +
    '</dl>' +
    '</div>' +
    '</section>'
  );
}

export function categoryLabel(key) {
  const c = category(key);
  return `<span class="cat-label" data-tone="${c.tone}">${esc(c.name)}</span>`;
}

export function relatedList(items) {
  return (
    '<ul class="related">' +
    items
      .map((p) =>
        join([
          `<li><a href="/${url(p)}">`,
          isCompound(p)
            ? `<span class="related-cas mono">CAS ${esc(p.cas || '—')}</span>`
            : `<img src="/${p.image}" alt="" width="383" height="266" loading="lazy" decoding="async">`,
          `<span class="related-name">${esc(p.name)}</span>`,
          `<span class="related-sub">${isCompound(p) ? esc(groupLabel(p.listings[0].group)) : `<i>${esc(p.latin)}</i>`}</span>`,
          '</a></li>',
        ])
      )
      .join('') +
    '</ul>'
  );
}
