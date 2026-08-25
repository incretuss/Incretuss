// Shared site behavior: mobile nav toggle + scroll-reveal animations.
// Loaded on every page via <script src="js/site.js" defer></script>.
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
})();

(function () {
  if (!('IntersectionObserver' in window)) return;
  // threshold is a fraction of the element's own height, not the viewport's —
  // a tall single-column grid on a short mobile screen (e.g. 15 stacked product
  // cards) can need more visible height than the viewport ever provides, so the
  // ratio never reaches 0.15 and the section never reveals. threshold: 0 with a
  // small negative rootMargin fires as soon as any part enters view instead,
  // which works regardless of how tall the element is.
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0, rootMargin: '0px 0px -10% 0px' }
  );
  document.querySelectorAll('.reveal').forEach(function (el) {
    io.observe(el);
  });
})();

// ---------------------------------------------------------------------------
// Product data widgets: header search, back-to-top, scroll-aware header,
// selection tray (compare + shortlist), related products, recently viewed,
// and the enquiry context bridge. All read from window.ProductStore
// (js/product-store.js, loaded before this file) and degrade to no-ops if a
// page has none of the relevant hooks.
// ---------------------------------------------------------------------------
(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var store = window.ProductStore;

  /* ---------- Scroll-aware header ---------- */
  (function () {
    var header = document.querySelector('header');
    if (!header) return;
    function update() {
      header.classList.toggle('header-scrolled', window.scrollY > 24);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  /* ---------- Back to top ---------- */
  (function () {
    var btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    document.body.appendChild(btn);
    function update() {
      btn.classList.toggle('visible', window.scrollY > 500);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  /* ---------- Header search ---------- */
  (function () {
    if (!store) return;
    var navCta = document.querySelector('.nav-cta');
    if (!navCta) return;

    var wrap = document.createElement('div');
    wrap.className = 'site-search';
    wrap.innerHTML =
      '<button type="button" class="site-search-btn" aria-label="Search products" aria-expanded="false">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
      '</button>' +
      '<div class="site-search-panel">' +
      '<input type="search" class="site-search-input" placeholder="Search botanicals, compounds, industries…" aria-label="Search products">' +
      '<div class="site-search-hint">e.g. &ldquo;gingerol&rdquo;, &ldquo;piperine&rdquo;, &ldquo;cosmetics&rdquo;</div>' +
      '<ul class="site-search-results"></ul>' +
      '</div>';
    navCta.insertBefore(wrap, navCta.firstChild);

    var btn = wrap.querySelector('.site-search-btn');
    var panel = wrap.querySelector('.site-search-panel');
    var input = wrap.querySelector('.site-search-input');
    var results = wrap.querySelector('.site-search-results');

    function close() {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function open() {
      panel.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      input.focus();
    }
    btn.addEventListener('click', function () {
      panel.classList.contains('open') ? close() : open();
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    function render(products, query) {
      if (!query) {
        results.innerHTML = '';
        return;
      }
      if (!products.length) {
        results.innerHTML = '<div class="site-search-empty">No products match &ldquo;' + escapeHtml(query) + '&rdquo;.</div>';
        return;
      }
      results.innerHTML = products
        .slice(0, 8)
        .map(function (p) {
          return (
            '<li><a href="' + p.slug + '.html">' +
            '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' +
            '<span><span class="r-name">' + escapeHtml(p.name) + '</span><br>' +
            '<span class="r-meta">' + escapeHtml(p.forms.join(', ')) + '</span></span>' +
            '</a></li>'
          );
        })
        .join('');
    }

    var debounceTimer;
    input.addEventListener('input', function () {
      var query = input.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        store.search(query).then(function (matches) { render(matches, query); });
      }, 90);
    });
  })();

  /* ---------- Selection tray (compare + shortlist) ---------- */
  (function () {
    if (!store) return;
    var tray = document.createElement('div');
    tray.className = 'selection-tray';
    tray.innerHTML =
      '<span class="st-count"></span>' +
      '<div class="st-actions">' +
      '<button type="button" class="st-clear">Clear</button>' +
      '<button type="button" class="st-compare">Compare</button>' +
      '<button type="button" class="st-enquire st-primary">Enquire about selection</button>' +
      '</div>';
    document.body.appendChild(tray);

    var countEl = tray.querySelector('.st-count');
    var compareBtn = tray.querySelector('.st-compare');
    var enquireBtn = tray.querySelector('.st-enquire');
    var clearBtn = tray.querySelector('.st-clear');

    function refresh() {
      var sel = store.selection.read();
      tray.classList.toggle('visible', sel.length > 0);
      countEl.textContent = sel.length + (sel.length === 1 ? ' product selected' : ' products selected');
      compareBtn.disabled = sel.length < 2 || sel.length > 4;
      compareBtn.title = compareBtn.disabled ? 'Select 2–4 products to compare' : '';
      // reflect selection state on any selection toggles present on this page
      document.querySelectorAll('.p-select[data-slug]').forEach(function (el) {
        var on = sel.indexOf(el.dataset.slug) !== -1;
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        el.textContent = on ? '✓ Selected' : '+ Compare';
      });
    }

    // .p-select is a plain <span role="checkbox"> nested inside the card's
    // <a> — preventDefault/stopPropagation here stops that click from also
    // navigating to the product page.
    function handleToggle(e) {
      var el = e.target.closest && e.target.closest('.p-select[data-slug]');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      store.selection.toggle(el.dataset.slug);
      refresh();
    }
    document.addEventListener('click', handleToggle);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!e.target.closest || !e.target.closest('.p-select[data-slug]')) return;
      handleToggle(e);
    });

    clearBtn.addEventListener('click', function () {
      store.selection.clear();
      refresh();
    });
    compareBtn.addEventListener('click', function () {
      if (compareBtn.disabled) return;
      window.location.href = 'compare.html?p=' + store.selection.read().join(',');
    });
    enquireBtn.addEventListener('click', function () {
      window.location.href = 'contact.html?shortlist=' + store.selection.read().join(',');
    });

    refresh();
  })();

  /* ---------- Product page: recently-viewed tracking + related products + enquiry bridge ---------- */
  (function () {
    var main = document.querySelector('main[data-product-slug]');
    if (!main || !store) return;
    var slug = main.dataset.productSlug;

    store.recentlyViewed.push(slug);

    var relatedGrid = document.querySelector('.related-grid');
    if (relatedGrid) {
      store.related(slug, 4).then(function (matches) {
        if (!matches.length) return;
        relatedGrid.innerHTML = matches
          .map(function (p) {
            return (
              '<div class="pi-card">' +
              '<img class="product-thumb" src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + ' illustration" style="width:100%;aspect-ratio:4/3;object-fit:cover;border:1px solid var(--line-soft);margin-bottom:8px;" loading="lazy">' +
              '<span class="lat">' + escapeHtml(p.latin) + '</span>' +
              '<h3><a href="' + p.slug + '.html">' + escapeHtml(p.name) + '</a></h3>' +
              '<span class="forms">' + escapeHtml(p.forms.join(', ')) + '</span>' +
              '</div>'
            );
          })
          .join('');
      });
    }

    // Enquiry bridge: rewrite "Request a Quote / TDS / SDS / Brochure / COA"
    // links so contact.html arrives with the product (and, where relevant,
    // form) already known — the contact form itself is untouched.
    var heading = document.querySelector('.product-hero h1');
    var productName = heading ? heading.textContent.trim() : '';
    var NEED_MAP = {
      'Request a Quote': 'quote',
      'Request Product Brochure': 'brochure',
      'Request Technical Data Sheet': 'tds',
      'Request Safety Data Sheet': 'sds',
      'Request COA': 'coa',
    };
    document.querySelectorAll('.download-row a[href="contact.html"]').forEach(function (a) {
      var need = NEED_MAP[a.textContent.trim()] || 'quote';
      var specBlock = a.closest('.spec-block[id]');
      var formName = specBlock ? specBlock.id.replace(/-/g, ' ') : '';
      var params = new URLSearchParams();
      if (productName) params.set('product', productName);
      if (formName) params.set('form', formName);
      params.set('need', need);
      a.setAttribute('href', 'contact.html?' + params.toString());
    });
  })();

  /* ---------- products.html: recently-viewed strip ---------- */
  (function () {
    var mount = document.getElementById('recentlyViewed');
    if (!mount || !store) return;
    var slugs = store.recentlyViewed.read();
    if (!slugs.length) return;
    store.byslugs(slugs).then(function (products) {
      if (!products.length) return;
      mount.innerHTML =
        '<span class="rv-label">Recently viewed</span>' +
        '<div class="rv-row">' +
        products
          .map(function (p) {
            return (
              '<a class="rv-item" href="' + p.slug + '.html">' +
              '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' +
              '<span>' + escapeHtml(p.name) + '</span>' +
              '</a>'
            );
          })
          .join('') +
        '</div>';
    });
  })();

  /* ---------- Interactive supply-pathway diagram (index.html / about.html) ---------- */
  (function () {
    var svg = document.querySelector('.pipeline');
    if (!svg) return;
    var stages = svg.querySelectorAll('.stage');
    var detail = document.querySelector('.pipeline-detail');
    if (!stages.length || !detail) return;

    var COPY = {
      rd: 'Formulation and extraction-method R&amp;D, scoped per botanical — ask our team about a specific product.',
      mfg: 'Raw material procurement, extraction, filtration, concentration, drying, standardization, and packaging — run in-house from spec to finished product.',
      qc: 'Batch traceability, raw material and finished goods testing, and documentation (COA, spec sheets) provided per order.',
      ship: 'Export-ready, worldwide. Let us know your destination and we’ll confirm shipping options and documentation.',
    };

    function activate(stage) {
      stages.forEach(function (s) {
        s.classList.toggle('stage-active', s === stage);
        s.setAttribute('aria-expanded', s === stage ? 'true' : 'false');
      });
      var key = stage.dataset.stage;
      detail.innerHTML = '<b>' + escapeHtml(stage.dataset.label || key.toUpperCase()) + '.</b> ' + (COPY[key] || '');
    }

    stages.forEach(function (stage) {
      stage.setAttribute('tabindex', '0');
      stage.setAttribute('role', 'button');
      stage.setAttribute('aria-expanded', 'false');
      stage.addEventListener('click', function () { activate(stage); });
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(stage); }
      });
    });
    activate(stages[1] || stages[0]); // default to Manufacturing — the stage with the richest existing copy
  })();
})();
