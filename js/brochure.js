// brochure.html only: shows one product section at a time with tabs to
// switch. The section that opens first is chosen in this order:
//   1. ?section=botanicals|nutraceuticals|aroma|pharma|cosmetics in the link
//   2. "defaultSection" in /data/brochure.json (read here at load, so editing
//      that file takes effect without rebuilding the site)
//   3. the default the page was built with.
// Without JavaScript every section is shown, one after another.
(function () {
  var main = document.querySelector('main.brochure');
  if (!main) return;
  var tabs = Array.prototype.slice.call(main.querySelectorAll('.b-tab'));
  var panels = Array.prototype.slice.call(main.querySelectorAll('.b-panel'));
  // Keep in step with SECTION_ALIASES in src/content/brochure.mjs.
  var ALIASES = {
    botanicals: 'botanicals', botanical: 'botanicals', 'botanical-extracts': 'botanicals',
    nutraceuticals: 'nutraceuticals', nutraceutical: 'nutraceuticals', nutra: 'nutraceuticals',
    aroma: 'aroma', 'aroma-chemicals': 'aroma', chemicals: 'aroma', ketones: 'aroma',
    pharma: 'pharma', pharmaceuticals: 'pharma', apis: 'pharma', generics: 'pharma',
    cosmetics: 'cosmetics', cosmetic: 'cosmetics', 'personal-care': 'cosmetics',
  };

  // Only sections that are on the page count (hidden ones, such as aroma
  // chemicals, are not rendered), so a link to one falls back to the default.
  function normalize(value) {
    var key = ALIASES[String(value || '').trim().toLowerCase()] || null;
    return key && panels.some(function (p) { return p.dataset.section === key; }) ? key : null;
  }

  function show(key, opts) {
    opts = opts || {};
    key = normalize(key);
    if (!key) return;
    tabs.forEach(function (t) {
      var on = t.dataset.section === key;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && opts.focus) t.focus();
    });
    panels.forEach(function (p) {
      p.classList.toggle('is-active', p.dataset.section === key);
    });
    if (opts.updateUrl && window.history && history.replaceState) {
      history.replaceState(null, '', '?section=' + key);
    }
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function (e) {
      e.preventDefault();
      show(tab.dataset.section, { updateUrl: true });
    });
    // Arrow keys move between tabs (WAI-ARIA tabs pattern).
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      show(next.dataset.section, { focus: true, updateUrl: true });
    });
  });

  main.classList.add('is-tabbed');

  /* ---------- Pharma: search every product by name or dosage form ---------- */
  (function () {
    var input = document.getElementById('b-ph-q');
    if (!input) return;
    var panel = document.getElementById('panel-pharma');
    var items = Array.prototype.slice.call(panel.querySelectorAll('.b-ph-area li'));
    var areas = Array.prototype.slice.call(panel.querySelectorAll('.b-ph-area'));
    var cats = Array.prototype.slice.call(panel.querySelectorAll('.b-ph-cat:not(.b-ph-partner)'));
    var jumps = Array.prototype.slice.call(panel.querySelectorAll('.b-ph-jump li'));
    var status = document.getElementById('b-ph-status');
    var empty = document.getElementById('b-ph-empty');
    var total = items.length;

    function apply() {
      var words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      items.forEach(function (li) {
        var text = li.getAttribute('data-search');
        var ok = words.every(function (w) { return text.indexOf(w) !== -1; });
        li.hidden = !ok;
        if (ok) shown++;
      });
      // While searching, counts show matches ("3 of 66"); otherwise totals.
      function count(el, n, total, suffix) {
        if (!el) return;
        if (!el.dataset.total) el.dataset.total = el.textContent;
        el.textContent = words.length ? n + ' of ' + total + (suffix || '') : el.dataset.total;
      }
      areas.forEach(function (a) {
        var n = a.querySelectorAll('li:not([hidden])').length;
        a.hidden = !n;
        count(a.querySelector('h4 span'), n, a.querySelectorAll('li').length);
      });
      cats.forEach(function (c) {
        var n = c.querySelectorAll('li:not([hidden])').length;
        var all = c.querySelectorAll('li').length;
        c.hidden = !n;
        count(c.querySelector('h3 span'), n, all, ' products');
        var jump = jumps.filter(function (j) { return j.querySelector('a').getAttribute('href') === '#' + c.id; })[0];
        if (jump) { jump.hidden = !n; count(jump.querySelector('.menu-count'), n, all); }
      });
      status.textContent = words.length
        ? shown + (shown === 1 ? ' product matches' : ' products match') + ' “' + input.value.trim() + '”.'
        : total + ' products. Type to filter by name or dosage form.';
      empty.hidden = shown > 0;
    }
    var timer;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 60); });
    apply();
  })();

  var fromLink = normalize(new URLSearchParams(window.location.search).get('section'));
  if (fromLink) {
    show(fromLink);
  } else {
    show(main.dataset.defaultSection);
  }

  // Pick up edits to data/brochure.json that have not been rebuilt yet.
  fetch('/data/brochure.json', { cache: 'no-cache' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (config) {
      if (!config) return;
      if (!fromLink && normalize(config.defaultSection)) show(config.defaultSection);
      var eventEl = main.querySelector('[data-event]');
      var name = String(config.event || '').trim();
      if (eventEl) {
        eventEl.hidden = !name;
        if (name) eventEl.querySelector('strong').textContent = name;
      }
    })
    .catch(function () { /* keep the built-in default */ });
})();
