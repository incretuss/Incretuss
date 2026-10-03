import { SITE, CATEGORIES, NAV } from '../content/site.mjs';
import { esc, icons } from './html.mjs';

const FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;1,8..60,400&display=swap';

const YEAR = new Date().getFullYear();

function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.legalName,
    alternateName: SITE.name,
    url: SITE.url + '/',
    logo: SITE.url + '/images/logo_transparent.svg',
    email: SITE.email,
    telephone: SITE.phoneSchema,
    description: SITE.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.address.street,
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      postalCode: SITE.address.postalCode,
      addressCountry: SITE.address.country,
    },
  };
}

function breadcrumbLd(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: SITE.url + '/' + (c.href === 'index.html' ? '' : c.href),
    })),
  };
}

function ldScript(obj) {
  return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>';
}

export function breadcrumb(trail) {
  return (
    '<nav class="breadcrumb" aria-label="Breadcrumb"><ol>' +
    trail
      .map((c, i) =>
        i === trail.length - 1
          ? `<li aria-current="page">${esc(c.label)}</li>`
          : `<li><a href="/${c.href === 'index.html' ? '' : c.href}">${esc(c.label)}</a></li>`
      )
      .join('') +
    '</ol></nav>'
  );
}

function productsMenu(counts) {
  return (
    '<div class="menu-panel" id="menu-products">' +
    '<div class="wrap menu-grid">' +
    CATEGORIES.map(
      (c) =>
        `<a class="menu-cat" data-tone="${c.tone}" href="/${c.page}">` +
        `<span class="menu-index">${c.index}</span>` +
        `<span class="menu-name">${esc(c.name)}</span>` +
        `<span class="menu-lede">${esc(c.lede)}</span>` +
        `<span class="menu-count">${counts[c.key]} ${c.key === 'cosmetics' ? 'compounds' : 'products'}</span>` +
        '</a>'
    ).join('') +
    '<div class="menu-aside">' +
    '<a class="link-arrow" href="/products.html">Full product catalogue ' + icons.arrow + '</a>' +
    '<a class="link-arrow" href="/applications.html">Browse by application ' + icons.arrow + '</a>' +
    '<p>Specification sheets, TDS, SDS and COA are available for every product on request.</p>' +
    '</div>' +
    '</div></div>'
  );
}

function header(active, counts) {
  const links = NAV.map((n) => {
    const current = n.key === active ? ' aria-current="page"' : '';
    if (!n.menu) return `<li><a href="/${n.href}"${current}>${esc(n.label)}</a></li>`;
    return (
      '<li class="has-menu">' +
      `<a href="/${n.href}"${current}>${esc(n.label)}</a>` +
      `<button type="button" class="menu-toggle" aria-expanded="false" aria-controls="menu-products"><span class="sr-only">Show product categories</span>${icons.chevron}</button>` +
      productsMenu(counts) +
      '</li>'
    );
  }).join('');

  const mobile =
    '<div class="mobile-nav" id="mobile-nav" hidden>' +
    '<div class="wrap">' +
    '<p class="mobile-label">Products</p>' +
    '<ul class="mobile-cats">' +
    CATEGORIES.map(
      (c) =>
        `<li><a href="/${c.page}" data-tone="${c.tone}"><span class="menu-index">${c.index}</span>${esc(c.name)}<span class="menu-count">${counts[c.key]}</span></a></li>`
    ).join('') +
    '<li><a href="/products.html"><span class="menu-index">—</span>Full catalogue</a></li>' +
    '</ul>' +
    '<ul class="mobile-links">' +
    NAV.filter((n) => !n.menu)
      .map((n) => `<li><a href="/${n.href}"${n.key === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`)
      .join('') +
    '</ul>' +
    '<div class="mobile-contact">' +
    `<a class="btn btn-primary btn-block" href="/contact.html">Send an Inquiry</a>` +
    `<p><a href="mailto:${SITE.email}">${SITE.email}</a><br><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></p>` +
    '</div>' +
    '</div></div>';

  return (
    '<a class="skip-link" href="#main">Skip to content</a>' +
    '<div class="topbar"><div class="wrap topbar-row">' +
    `<span>${esc(SITE.legalName)} · Bengaluru, India</span>` +
    `<span class="topbar-contact"><a href="mailto:${SITE.email}">${SITE.email}</a><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></span>` +
    '</div></div>' +
    '<header class="site-header">' +
    '<div class="wrap header-row">' +
    `<a class="brand" href="/" aria-label="${esc(SITE.name)} — home"><img src="/images/logo_transparent.svg" alt="${esc(SITE.name)}" width="170" height="49"></a>` +
    `<nav class="primary-nav" aria-label="Primary"><ul>${links}</ul></nav>` +
    '<div class="header-tools">' +
    '<div class="site-search">' +
    `<button type="button" class="icon-btn search-toggle" aria-expanded="false" aria-controls="search-panel">${icons.search}<span class="sr-only">Search products</span></button>` +
    '<div class="search-panel" id="search-panel" hidden>' +
    '<label class="sr-only" for="site-search-input">Search products</label>' +
    '<input type="search" id="site-search-input" class="search-input" placeholder="Search by product, compound, CAS no. or industry" autocomplete="off">' +
    '<ul class="search-results" role="list"></ul>' +
    '</div>' +
    '</div>' +
    '<a class="btn btn-primary btn-sm header-cta" href="/contact.html">Send an Inquiry</a>' +
    '<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="mobile-nav"><span class="nav-toggle-bars" aria-hidden="true"></span><span class="nav-toggle-label">Menu</span></button>' +
    '</div>' +
    '</div>' +
    mobile +
    '</header>'
  );
}

