import { SITE } from '../content/site.mjs';
import { esc, icons, inquiryHref, text, truncate } from '../lib/html.mjs';
import { breadcrumb } from '../lib/layout.mjs';
import { casText, category, content, groupOf, isCompound, related, shownCas, url } from '../lib/catalogue.mjs';
import { compareToggle, faqList, inquiryBand, plate, productMedia, relatedList, sectionHead, specTable, tagList } from '../lib/components.mjs';

const ON_REQUEST = '<span class="muted">Available on request</span>';

function docLinks(name, needs) {
  return (
    '<p class="doc-links"><span>Also on request:</span> ' +
    needs.map(([need, label]) => `<a href="/${inquiryHref(name, need)}">${label}</a>`).join('<span aria-hidden="true"> · </span>') +
    '</p>'
  );
}

function keySpec(rows) {
  return '<dl class="key-spec">' + rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('') + '</dl>';
}

function trailFor(p) {
  const c = category(p.category);
  return [
    { label: 'Home', href: 'index.html' },
    { label: 'Products', href: 'products.html' },
    { label: c.name, href: c.page },
    { label: p.name, href: url(p) },
  ];
}

function productLd(p, description) {
  const c = category(p.category);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description,
    category: c.name,
    url: `${SITE.url}/${url(p)}`,
    brand: { '@type': 'Brand', name: SITE.name },
    manufacturer: { '@type': 'Organization', name: SITE.legalName, url: SITE.url + '/' },
  };
  if (p.image) ld.image = `${SITE.url}/${p.image}`;
  if (shownCas(p)) ld.additionalProperty = [{ '@type': 'PropertyValue', name: 'CAS number', value: shownCas(p) }];
  return ld;
}

