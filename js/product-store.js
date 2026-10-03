// Shared product data layer, loaded on every page before js/site.js.
//
// Reads data/products.json (the same data src/build.mjs renders the pages
// from) for the header search, the compare table and the contact-form
// shortlist, and keeps the visitor's compare selection and recently viewed
// products in localStorage.
//
// Entries carry a `category` (botanical-extracts | nutraceuticals |
// cosmetics). Cosmetics entries are compounds: they have `cas` and
// `listings` ({group, opportunity}) instead of latin/part/forms/markers.
window.ProductStore = (function () {
  var DATA_URL = document.currentScript
    ? new URL('../data/products.json', document.currentScript.src).href
    : '/data/products.json';
  var CATEGORY_NAMES = {
    'botanical-extracts': 'Botanical Extracts',
    nutraceuticals: 'Nutraceutical Ingredients',
    cosmetics: 'Cosmetic Ingredients',
  };
  var cache = null;

  function normalize(p) {
    p.forms = p.forms || [];
    p.markers = p.markers || [];
    p.industries = p.industries || [];
    p.listings = p.listings || [];
    return p;
  }

  function load() {
    if (!cache) {
      cache = fetch(DATA_URL)
        .then(function (res) {
          if (!res.ok) throw new Error('products.json responded ' + res.status);
          return res.json();
        })
        .then(function (list) { return list.map(normalize); })
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

  function isCompound(p) { return p.category === 'cosmetics'; }

  // Every product has its own static page at /<slug>.html.
  function url(p) { return p.slug + '.html'; }

  function categoryName(p) { return CATEGORY_NAMES[p.category] || ''; }

  // Secondary line under a product name (botanical name / CAS number).
  function subtitle(p) {
    return isCompound(p) ? 'CAS ' + (p.cas || 'on request') : p.latin;
  }

  // One-line description of what's on offer (forms / main applications).
  function summary(p) {
    if (!isCompound(p)) return p.forms.join(', ');
    return p.listings.map(function (l) { return l.opportunity; }).join('; ');
  }

  function matchesQuery(p, q) {
    if (!q) return true;
    var haystack = [p.name, p.latin, p.part, p.cas, categoryName(p)]
      .concat(p.forms, p.markers, p.industries)
      .concat(p.listings.map(function (l) { return l.group + ' ' + l.opportunity; }))
      .join(' ')
      .toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (term) {
      return haystack.indexOf(term) !== -1;
    });
  }

  function search(query) {
    return load().then(function (list) {
      return list.filter(function (p) { return matchesQuery(p, query); });
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

  // ---- Selection: one shared set behind both "compare" and "shortlist to
  // inquire"; a visitor picks products once, then chooses what to do.
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
    isCompound: isCompound,
    url: url,
    categoryName: categoryName,
    subtitle: subtitle,
    summary: summary,
    selection: { read: readSelection, toggle: toggleSelection, clear: clearSelection },
    recentlyViewed: { push: pushRecentlyViewed, read: readRecentlyViewed },
  };
})();
