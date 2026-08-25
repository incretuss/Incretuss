// compare.html only: renders the products named in ?p=slug1,slug2,... side
// by side, using the same data/products.json every other product feature
// reads from.
(function () {
  var store = window.ProductStore;
  var grid = document.getElementById('compareGrid');
  var empty = document.getElementById('compareEmpty');
  var countEl = document.getElementById('compareCount');
  var clearBtn = document.getElementById('compareClear');
  if (!store || !grid) return;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function rows(p) {
    return [
      ['Latin name', p.latin],
      ['Part used', p.part],
      ['Available forms', p.forms.join(', ')],
      ['Marker compounds', p.markers.join(', ')],
      ['Typical grade', p.grade],
      ['Industries', p.industries.join(', ')],
    ];
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      store.selection.clear();
      window.location.href = 'products.html';
    });
  }

  var params = new URLSearchParams(window.location.search);
  var slugs = (params.get('p') || '').split(',').filter(Boolean).slice(0, 4);

  if (slugs.length < 2) {
    empty.classList.add('visible');
    return;
  }

  store.byslugs(slugs).then(function (products) {
    if (products.length < 2) {
      empty.classList.add('visible');
      return;
    }
    grid.style.gridTemplateColumns = 'repeat(' + products.length + ', minmax(220px, 1fr))';
    grid.innerHTML = products
      .map(function (p) {
        return (
          '<div class="compare-col">' +
          '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '">' +
          '<h3><a href="' + p.slug + '.html">' + escapeHtml(p.name) + '</a></h3>' +
          '<span class="lat">' + escapeHtml(p.latin) + '</span>' +
          rows(p)
            .map(function (r) {
              return '<div class="compare-row"><span class="cr-label">' + escapeHtml(r[0]) + '</span><span class="cr-value">' + escapeHtml(r[1]) + '</span></div>';
            })
            .join('') +
          '<a class="btn btn-ghost" style="margin-top:16px;" href="contact.html?product=' + encodeURIComponent(p.name) + '&need=quote">Request a Quote</a>' +
          '</div>'
        );
      })
      .join('');
    if (countEl) countEl.textContent = products.length + ' products compared';
  });
})();