// ---------- botanical / nutraceutical product ----------
export function botanicalPage(p) {
  const c = category(p.category);
  const k = content(p);
  const trail = trailFor(p);

  const grades = k.grades
    ? `
      <h2 class="h-detail">Listed grades</h2>
      <ul class="grades">
        ${k.grades
          .map(
            (g) => `<li>
              ${plate(g.image, g.alt, g.w, g.h)}
              <div><h3>${esc(g.name)}</h3><p>${esc(g.form)}</p>
              <a class="link-arrow" href="/${inquiryHref(p.name, 'quote', g.name)}">Request a quote ${icons.arrow}</a></div>
            </li>`
          )
          .join('')}
      </ul>`
    : '';

  const spec = specTable([
    {
      title: 'Botanical identity',
      rows: [
        ['Botanical name', `<i>${esc(p.latin)}</i>`],
        ['Plant part used', esc(p.part)],
        [p.markers.length > 1 ? 'Marker compounds' : 'Marker compound', esc(p.markers.join(', '))],
      ],
    },
    {
      title: 'Forms & grades',
      rows: [
        ['Available forms', esc(p.forms.join(', '))],
        ['Purity / grade', k.gradeNote],
        ['Appearance, shelf life, storage', ON_REQUEST],
      ],
    },
    {
      title: 'Supply & documentation',
      rows: [
        ['Packaging', ON_REQUEST],
        ['Documentation', 'Certificate of Analysis per batch; specification sheet on request'],
        ['Export', 'Available; confirm destination with our team'],
      ],
    },
  ]);

  const body = `
<section class="product-head" data-tone="${c.tone}">
  <div class="wrap">
    ${breadcrumb(trail)}
    <div class="product-grid">
      <div class="product-media">${productMedia(p, k.imageAlt || p.name, { eager: true, cls: 'plate-lg' })}</div>
      <div class="product-summary">
        <p class="label"><a href="/${c.page}">${esc(c.name)}</a></p>
        <h1>${esc(p.name)}</h1>
        <p class="latin"><i>${esc(p.latin)}</i></p>
        <p class="product-blurb">${esc(p.blurb)}</p>
        ${keySpec([
          ['Part used', esc(p.part)],
          [p.markers.length > 1 ? 'Marker compounds' : 'Marker compound', esc(p.markers.join(', '))],
          ['Available forms', esc(p.forms.join(', '))],
          ['Typical grade', esc(p.grade)],
        ])}
        <div class="actions">
          <a class="btn btn-primary" href="/${inquiryHref(p.name, 'quote')}">Request a Quote</a>
          <a class="btn btn-secondary" href="/${inquiryHref(p.name, 'tds')}">Request Technical Data Sheet</a>
        </div>
        ${docLinks(p.name, [['sds', 'Safety Data Sheet'], ['coa', 'COA'], ['brochure', 'Product brochure']])}
        ${compareToggle(p)}
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap detail">
    <div class="detail-main">
      <h2 class="h-detail">Overview</h2>
      <p class="prose">${k.overview}</p>
      ${grades}
      <h2 class="h-detail">Applications</h2>
      <ul class="app-notes">${(k.applications || []).map((a) => `<li>${a}</li>`).join('')}</ul>
      <h2 class="h-detail" id="specification">Specification</h2>
      ${spec}
      <p class="table-note">Values marked “on request” are confirmed once we know your target application.</p>
    </div>
    <aside class="detail-aside">
      <div class="aside-block">
        <h2 class="h-small">Industries</h2>
        ${tagList(p.industries)}
      </div>
      <div class="aside-block">
        <h2 class="h-small">Documents on request</h2>
        <ul class="doc-list">
          <li><a href="/${inquiryHref(p.name, 'coa')}">Certificate of Analysis</a></li>
          <li><a href="/${inquiryHref(p.name, 'tds')}">Technical Data Sheet</a></li>
          <li><a href="/${inquiryHref(p.name, 'sds')}">Safety Data Sheet</a></li>
          <li><a href="/${inquiryHref(p.name, 'brochure')}">Product brochure</a></li>
        </ul>
      </div>
    </aside>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap split">
    <div class="split-head">
      <h2>Frequently asked</h2>
      <p>Not covered here? <a href="/${inquiryHref(p.name, 'quote')}">Ask our team</a>.</p>
    </div>
    <div class="split-body">${faqList(k.faqs || [])}</div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead({ title: 'Related products', lede: k.relatedNote || '' })}
    ${relatedList(related(p))}
  </div>
</section>
` +
    inquiryBand({
      title: `Request information on ${esc(p.name)}`,
      text: 'Send the form, target grade, volume and destination. We will reply with the specification, pricing, lead time and documentation.',
      product: p.name,
      primaryLabel: 'Request a Quote',
      secondary: { href: `/${c.page}`, label: `More ${c.name.toLowerCase()}` },
    });

  const description = truncate(`${p.name} (${p.latin}): ${text(p.blurb)} Forms: ${p.forms.join(', ')}. Bulk supply from Incretuss.`, 158);

  return {
    path: url(p),
    title: `${p.name} (${p.latin}) | ${c.name} | Incretuss`,
    description,
    active: 'products',
    trail,
    ogType: 'product',
    image: p.image ? `${SITE.url}/${p.image}` : undefined,
    mainAttrs: `data-product-slug="${p.slug}"`,
    ld: [productLd(p, description)],
    body,
  };
}

