// Shared product data layer, loaded on every page via
// <script src="js/product-store.js" defer></script> before js/site.js.
//
// Everything below reads from the one hand-consolidated data/products.json —
// the same fields already written into each product page's spec tables —
// so search, filtering, related products, comparison and the shortlist all
// stay consistent without duplicating data per page.
window.ProductStore = (function () {
  var DATA_URL = '/data/products.json';
  var cache = null;

  function load() {
    if (!cache) {
      cache = fetch(DATA_URL)
        .then(function (res) {
          if (!res.ok) throw new Error('products.json responded ' + res.status);
          return res.json();
        })
        .catch(function (err) {
          console.error('ProductStore: failed to load product data', err);
          return [];
        });
    }
    return cache;
  }

  function bySlug(list, slug) {
    return list.filter(function (p) { return p.slug === slug; })[0];
  }

  function matchesQuery(p, q) {
    if (!q) return true;
    var haystack = [p.name, p.latin, p.part]
      .concat(p.forms, p.markers, p.industries)
      .join(' ')
      .toLowerCase();
    return haystack.indexOf(q.toLowerCase()) !== -1;
  }

  function search(query, opts) {
    opts = opts || {};
    return load().then(function (list) {
      return list.filter(function (p) {
        if (!matchesQuery(p, query)) return false;
        if (opts.industry && p.industries.indexOf(opts.industry) === -1) return false;
        if (opts.form && p.forms.indexOf(opts.form) === -1) return false;
        return true;
      });
    });
  }

  // Related-by-relevance: shared industries count more than shared forms or
  // markers, since "who else buys this" is the strongest B2B signal here.
  function related(slug, limit) {
    limit = limit || 4;
    return load().then(function (list) {
      var target = bySlug(list, slug);
      if (!target) return [];
      return list
        .filter(function (p) { return p.slug !== slug; })
        .map(function (p) {
          var score = 0;
          p.industries.forEach(function (i) { if (target.industries.indexOf(i) !== -1) score += 2; });
          p.forms.forEach(function (f) { if (target.forms.indexOf(f) !== -1) score += 1; });
          p.markers.forEach(function (m) { if (target.markers.indexOf(m) !== -1) score += 1; });
          return { product: p, score: score };
        })
        .filter(function (x) { return x.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, limit)
        .map(function (x) { return x.product; });
    });
  }

  function get(slug) {
    return load().then(function (list) { return bySlug(list, slug); });
  }

  function byslugs(slugs) {
    return load().then(function (list) {
      return slugs.map(function (s) { return bySlug(list, s); }).filter(Boolean);
    });
  }

  function facets() {
    return load().then(function (list) {
      var industries = {}, forms = {};
      list.forEach(function (p) {
        p.industries.forEach(function (i) { industries[i] = true; });
        p.forms.forEach(function (f) { forms[f] = true; });
      });
      return {
        industries: Object.keys(industries).sort(),
        forms: Object.keys(forms).sort(),
      };
    });
  }

  // ---- Selection: one shared set behind both "compare" and "shortlist to
  // enquire" — a visitor picks products once, then chooses what to do with
  // the picks, instead of two competing checkbox systems on the same cards.
  var SELECTION_KEY = 'incretuss:selection';
  var RECENT_KEY = 'incretuss:recentlyViewed';

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  function readSelection() { return readJSON(SELECTION_KEY, []); }
  function toggleSelection(slug) {
    var sel = readSelection();
    var i = sel.indexOf(slug);
    if (i === -1) sel.push(slug); else sel.splice(i, 1);
    writeJSON(SELECTION_KEY, sel);
    return sel;
  }
  function clearSelection() { writeJSON(SELECTION_KEY, []); }

  function pushRecentlyViewed(slug) {
    var arr = readJSON(RECENT_KEY, []).filter(function (s) { return s !== slug; });
    arr.unshift(slug);
    writeJSON(RECENT_KEY, arr.slice(0, 6));
  }
  function readRecentlyViewed() { return readJSON(RECENT_KEY, []); }

  return {
    all: load,
    get: get,
    byslugs: byslugs,
    search: search,
    related: related,
    facets: facets,
    selection: { read: readSelection, toggle: toggleSelection, clear: clearSelection },
    recentlyViewed: { push: pushRecentlyViewed, read: readRecentlyViewed },
  };
})();
