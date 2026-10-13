import { CATEGORIES } from '../content/site.mjs';
import { esc, icons } from '../lib/html.mjs';
import { breadcrumb } from '../lib/layout.mjs';
import { AROMA, PRODUCTS, compoundGroups, inCategory, url } from '../lib/catalogue.mjs';
import { catalogueRow, compoundTable, inquiryBand, productEntry, sectionHead } from '../lib/components.mjs';

function pageHead({ trail, label, title, lede, tone, extra = '' }) {
  return `
<section class="page-head"${tone ? ` data-tone="${tone}"` : ''}>
  <div class="wrap">
    ${breadcrumb(trail)}
    <div class="page-head-grid">
      <div>
        ${label ? `<p class="label">${label}</p>` : ''}
        <h1>${title}</h1>
      </div>
      <div class="page-head-aside">
        <p class="page-lede">${lede}</p>
        ${extra}
      </div>
    </div>
  </div>
</section>`;
}

export { pageHead };

function otherCategories(current) {
  return `
<section class="section section-tight">
  <div class="wrap">
    <h2 class="h-small">Other categories</h2>
    <ul class="cat-links">
      ${CATEGORIES.filter((c) => c.key !== current)
        .map(
          (c) =>
            `<li data-tone="${c.tone}"><a href="/${c.page}"><span class="menu-index">${c.index}</span><span class="cat-links-name">${esc(c.name)}</span><span class="cat-links-lede">${esc(c.lede)}</span>${icons.arrow}</a></li>`
        )
        .join('')}
      <li><a href="/products.html"><span class="menu-index"></span><span class="cat-links-name">Full catalogue</span><span class="cat-links-lede">All products in one list, with search and filters.</span>${icons.arrow}</a></li>
    </ul>
  </div>
</section>`;
}