function footer() {
  const cat = CATEGORIES.map((c) => `<li><a href="/${c.page}">${esc(c.name)}</a></li>`).join('');
  return (
    '<footer class="site-footer">' +
    '<div class="wrap">' +
    '<div class="footer-top">' +
    '<div class="footer-brand">' +
    `<img src="/images/logo-light.svg" alt="${esc(SITE.name)}" width="190" height="55">` +
    '<p>Botanical extracts, nutraceutical ingredients and cosmetic ingredients, supplied in bulk to manufacturers.</p>' +
    '</div>' +
    '<div class="footer-col"><h2>Products</h2><ul>' + cat + '<li><a href="/products.html">Full catalogue</a></li><li><a href="/brochure.html">Product brochure</a></li></ul></div>' +
    '<div class="footer-col"><h2>Company</h2><ul>' +
    '<li><a href="/about.html">About Incretuss</a></li>' +
    '<li><a href="/quality.html">Quality &amp; Manufacturing</a></li>' +
    '<li><a href="/applications.html">Applications</a></li>' +
    '<li><a href="/contact.html">Contact</a></li>' +
    '</ul></div>' +
    '<div class="footer-col footer-contact"><h2>Contact</h2>' +
    `<address>${SITE.legalName}<br>${SITE.address.lines.join('<br>')}</address>` +
    `<p><a href="mailto:${SITE.email}">${SITE.email}</a><br><a href="tel:${SITE.phoneHref}">${SITE.phone}</a><br><span>${SITE.hours}</span></p>` +
    '</div>' +
    '</div>' +
    '<div class="footer-bottom">' +
    `<span>© ${YEAR} ${SITE.legalName}. All rights reserved.</span>` +
    '<span>Bulk supply to manufacturers only — we do not sell to consumers.</span>' +
    '</div>' +
    '</div>' +
    '</footer>'
  );
}

/**
 * Wrap a page body in the shared document shell.
 * @param {object} o
 * @param {string} o.path        output file name, e.g. "ginger.html"
 * @param {string} o.title       full <title>
 * @param {string} o.description meta description
 * @param {string} o.active      NAV key to mark as current
 * @param {Array}  [o.trail]     breadcrumb trail [{label, href}]
 * @param {Array}  [o.ld]        extra JSON-LD objects
 * @param {Array}  [o.scripts]   extra deferred scripts
 * @param {string} [o.image]     absolute OG image URL
 * @param {string} [o.ogType]
 * @param {boolean}[o.noindex]
 * @param {string} o.body        page <main> content
 * @param {object} o.counts      product counts per category (for the menu)
 */
export function page(o) {
  const canonical = SITE.url + '/' + (o.path === 'index.html' ? '' : o.path);
  const ld = [];
  if (o.path === 'index.html' || o.path === 'contact.html' || o.path === 'about.html') ld.push(organizationLd());
  if (o.trail) ld.push(breadcrumbLd(o.trail));
  if (o.ld) ld.push(...o.ld);
  const image = o.image || SITE.ogImage;
  const scripts = ['/js/product-store.js', '/js/site.js', ...(o.scripts || [])];

  return `<!DOCTYPE html>
<!-- Generated by src/build.mjs — edit the files in src/ (or data/), then run "npm run build". -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
${o.noindex ? '<meta name="robots" content="noindex">\n' : `<link rel="canonical" href="${canonical}">\n`}<meta name="theme-color" content="#1f3a26">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/favicon/apple-touch-icon.png">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="twitter:image" content="${image}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/style.css">
<script>document.documentElement.classList.add('js')</script>
${ld.map(ldScript).join('\n')}
</head>
<body>
${header(o.active, o.counts)}
<main id="main"${o.mainAttrs ? ' ' + o.mainAttrs : ''}>
${o.body}
</main>
${footer()}
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}
