// Shared product data layer, loaded on every page via
// <script src="js/product-store.js" defer></script> before js/site.js.
//
// Everything below reads from the one hand-consolidated data/products.json —
// the same fields already written into each product page's spec tables —
// so search, filtering, related products, comparison and the shortlist all
// stay consistent without duplicating data per page.
//
// Each entry carries a `category` (botanical-extracts | nutraceuticals |
// cosmetics). Cosmetics entries are compounds rather than plant extracts:
// they have `cas` and `listings` ({group, opportunity, priority?}) instead of
// latin/part/forms/markers, and their detail view is the shared
// cosmetic.html?p=<slug> page. url()/subtitle()/summary() below hide that
// difference from the widgets that render cards, search results, etc.
window.ProductStore = (function () {
  // Resolved against this script's own URL (js/ -> ../data/) so it works
  // whether the site is served from the domain root or a sub-path preview.
  var DATA_URL = document.currentScript
    ? new URL('../data/products.json', document.currentScript.src).href
    : '/data/products.json';
  var cache = null;

  // Compound entries have no forms/markers/industries; default them so the
  // shared search/facet/related code can treat every entry the same way.
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

  // Detail-page URL: botanicals have their own hand-authored page, cosmetics
  // compounds share one data-driven page.
  function url(p) {
    return isCompound(p) ? 'cosmetic.html?p=' + encodeURIComponent(p.slug) : p.slug + '.html';
  }

  // Secondary line under a product name (latin name / CAS number).
  function subtitle(p) {
    if (!isCompound(p)) return p.latin;
    return 'CAS ' + (p.cas || '\u2014');
  }

  // One-line description of what's on offer (forms / main opportunity).
  function summary(p) {
    if (!isCompound(p)) return p.forms.join(', ');
    return p.listings.map(function (l) { return l.opportunity; }).join('; ');
  }

  // Individual opportunity terms ("Flavor", "fragrance", ...) across all of a
  // compound's listings, de-duplicated case-insensitively.
  function opportunities(p) {
    var seen = {}, out = [];
    p.listings.forEach(function (l) {
      l.opportunity.split(/[,;]/).forEach(function (term) {
        term = term.trim();
        var key = term.toLowerCase();
        if (term && !seen[key]) { seen[key] = true; out.push(term); }
      });
    });
    return out;
  }

  function matchesQuery(p, q) {
    if (!q) return true;
    var haystack = [p.name, p.latin, p.part, p.cas]
      .concat(p.forms, p.markers, p.industries)
      .concat(p.listings.map(function (l) { return l.group + ' ' + l.opportunity; }))
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
  // Compounds are only related to other compounds: shared listing group
  // counts most, then shared opportunity terms.
  function related(slug, limit) {
    limit = limit || 4;
    return load().then(function (list) {
      var target = bySlug(list, slug);
      if (!target) return [];
      var targetGroups = target.listings.map(function (l) { return l.group; });
      var targetOpps = opportunities(target).map(function (o) { return o.toLowerCase(); });
      return list
        .filter(function (p) { return p.slug !== slug && isCompound(p) === isCompound(target); })
        .map(function (p) {
          var score = 0;
          p.listings.forEach(function (l) { if (targetGroups.indexOf(l.group) !== -1) score += 2; });
          opportunities(p).forEach(function (o) { if (targetOpps.indexOf(o.toLowerCase()) !== -1) score += 1; });
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
    isCompound: isCompound,
    url: url,
    subtitle: subtitle,
    summary: summary,
    opportunities: opportunities,
    selection: { read: readSelection, toggle: toggleSelection, clear: clearSelection },
    recentlyViewed: { push: pushRecentlyViewed, read: readRecentlyViewed },
  };
})();
