// cosmetic.html only: the shared detail page for every Cosmetics compound,
// rendered from its entry in data/products.json (cosmetic.html?p=<slug>).
//
// Must load before js/site.js: it publishes the slug on <main> synchronously
// so site.js's product-page widgets (recently viewed, related products,
// enquiry links) treat this page exactly like a hand-authored product page.
(function () {
  var store = window.ProductStore;
  var main = document.querySelector('main.cosmetic-page');
  if (!store || !main) return;

  var slug = new URLSearchParams(window.location.search).get('p') || '';
  if (slug) main.dataset.productSlug = slug;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fill(field, html) {
    main.querySelectorAll('[data-field="' + field + '"]').forEach(function (el) { el.innerHTML = html; });
  }

  function specCol(title, rows) {
    return (
      '<div class="spec-col"><h4>' + escapeHtml(title) + '</h4><dl>' +
      rows.map(function (r) { return '<dt>' + escapeHtml(r[0]) + '</dt><dd>' + escapeHtml(r[1]) + '</dd>'; }).join('') +
      '</dl></div>'
    );
  }

  function chip(label) {
    return (
      '<div class="industry-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>' +
      '<span>' + escapeHtml(label.charAt(0).toUpperCase() + label.slice(1)) + '</span></div>'
    );
  }

  function notFound() {
    document.title = 'Compound not found — Incretuss';
    fill('name', 'Compound not found');
    fill('cas', '');
    fill('overview', 'We couldn&rsquo;t find that compound. <a href="products.html#cosmetics" style="color:var(--primary); text-decoration:underline;">Browse the Cosmetics range</a> instead.');
    main.querySelectorAll('[data-needs-product]').forEach(function (el) { el.hidden = true; });
  }

  store.get(slug).then(function (p) {
    if (!p || !store.isCompound(p)) return notFound();

    var groups = p.listings.map(function (l) { return l.group; });
    var description = p.name + (p.cas ? ' (CAS ' + p.cas + ')' : '') + ' — cosmetics compound from Incretuss.';
    document.title = p.name + ' — Incretuss';
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', description);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://incretuss.com/' + store.url(p));

    fill('name', escapeHtml(p.name));
    fill('cas', 'CAS No. ' + escapeHtml(p.cas || '—'));
    fill('groups', groups.map(function (g) {
      return '<a class="badge" href="products.html#cosmetics">' + escapeHtml(g) + '</a>';
    }).join(''));
    fill('overview',
      escapeHtml(p.name) + ' is part of our Cosmetics range, listed under ' +
      escapeHtml(groups.join(' and ')) + '. Main opportunity: ' +
      escapeHtml(p.listings.map(function (l) { return l.opportunity; }).join('; ')) + '.');

    var cols = [specCol('Compound', [
      ['Name', p.name],
      ['CAS No.', p.cas || '—'],
      ['Category', 'Cosmetics'],
    ])];
    p.listings.forEach(function (l) {
      var rows = [['Main Opportunity', l.opportunity]];
      if (l.priority) rows.push(['Priority', new Array(l.priority + 1).join('★')]);
      cols.push(specCol(l.group, rows));
    });
    cols.push(specCol('Sourcing', [
      ['Purity / Grade', 'Available on request'],
      ['Packaging', 'Available on request'],
      ['Export', 'Available — confirm destination with our team'],
    ]));
    var specs = main.querySelector('.spec-columns');
    specs.classList.toggle('cols-4', cols.length === 4);
    specs.innerHTML = cols.join('');

    fill('opportunities', store.opportunities(p).map(chip).join(''));
  });
})();
