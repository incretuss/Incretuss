// products.html only: facet filtering (industry/form chips + free-text
// search) over the existing product cards, using the data-industries /
// data-forms attributes on each .p-card. Filters the cards already in the
// DOM rather than re-rendering from data/products.json, so it works
// instantly and stays in sync with the hand-authored grid (including the
// four Ginger SKU cards, which intentionally share one product entry).
(function () {
  var store = window.ProductStore;
  var grid = document.querySelector('.product-in-grid');
  if (!store || !grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.p-card'));
  var searchInput = document.getElementById('productFilterSearch');
  var industryMount = document.getElementById('industryChips');
  var formMount = document.getElementById('formChips');
  var statusEl = document.getElementById('facetStatus');
  var emptyEl = document.getElementById('facetEmpty');

  var state = { query: '', industry: '', form: '' };

  function makeChip(label, group) {
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'facet-chip';
    chip.textContent = label;
    chip.addEventListener('click', function () {
      var next = state[group] === label ? '' : label;
      state[group] = next;
      Array.prototype.forEach.call(chip.parentNode.children, function (c) {
        c.classList.toggle('active', c === chip && next !== '');
      });
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

  function applyFilter() {
    var q = state.query.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (card) {
      var industries = (card.dataset.industries || '').split(',');
      var forms = (card.dataset.forms || '').split(',');
      var text = card.textContent.toLowerCase();
      var matchesQuery = !q || text.indexOf(q) !== -1;
      var matchesIndustry = !state.industry || industries.indexOf(state.industry) !== -1;
      var matchesForm = !state.form || forms.indexOf(state.form) !== -1;
      var show = matchesQuery && matchesIndustry && matchesForm;
      card.classList.toggle('fc-hidden', !show);
      if (show) visible++;
    });
    if (emptyEl) emptyEl.classList.toggle('visible', visible === 0);
    if (statusEl) statusEl.textContent = visible + ' of ' + cards.length + ' shown';
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      state.query = searchInput.value;
      applyFilter();
    });
  }

  applyFilter();
})();
