// Shared behaviour for every page: header (products menu, mobile menu,
// scroll state), product search, the compare/shortlist tray, recently
// viewed tracking and a light reveal-on-scroll. Pages render fully without
// this file; everything here is progressive enhancement.
(function () {
  var store = window.ProductStore;
  var header = document.querySelector('.site-header');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Fixed-position panels (products menu, mobile menu) open directly under
  // the header, whose distance from the top changes as the top bar scrolls
  // away.
  function syncMenuTop() {
    if (!header) return;
    var bottom = Math.max(0, header.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--menu-top', bottom + 'px');
  }

  /* ---------- Header scroll state ---------- */
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 40);
      syncMenuTop();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncMenuTop);
    onScroll();
  }

  /* ---------- Products menu (desktop) ---------- */
  (function () {
    var item = document.querySelector('.has-menu');
    if (!item) return;
    var btn = item.querySelector('.menu-toggle');
    var closeTimer;

    function set(open) {
      clearTimeout(closeTimer);
      if (open) syncMenuTop();
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      set(!item.classList.contains('is-open'));
    });
    // Hover opens on pointer devices; a short delay on leave lets the
    // pointer travel from the link into the panel.
    item.addEventListener('mouseenter', function (e) {
      if (window.matchMedia('(hover: hover)').matches) set(true);
    });
    item.addEventListener('mouseleave', function () {
      closeTimer = setTimeout(function () { set(false); }, 120);
    });
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) set(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && item.classList.contains('is-open')) {
        set(false);
        btn.focus();
      }
    });
  })();

  /* ---------- Mobile menu ---------- */
  (function () {
    var toggle = document.querySelector('.nav-toggle');
    var panel = document.getElementById('mobile-nav');
    if (!toggle || !panel) return;

    function set(open) {
      syncMenuTop();
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.querySelector('.nav-toggle-label').textContent = open ? 'Close' : 'Menu';
      document.body.classList.toggle('nav-locked', open);
    }
    toggle.addEventListener('click', function () {
      set(panel.hidden);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        set(false);
        toggle.focus();
      }
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) set(false);
    });
    window.matchMedia('(min-width: 1025px)').addEventListener('change', function (mq) {
      if (mq.matches) set(false);
    });
  })();

  /* ---------- Product search (header) ---------- */
  (function () {
    var wrap = document.querySelector('.site-search');
    if (!wrap || !store) return;
    var btn = wrap.querySelector('.search-toggle');
    var panel = wrap.querySelector('.search-panel');
    var input = wrap.querySelector('.search-input');
    var results = wrap.querySelector('.search-results');

    function set(open) {
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) input.focus();
    }
    btn.addEventListener('click', function () { set(panel.hidden); });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !wrap.contains(e.target)) set(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        set(false);
        btn.focus();
      }
    });

    function render(list, query) {
      if (!query) { results.innerHTML = ''; return; }
      if (!list.length) {
        results.innerHTML = '<li class="search-empty">No products match “' + escapeHtml(query) + '”. <a href="/contact.html">Ask our team</a>.</li>';
        return;
      }
      results.innerHTML = list.slice(0, 8).map(function (p) {
        return '<li><a href="/' + escapeHtml(store.url(p)) + '">' +
          '<span class="sr-name">' + escapeHtml(p.name) + '</span>' +
          '<span class="sr-cat">' + escapeHtml(store.categoryName(p)) + '</span>' +
          '<span class="sr-meta">' + escapeHtml(store.subtitle(p)) + ' · ' + escapeHtml(store.summary(p)) + '</span>' +
          '</a></li>';
      }).join('');
    }

    var timer;
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(timer);
      timer = setTimeout(function () {
        store.search(q).then(function (list) { render(list, q); });
      }, 80);
    });
  })();

  /* ---------- Compare / shortlist tray ---------- */
  (function () {
    if (!store) return;
    var toggles = document.querySelectorAll('[data-compare]');
    var tray = document.createElement('div');
    tray.className = 'tray';
    tray.setAttribute('role', 'region');
    tray.setAttribute('aria-label', 'Selected products');
    tray.innerHTML =
      '<span class="tray-count" aria-live="polite"></span>' +
      '<div class="tray-actions">' +
      '<button type="button" class="btn btn-ghost-dark btn-secondary" data-act="clear">Clear</button>' +
      '<button type="button" class="btn btn-ghost-dark btn-secondary" data-act="compare">Compare</button>' +
      '<button type="button" class="btn btn-light" data-act="enquire">Inquire about selection</button>' +
      '</div>';
    document.body.appendChild(tray);
    var countEl = tray.querySelector('.tray-count');
    var compareBtn = tray.querySelector('[data-act="compare"]');

    function refresh() {
      var sel = store.selection.read();
      tray.classList.toggle('is-visible', sel.length > 0);
      tray.hidden = sel.length === 0;
      countEl.textContent = sel.length + (sel.length === 1 ? ' product selected' : ' products selected');
      compareBtn.disabled = sel.length < 2 || sel.length > 4;
      compareBtn.title = compareBtn.disabled ? 'Select 2–4 products to compare' : '';
      toggles.forEach(function (el) {
        el.setAttribute('aria-pressed', sel.indexOf(el.dataset.compare) !== -1 ? 'true' : 'false');
      });
    }
    toggles.forEach(function (el) {
      el.addEventListener('click', function () {
        store.selection.toggle(el.dataset.compare);
        refresh();
      });
    });
    tray.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var sel = store.selection.read();
      if (act.dataset.act === 'clear') { store.selection.clear(); refresh(); }
      if (act.dataset.act === 'compare' && !compareBtn.disabled) window.location.href = '/compare.html?p=' + sel.join(',');
      if (act.dataset.act === 'enquire') window.location.href = '/contact.html?shortlist=' + sel.join(',');
    });
    window.addEventListener('pageshow', refresh);
    refresh();
  })();

  /* ---------- Recently viewed (product pages record, catalogue shows) ---------- */
  (function () {
    if (!store) return;
    var main = document.querySelector('main[data-product-slug]');
    if (main) store.recentlyViewed.push(main.dataset.productSlug);

    var mount = document.getElementById('recently-viewed');
    if (!mount) return;
    var slugs = store.recentlyViewed.read();
    if (!slugs.length) return;
    store.byslugs(slugs).then(function (list) {
      if (!list.length) return;
      mount.innerHTML = '<span class="recent-label">Recently viewed:</span>' + list.map(function (p) {
        return '<a href="/' + escapeHtml(store.url(p)) + '">' + escapeHtml(p.name) + '</a>';
      }).join('');
      mount.hidden = false;
    });
  })();

  /* ---------- Reveal on scroll (subtle, opt-in via .reveal) ---------- */
  (function () {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  })();
})();
