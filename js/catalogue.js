// products.html only: filters the statically rendered catalogue rows by
// free text, category and industry. Category deep links (#botanical-extracts,
// #nutraceuticals, #cosmetics, and the old #flow-chem) keep working.
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('.catalogue .row'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.cat-section'));
  var q = document.getElementById('filter-q');
  var cat = document.getElementById('filter-cat');
  var ind = document.getElementById('filter-ind');
  var status = document.getElementById('filter-status');
  var empty = document.getElementById('filter-empty');
  var reset = document.getElementById('filter-reset');
  if (!rows.length || !q || !cat || !ind) return;

  function apply() {
    var terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var visible = 0;
    rows.forEach(function (row) {
      var ok =
        (!cat.value || row.dataset.category === cat.value) &&
        (!ind.value || (row.dataset.industries || '').split('|').indexOf(ind.value) !== -1) &&
        terms.every(function (t) { return row.dataset.search.indexOf(t) !== -1; });
      row.hidden = !ok;
      if (ok) visible++;
    });
    sections.forEach(function (s) {
      s.hidden = !s.querySelector('.row:not([hidden])');
    });
    var filtered = terms.length || cat.value || ind.value;
    status.textContent = filtered ? visible + ' of ' + rows.length + ' products' : rows.length + ' products';
    empty.hidden = visible !== 0;
  }

  [q, cat, ind].forEach(function (el) {
    el.addEventListener(el === q ? 'input' : 'change', apply);
  });
  if (reset) {
    reset.addEventListener('click', function () {
      q.value = ''; cat.value = ''; ind.value = '';
      apply();
      q.focus();
    });
  }

  // Old links pointed at #flow-chem on this page; that content now lives on
  // the cosmetic ingredients page.
  if (window.location.hash === '#flow-chem') {
    window.location.replace('/cosmetic-ingredients.html#flow-chem');
    return;
  }
  apply();
})();
