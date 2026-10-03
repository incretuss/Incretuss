import { SITE } from '../content/site.mjs';
import { esc, icons, inquiryHref, text, truncate } from '../lib/html.mjs';
import { breadcrumb } from '../lib/layout.mjs';
import { category, content, groupLabel, isCompound, opportunities, related, sentenceCase, url } from '../lib/catalogue.mjs';
import { compareToggle, faqList, inquiryBand, plate, relatedList, sectionHead, specTable, tagList } from '../lib/components.mjs';

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
  if (p.cas) ld.additionalProperty = [{ '@type': 'PropertyValue', name: 'CAS number', value: p.cas }];
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
      <div class="product-media">${plate(p.image, k.imageAlt || p.name, 383, 266, { eager: true, cls: 'plate-lg' })}</div>
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
    image: `${SITE.url}/${p.image}`,
    mainAttrs: `data-product-slug="${p.slug}"`,
    ld: [productLd(p, description)],
    body,
  };
}

// ---------- cosmetic compound ----------
export function compoundPage(p) {
  const c = category(p.category);
  const trail = trailFor(p);
  const groups = p.listings.map((l) => groupLabel(l.group));
  const ops = opportunities(p);
  const overview =
    `${esc(p.name)}${p.cas ? ` (CAS ${esc(p.cas)})` : ''} is supplied as part of our cosmetic ingredients range, in the ` +
    `${groups.map(esc).join(' and ')} ${groups.length > 1 ? 'groups' : 'group'}. Main applications: ` +
    `${esc(sentenceCase(p.listings.map((l) => l.opportunity).join('; ')))}.`;

  const body = `
<section class="product-head" data-tone="${c.tone}">
  <div class="wrap">
    ${breadcrumb(trail)}
    <div class="product-grid">
      <div class="product-media">
        <div class="compound-plate" aria-hidden="true">
          <span class="cp-top">${esc(groups[0])}</span>
          <span class="cp-name">${esc(p.name)}</span>
          <span class="cp-cas">CAS ${esc(p.cas || 'on request')}</span>
          <span class="cp-foot">Incretuss · ${esc(c.name)}</span>
        </div>
      </div>
      <div class="product-summary">
        <p class="label"><a href="/${c.page}">${esc(c.name)}</a></p>
        <h1>${esc(p.name)}</h1>
        <p class="latin mono">CAS No. ${esc(p.cas || 'on request')}</p>
        ${keySpec([
          ['Chemical class', groups.map(esc).join('; ')],
          ['Main applications', esc(sentenceCase(ops.join(', ')))],
          ['Purity / grade', 'Confirmed per order'],
        ])}
        <div class="actions">
          <a class="btn btn-primary" href="/${inquiryHref(p.name, 'quote')}">Request a Quote</a>
          <a class="btn btn-secondary" href="/${inquiryHref(p.name, 'tds')}">Request Technical Data Sheet</a>
        </div>
        ${docLinks(p.name, [['sds', 'Safety Data Sheet'], ['coa', 'COA']])}
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
            ['CAS number', `<span class="mono">${esc(p.cas || 'On request')}</span>`],
            ['Chemical class', groups.map(esc).join('; ')],
          ],
        },
        {
          title: 'Supply & documentation',
          rows: [
            ['Purity / grade', ON_REQUEST],
            ['Packaging', ON_REQUEST],
            ['Documentation', 'TDS and SDS on request; COA per batch'],
            ['Export', 'Available; confirm destination with our team'],
          ],
        },
      ])}
      <h2 class="h-detail">Process capability</h2>
      <p class="prose">Our flow and vapour-phase chemistry infrastructure supports high-pressure operation up to 50 bar, reactions up to 600 °C and flexible reactor configurations for scale-up from pilot to commercial scale. <a href="/cosmetic-ingredients.html#flow-chem">Flow chemistry capability</a></p>
    </div>
    <aside class="detail-aside">
      <div class="aside-block">
        <h2 class="h-small">Applications</h2>
        ${tagList(ops)}
      </div>
      <div class="aside-block">
        <h2 class="h-small">Documents on request</h2>
        <ul class="doc-list">
          <li><a href="/${inquiryHref(p.name, 'tds')}">Technical Data Sheet</a></li>
          <li><a href="/${inquiryHref(p.name, 'sds')}">Safety Data Sheet</a></li>
          <li><a href="/${inquiryHref(p.name, 'coa')}">Certificate of Analysis</a></li>
        </ul>
      </div>
    </aside>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${sectionHead({ title: 'Related compounds', lede: `More from the ${esc(groups[0])} group.` })}
    ${relatedList(related(p))}
  </div>
</section>
` +
    inquiryBand({
      title: `Request information on ${esc(p.name)}`,
      text: 'Send the required purity, volume, packaging and destination. We will reply with the specification, pricing, lead time and documentation.',
      product: p.name,
      primaryLabel: 'Request a Quote',
      secondary: { href: '/cosmetic-ingredients.html', label: 'All cosmetic ingredients' },
    });

  const description = truncate(
    `${p.name}${p.cas ? ` (CAS ${p.cas})` : ''}: ${groups.join(', ').toLowerCase()} for ${ops.join(', ').toLowerCase()}. Bulk supply from Incretuss; TDS and SDS on request.`,
    158
  );

  return {
    path: url(p),
    title: `${p.name}${p.cas ? ` (CAS ${p.cas})` : ''} | Cosmetic Ingredients | Incretuss`,
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