// ---------- products.html ----------
export function productsIndex() {
  const industries = [...new Set(PRODUCTS.flatMap((p) => p.industries || []))].sort();
  const trail = [
    { label: 'Home', href: 'index.html' },
    { label: 'Products', href: 'products.html' },
  ];
  const sections = CATEGORIES.map((c) => {
    const items = inCategory(c.key);
    return `
    <section class="cat-section" id="${c.anchor}" data-category="${c.key}" data-tone="${c.tone}" aria-labelledby="h-${c.anchor}">
      <div class="cat-section-head">
        <span class="cat-num">${c.index}</span>
        <div>
          <h2 id="h-${c.anchor}">${esc(c.name)}</h2>
          <p>${esc(c.lede)}</p>
        </div>
        <a class="link-arrow" href="/${c.page}">Category overview ${icons.arrow}</a>
      </div>
      <ul class="rows" role="list">${items.map(catalogueRow).join('')}</ul>
    </section>`;
  }).join('');

  const body =
    pageHead({
      trail,
      label: 'Products',
      title: 'Product catalogue',
      lede: 'Botanical extracts, nutraceutical ingredients and aroma chemicals. Open any product for its specification; specification sheets, TDS, SDS and COA are available on request.',
      extra:
        '<ul class="jump-links">' +
        CATEGORIES.map((c) => `<li data-tone="${c.tone}"><a href="#${c.anchor}"><span class="menu-index">${c.index}</span>${esc(c.name)}<span class="menu-count">${inCategory(c.key).length}</span></a></li>`).join('') +
        '</ul>',
    }) +
    `
<section class="catalogue">
  <div class="wrap">
    <form class="filters" role="search" aria-label="Filter the catalogue" onsubmit="return false">
      <div class="filter-field filter-search">
        <label for="filter-q">Search</label>
        <input type="search" id="filter-q" placeholder="Name, botanical name, marker, CAS no." autocomplete="off">
      </div>
      <div class="filter-field">
        <label for="filter-cat">Category</label>
        <select id="filter-cat">
          <option value="">All categories</option>
          ${CATEGORIES.map((c) => `<option value="${c.key}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="filter-field">
        <label for="filter-ind">Industry</label>
        <select id="filter-ind">
          <option value="">All industries</option>
          ${industries.map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join('')}
        </select>
      </div>
      <p class="filter-status" id="filter-status" role="status" aria-live="polite"></p>
    </form>
    <div id="recently-viewed" class="recent" hidden></div>
    ${sections}
    <p class="filter-empty" id="filter-empty" hidden>No products match these filters. <button type="button" class="text-btn" id="filter-reset">Clear filters</button> or <a href="/contact.html">tell us what you are looking for</a>.</p>
  </div>
</section>` +
    inquiryBand({
      title: 'Looking for a product not listed here?',
      text: 'We can scope custom extraction, grades and specifications. Send the botanical or compound, target specification and volume.',
    });

  return {
    path: 'products.html',
    title: 'Product Catalogue: Botanical Extracts, Nutraceuticals & Aroma Chemicals | Incretuss',
    description:
      'Incretuss product catalogue: botanical extracts, oleoresins and essential oils; standardized nutraceutical ingredients; and aroma chemicals and specialty ketones for flavor, fragrance, solvent and synthesis use.',
    active: 'products',
    trail,
    scripts: ['/js/catalogue.js'],
    body,
  };
}

// ---------- category pages ----------
export function categoryPage(c) {
  const items = inCategory(c.key);
  const trail = [
    { label: 'Home', href: 'index.html' },
    { label: 'Products', href: 'products.html' },
    { label: c.name, href: c.page },
  ];
  const head = pageHead({
    trail,
    tone: c.tone,
    label: `Category ${c.index}`,
    title: esc(c.name),
    lede: esc(c.intro),
    extra: `<p class="page-meta">${items.length} ${c.key === AROMA ? 'compounds' : 'products'} · <a href="/contact.html">Request a specification sheet</a></p>`,
  });

  let main;
  if (c.key === AROMA) {
    const groups = compoundGroups();
    const families = [...new Set(groups.map((g) => g.family))];
    main = `
<section class="section section-first">
  <div class="wrap">
    ${families
      .map((f) => `<h2 class="register-family">${esc(f)}</h2>` + compoundTable(groups.filter((g) => g.family === f), { caption: true }))
      .join('')}
    <p class="table-note">Applications listed are the documented uses of each compound. Grade, purity, packaging and documentation are confirmed per order. Use in fragrance, flavor or cosmetic products is subject to the regulations of the destination market and is confirmed with our team before supply.</p>
    <p class="table-note">Looking for ingredients for cosmetic and personal-care formulation? See our <a href="/botanical-extracts.html">botanical extracts and essential oils</a> and <a href="/applications.html#cosmetics">cosmetics &amp; personal care applications</a>.</p>
  </div>
</section>`;
  } else {
    main = `
<section class="section section-first">
  <div class="wrap">
    <div class="entries">${items.map((p) => productEntry(p)).join('')}</div>
  </div>
</section>`;
  }

  const desc = {
    'botanical-extracts':
      'Botanical extracts from Incretuss: ginger, turmeric, pepper, cinnamon, nutmeg and green tea extracts, oleoresins and CO₂ extracts, plus lavender and rosemary essential oils.',
    nutraceuticals:
      'Nutraceutical ingredients from Incretuss: ashwagandha, bacopa, boswellia, garcinia cambogia, green coffee and tulsi extracts, standardized to marker compounds.',
    [AROMA]:
      'Aroma chemicals and specialty ketones from Incretuss: methyl, ethyl and symmetric dialkyl ketones and acetophenones for flavor, fragrance, solvent and synthesis use, listed by CAS number.',
  }[c.key];

  return {
    path: c.page,
    title: `${c.name} | Incretuss`,
    description: desc,
    active: 'products',
    trail,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: c.name,
        itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://incretuss.com/${url(p)}`, name: p.name })),
      },
    ],
    body:
      head +
      main +
      otherCategories(c.key) +
      inquiryBand({
        title: c.key === AROMA ? 'Request compound information' : 'Request product information',
        text: 'Tell us the product, form, target grade, volume and destination. We will reply with the specification, pricing, lead time and documentation.',
      }),
  };
}

