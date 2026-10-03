// brochure.html only: shows one product section at a time with tabs to
// switch. The section that opens first is chosen in this order:
//   1. ?section=botanicals|nutraceuticals|cosmetics in the link
//   2. "defaultSection" in /data/brochure.json (read here at load, so editing
//      that file takes effect without rebuilding the site)
//   3. the default the page was built with.
// Without JavaScript every section is shown, one after another.
(function () {
  var main = document.querySelector('main.brochure');
  if (!main) return;
  var tabs = Array.prototype.slice.call(main.querySelectorAll('.b-tab'));
  var panels = Array.prototype.slice.call(main.querySelectorAll('.b-panel'));
  var ALIASES = {
    botanicals: 'botanicals', botanical: 'botanicals', 'botanical-extracts': 'botanicals',
    nutraceuticals: 'nutraceuticals', nutraceutical: 'nutraceuticals', nutra: 'nutraceuticals',
    cosmetics: 'cosmetics', cosmetic: 'cosmetics',
  };

  function normalize(value) {
    return ALIASES[String(value || '').trim().toLowerCase()] || null;
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
