// compare.html only: renders the products named in ?p=slug1,slug2,... side
// by side from data/products.json.
(function () {
  var store = window.ProductStore;
  var table = document.getElementById('compareTable');
  var empty = document.getElementById('compareEmpty');
  var countEl = document.getElementById('compareCount');
  var clearBtn = document.getElementById('compareClear');
  if (!store || !table) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var ROWS = [
    ['Category', function (p) { return store.categoryName(p); }],
    ['Botanical name / CAS', function (p) { return store.subtitle(p); }],
    ['Part used', function (p) { return p.part; }],
    ['Available forms', function (p) { return p.forms.join(', '); }],
    ['Marker compounds', function (p) { return p.markers.join(', '); }],
    ['Typical grade', function (p) { return p.grade; }],
    ['Industries', function (p) { return p.industries.join(', '); }],
    ['Class', function (p) { return p.listings.map(function (l) { return l.group; }).join('; '); }],
    ['Main applications', function (p) { return p.listings.map(function (l) { return l.opportunity; }).join('; '); }],
  ];

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      store.selection.clear();
      window.location.href = '/products.html';
    });
  }

  var params = new URLSearchParams(window.location.search);
  var slugs = (params.get('p') || '').split(',').filter(Boolean).slice(0, 4);

  function showEmpty() {
    empty.hidden = false;
    if (countEl) countEl.textContent = '';
  }
  if (slugs.length < 2) return showEmpty();

  store.byslugs(slugs).then(function (products) {
    if (products.length < 2) return showEmpty();
    var head =
      '<thead><tr><th scope="col"><span class="sr-only">Property</span></th>' +
      products.map(function (p) {
        return '<th scope="col">' +
          (p.image ? '<img src="/' + esc(p.image) + '" alt="" width="140" height="97">' : '') +
          '<a href="/' + esc(store.url(p)) + '">' + esc(p.name) + '</a>' +
          '<span><a class="link-arrow" href="/contact.html?product=' + encodeURIComponent(p.name) + '&amp;need=quote">Request a quote</a></span>' +
          '</th>';
      }).join('') +
      '</tr></thead>';
    var body = ROWS.filter(function (r) {
      return products.some(function (p) { return r[1](p); });
    }).map(function (r) {
      return '<tr><th scope="row">' + esc(r[0]) + '</th>' +
        products.map(function (p) { return '<td>' + (esc(r[1](p)) || '—') + '</td>'; }).join('') +
        '</tr>';
    }).join('');
    table.innerHTML = head + '<tbody>' + body + '</tbody>';
    table.hidden = false;
    if (countEl) countEl.textContent = products.length + ' products compared';
  });
})();
