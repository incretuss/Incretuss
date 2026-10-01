// products.html only: category tabs (All / Botanical Extracts /
// Nutraceuticals / Cosmetics), facet filtering (industry/form chips +
// free-text search), and rendering of the Cosmetics cards.
//
// Botanical Extract and Nutraceutical cards are hand-authored in the HTML
// (including the four Ginger SKU cards, which intentionally share one product
// entry) and filtered in place via their data-industries / data-forms
// attributes. Cosmetics cards are rendered here from the "cosmetics" entries
// in data/products.json — adding a compound there is enough for it to appear
// on this page, under its listing group, with its own detail page.
(function () {
  var store = window.ProductStore;
  var catalog = document.querySelector('.product-in');
  if (!store || !catalog) return;

  var groups = Array.prototype.slice.call(catalog.querySelectorAll('.catalog-group'));
  var cosmeticsMount = document.getElementById('cosmeticsCatalog');
  var flowChem = document.getElementById('flow-chem');
  var categoryMount = document.getElementById('categoryChips');
  var searchInput = document.getElementById('productFilterSearch');
  var industryMount = document.getElementById('industryChips');
  var formMount = document.getElementById('formChips');
  var statusEl = document.getElementById('facetStatus');
  var emptyEl = document.getElementById('facetEmpty');
  var CATEGORIES = groups.map(function (g) { return g.dataset.category; });

  var state = { query: '', category: '', industry: '', form: '' };
  var cards = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- Cosmetics cards ---------- */

  function stars(n) {
    return new Array(n + 1).join('★');
  }

  // One card per listing, so a compound the source sheet lists under two
  // groups (4-Heptanone) appears in both, each with that group's opportunity —
  // the same one-product/many-cards pattern as the Ginger SKUs above.
  function compoundCard(p, listing) {
    var thumb = p.image && p.image !== 'images/compound.svg'
      ? '<img class="product-thumb" src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">'
      : '<div class="product-thumb compound-plate" aria-hidden="true"><span class="cp-label">' + escapeHtml(listing.group) + '</span></div>';
    return (
      '<a href="' + escapeHtml(store.url(p)) + '" class="p-card" data-slug="' + escapeHtml(p.slug) + '" data-industries="" data-forms="">' +
      '<span class="p-select" role="checkbox" aria-checked="false" tabindex="0" data-slug="' + escapeHtml(p.slug) + '">+ Compare</span>' +
      thumb +
      '<span class="lat cas">' + escapeHtml(store.subtitle(p)) + '</span>' +
      '<h3>' + escapeHtml(p.name) + '</h3>' +
      '<span class="forms">' + escapeHtml(listing.opportunity) + '</span>' +
      (listing.priority
        ? '<span class="availability" aria-label="Priority: ' + listing.priority + ' stars">Priority ' + stars(listing.priority) + '</span>'
        : '') +
      '</a>'
    );
  }

  function renderCosmetics(list) {
    if (!cosmeticsMount) return;
    var order = [];
    var byGroup = {};
    list.filter(store.isCompound).forEach(function (p) {
      p.listings.forEach(function (l) {
        if (!byGroup[l.group]) { byGroup[l.group] = []; order.push(l.group); }
        byGroup[l.group].push(compoundCard(p, l));
      });
    });
    cosmeticsMount.innerHTML = order
      .map(function (group) {
        return (
          '<div class="catalog-subgroup">' +
          '<div class="eyebrow catalog-subhead">' + escapeHtml(group) + '</div>' +
          '<div class="product-in-grid reveal">' + byGroup[group].join('') + '</div>' +
          '</div>'
        );
      })
      .join('');

    // Reflect any existing compare/shortlist selection on the new cards
    // (site.js's tray already ran its first refresh before they existed).
    var sel = store.selection.read();
    cosmeticsMount.querySelectorAll('.p-select[data-slug]').forEach(function (el) {
      var on = sel.indexOf(el.dataset.slug) !== -1;
      el.setAttribute('aria-checked', on ? 'true' : 'false');
      el.textContent = on ? '✓ Selected' : '+ Compare';
    });

    // These grids were added after site.js set up its reveal observer, so
    // observe them here to get the same staggered entrance.
    var grids = cosmeticsMount.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      grids.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    grids.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Facet chips ---------- */

  function setActive(mount, chip) {
    Array.prototype.forEach.call(mount.children, function (c) {
      c.classList.toggle('active', c === chip);
    });
  }

  function makeChip(label, group) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'facet-chip';
    chip.textContent = label;
    chip.addEventListener('click', function () {
      var next = state[group] === label ? '' : label;
      state[group] = next;
      setActive(chip.parentNode, next !== '' ? chip : null);
      applyFilter();
    });
    return chip;
  }

  if (industryMount && formMount) {
    store.facets().then(function (facets) {
      facets.industries.forEach(function (i) { industryMount.appendChild(makeChip(i, 'industry')); });
      facets.forms.forEach(function (f) { formMount.appendChild(makeChip(f, 'form')); });
    });
  }

  // Industry / Form describe botanicals only; hide them (and drop their
  // selection) while a category they don't apply to is selected.
  function syncFacetGroups() {
    catalog.querySelectorAll('.facet-group[data-applies-to]').forEach(function (fg) {
      var applies = !state.category || fg.dataset.appliesTo.split(' ').indexOf(state.category) !== -1;
      fg.hidden = !applies;
      if (!applies) {
        var mount = fg.querySelector('.facet-chips');
        if (mount === industryMount) state.industry = '';
        if (mount === formMount) state.form = '';
        if (mount) setActive(mount, null);
      }
    });
  }

  function selectCategory(category, updateHash) {
    if (CATEGORIES.indexOf(category) === -1) category = '';
    state.category = category;
    if (categoryMount) {
      Array.prototype.forEach.call(categoryMount.children, function (c) {
        c.classList.toggle('active', c.dataset.category === category);
        c.setAttribute('aria-pressed', c.dataset.category === category ? 'true' : 'false');
      });
    }
    syncFacetGroups();
    applyFilter();
    if (updateHash && window.history && history.replaceState) {
      history.replaceState(null, '', category ? '#' + category : window.location.pathname + window.location.search);
    }
  }

  if (categoryMount) {
    Array.prototype.forEach.call(categoryMount.children, function (chip) {
      chip.addEventListener('click', function () { selectCategory(chip.dataset.category, true); });
    });
  }

  /* ---------- Filtering ---------- */

  function applyFilter() {
    var q = state.query.trim().toLowerCase();
    var visible = 0;
    var total = 0;
    cards.forEach(function (card) {
      var category = card.closest('.catalog-group').dataset.category;
      var inCategory = !state.category || category === state.category;
      var industries = (card.dataset.industries || '').split(',');
      var forms = (card.dataset.forms || '').split(',');
      var text = card.textContent.toLowerCase();
      var matchesQuery = !q || text.indexOf(q) !== -1;
      var matchesIndustry = !state.industry || industries.indexOf(state.industry) !== -1;
      var matchesForm = !state.form || forms.indexOf(state.form) !== -1;
      var show = inCategory && matchesQuery && matchesIndustry && matchesForm;
      card.classList.toggle('fc-hidden', !show);
      if (inCategory) total++;
      if (show) visible++;
    });

    // Hide any category / sub-group left with nothing to show.
    catalog.querySelectorAll('.catalog-subgroup').forEach(function (sg) {
      sg.hidden = !sg.querySelector('.p-card:not(.fc-hidden)');
    });
    groups.forEach(function (g) {
      g.hidden = !g.querySelector('.p-card:not(.fc-hidden)');
    });
    // Flow Chem Advantages belongs to Cosmetics: shown whenever Cosmetics is.
    if (flowChem) {
      var cosmetics = document.getElementById('cosmetics');
      flowChem.hidden = !cosmetics || cosmetics.hidden;
    }

    if (emptyEl) emptyEl.classList.toggle('visible', visible === 0);
    if (statusEl) statusEl.textContent = visible + ' of ' + total + ' shown';
  }

  function updateGroupCounts() {
    groups.forEach(function (g) {
      var slugs = {};
      g.querySelectorAll('.p-card[data-slug]').forEach(function (c) { slugs[c.dataset.slug] = true; });
      var n = Object.keys(slugs).length;
      var unit = g.dataset.category === 'cosmetics' ? 'compound' : 'product';
      var label = n + ' ' + unit + (n === 1 ? '' : 's');
      g.querySelectorAll('[data-group-count]').forEach(function (el) { el.textContent = label; });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      state.query = searchInput.value;
      applyFilter();
    });
  }

  // #botanical-extracts / #nutraceuticals / #cosmetics open that category;
  // #flow-chem opens Cosmetics and scrolls to the Flow Chem section.
  function categoryFromHash() {
    var hash = window.location.hash.replace('#', '');
    return hash === 'flow-chem' ? 'cosmetics' : hash;
  }
  window.addEventListener('hashchange', function () { selectCategory(categoryFromHash(), false); });

  store.all().then(function (list) {
    renderCosmetics(list);
    cards = Array.prototype.slice.call(catalog.querySelectorAll('.catalog-group .p-card'));
    updateGroupCounts();
    selectCategory(categoryFromHash(), false);
    // The hash target may only have become visible/sized after rendering.
    if (window.location.hash) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  });
})();