// ---------- aroma chemical / specialty ketone ----------
// Only verified fields are shown: name, common name, CAS number (when
// confirmed), structural class and documented application tags. Grade,
// purity, documentation and suitability for any end use are confirmed per
// order; no cosmetic or regulatory status is claimed.
export function compoundPage(p) {
  const c = category(p.category);
  const g = groupOf(p);
  const trail = trailFor(p);
  const cas = shownCas(p);
  const family = g.family.toLowerCase().replace(/s$/, '');
  const apps = p.applications;
  const casNote = p.casUnverified ? 'Being confirmed; available on request' : 'On request';
  const overview =
    `${esc(p.name)}${p.synonym ? ` (${esc(p.synonym)})` : ''} is ${/^[aeiou]/.test(family) ? 'an' : 'a'} ${esc(family)}` +
    `${cas ? `, CAS ${esc(cas)}` : ''}, listed in our ${esc(g.label.toLowerCase())} group. ` +
    `Documented applications: ${esc(apps.join(', ').toLowerCase())}. ` +
    'Grade, purity, packaging and documentation are confirmed per order, and suitability for a specific end use, including any regulatory requirements in your market, is confirmed with our team before supply.';

  const body = `
<section class="product-head" data-tone="${c.tone}">
  <div class="wrap">
    ${breadcrumb(trail)}
    <div class="product-grid">
      <div class="product-media">
        <div class="compound-plate" aria-hidden="true">
          <span class="cp-top">${esc(g.label)}</span>
          <span class="cp-name">${esc(p.name)}</span>
          <span class="cp-cas">CAS ${esc(casText(p))}</span>
          <span class="cp-foot">Incretuss · ${esc(c.short)}</span>
        </div>
      </div>
      <div class="product-summary">
        <p class="label"><a href="/${c.page}">${esc(c.name)}</a></p>
        <h1>${esc(p.name)}</h1>
        <p class="latin mono">CAS No. ${esc(cas || casNote)}</p>
        ${keySpec([
          ['Common name', esc(p.synonym || '')],
          ['Chemical class', esc(g.label)],
          ['Applications', esc(apps.join(', '))],
          ['Grade / purity', 'Confirmed per order'],
        ])}
        <div class="actions">
          <a class="btn btn-primary" href="/${inquiryHref(p.name, 'quote')}">Request a Quote</a>
          <a class="btn btn-secondary" href="/${inquiryHref(p.name, 'spec')}">Request Specification</a>
        </div>
        ${compareToggle(p)}
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap detail">
    <div class="detail-main">
      <h2 class="h-detail">Overview</h2>
      <p class="prose">${overview}</p>
      <h2 class="h-detail" id="specification">Specification</h2>
      ${specTable([
        {
          title: 'Identity',
          rows: [
            ['Compound', esc(p.name)],
            ['Common name', esc(p.synonym || '')],
            ['CAS number', cas ? `<span class="mono">${esc(cas)}</span>` : `<span class="muted">${esc(casNote)}</span>`],
            ['Chemical class', `${esc(g.family)}: ${esc(g.label.toLowerCase())}`],
          ],
        },
        {
          title: 'Supply & documentation',
          rows: [
            ['Grade / purity', ON_REQUEST],
            ['Packaging', ON_REQUEST],
            ['Documentation', '<span class="muted">Confirmed per order</span>'],
            ['Export', 'Available; confirm destination with our team'],
          ],
        },
      ])}
    </div>
    <aside class="detail-aside">
      <div class="aside-block">
        <h2 class="h-small">Applications</h2>
        ${tagList(apps)}
      </div>
      <div class="aside-block">
        <h2 class="h-small">Documentation</h2>
        <p class="aside-note">Specification, safety data and batch documentation are confirmed per order. <a href="/${inquiryHref(p.name, 'spec')}">Ask our team</a>.</p>
      </div>
    </aside>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${sectionHead({ title: 'Related compounds', lede: `More ${esc(g.label.toLowerCase())}.` })}
    ${relatedList(related(p))}
  </div>
</section>
` +
    inquiryBand({
      title: `Request information on ${esc(p.name)}`,
      text: 'Send the required purity, volume, packaging, destination and intended application. We will reply with the specification, pricing, lead time and available documentation.',
      product: p.name,
      primaryLabel: 'Request a Quote',
      secondary: { href: `/${c.page}`, label: `All ${c.short.toLowerCase()}` },
    });

  const description = truncate(
    `${p.name}${cas ? ` (CAS ${cas})` : ''}: ${family} for ${apps.join(', ').toLowerCase()}. Bulk supply from Incretuss; grade and documentation confirmed per order.`,
    158
  );

  return {
    path: url(p),
    title: `${p.name}${cas ? ` (CAS ${cas})` : ''} | ${c.short} | Incretuss`,
    description,
    active: 'products',
    trail,
    ogType: 'product',
    mainAttrs: `data-product-slug="${p.slug}"`,
    ld: [productLd(p, description)],
    body,
  };
}

export function productPage(p) {
  return isCompound(p) ? compoundPage(p) : botanicalPage(p);
}
