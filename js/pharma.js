// Pharma section (/pharma/…) only.
//
// 1. Category pages: therapeutic-area chips, search-as-you-type by product
//    name, and "show more" paging (50 at a time). Without JS every product
//    is listed.
// 2. Mobile: the area chips open in a drawer.
// 3. Enquiry: "Request a Quote" links open the shared form in a dialog with
//    the product prefilled (or go to /pharma/enquiry/?product=… without
//    dialog support). Submits to /api/contact with type "pharma".
(function () {
  /* ---------- 1. Category catalogue ---------- */
  var cat = document.querySelector('[data-catalogue]');
  if (cat) {
    var perPage = parseInt(cat.getAttribute('data-per-page'), 10) || 50;
    var rows = Array.prototype.slice.call(cat.querySelectorAll('.ph-row'));
    var groups = Array.prototype.slice.call(cat.querySelectorAll('.ph-group'));
    var chips = Array.prototype.slice.call(cat.querySelectorAll('.ph-chip'));
    var input = document.getElementById('ph-q');
    var more = document.getElementById('ph-more');
    var results = document.getElementById('ph-results');
    var empty = document.getElementById('ph-empty');
    var current = cat.querySelector('.ph-filter-current');
    var params = new URLSearchParams(window.location.search);
    var state = { area: params.get('area') || '', q: '', limit: perPage };
    if (!chips.some(function (c) { return c.getAttribute('data-area') === state.area; })) state.area = '';

    var apply = function () {
      var q = state.q.toLowerCase();
      var matched = 0;
      var shown = 0;
      rows.forEach(function (r) {
        var ok = (!state.area || r.getAttribute('data-area') === state.area) &&
          (!q || r.getAttribute('data-name').indexOf(q) !== -1);
        if (ok) matched++;
        var show = ok && shown < state.limit;
        if (show) shown++;
        r.hidden = !show;
      });
      groups.forEach(function (g) {
        g.hidden = !g.querySelector('.ph-row:not([hidden])');
      });
      var label = '';
      chips.forEach(function (c) {
        var on = c.getAttribute('data-area') === state.area;
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && state.area) label = c.firstChild.textContent.trim();
      });
      if (current) current.textContent = label;
      results.textContent = matched
        ? 'Showing ' + shown + ' of ' + matched + (matched === 1 ? ' product' : ' products') + (label ? ' in ' + label : '') + (q ? ' matching “' + state.q + '”' : '') + '.'
        : '';
      empty.hidden = matched > 0;
      var left = matched - shown;
      more.hidden = left <= 0;
      if (left > 0) more.textContent = 'Show ' + Math.min(left, perPage) + ' More Products';
    };

    var syncUrl = function () {
      var url = new URL(window.location.href);
      if (state.area) url.searchParams.set('area', state.area); else url.searchParams.delete('area');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    };

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        state.area = c.getAttribute('data-area');
        state.limit = perPage;
        syncUrl();
        apply();
        setDrawer(false);
      });
    });

    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = input.value.trim();
        state.limit = perPage;
        apply();
      }, 60);
    });

    more.addEventListener('click', function () {
      var firstHidden = rows.filter(function (r) { return r.hidden; })[0];
      state.limit += perPage;
      apply();
      // Move focus to the first newly shown product for keyboard users.
      if (firstHidden && !firstHidden.hidden) firstHidden.querySelector('a').focus({ preventScroll: true });
    });

    var reset = cat.querySelector('[data-reset]');
    if (reset) reset.addEventListener('click', function () {
      input.value = '';
      state.q = '';
      state.area = '';
      state.limit = perPage;
      syncUrl();
      apply();
      input.focus();
    });

    /* ---------- 2. Filter drawer (mobile) ---------- */
    var drawer = document.getElementById('ph-filters');
    var openBtn = cat.querySelector('.ph-filter-open');
    var closeBtn = cat.querySelector('.ph-filter-close');
    var mq = window.matchMedia('(max-width: 760px)');
    function setDrawer(open) {
      if (!mq.matches && open) return;
      drawer.classList.toggle('is-open', open);
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('ph-locked', open);
      if (open) (drawer.querySelector('.ph-chip[aria-pressed="true"]') || closeBtn).focus();
      else if (mq.matches && document.activeElement && drawer.contains(document.activeElement)) openBtn.focus();
    }
    openBtn.addEventListener('click', function () { setDrawer(!drawer.classList.contains('is-open')); });
    closeBtn.addEventListener('click', function () { setDrawer(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) setDrawer(false);
    });
    drawer.addEventListener('click', function (e) { if (e.target === drawer) setDrawer(false); });
    mq.addEventListener('change', function () { setDrawer(false); });

    cat.classList.add('is-enhanced');
    apply();
  }

  /* ---------- 3. Enquiry form ---------- */
  var form = document.getElementById('pharmaEnquiry');
  if (!form) return;
  var F = form.elements;
  var dialog = document.getElementById('pharmaDialog');
  var status = document.getElementById('pharmaStatus');
  var submit = document.getElementById('pharmaSubmit');
  var lastTrigger = null;

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' is-' + kind : '');
  }

  // Enquiry page: product from ?product=
  if (!dialog) {
    var p = new URLSearchParams(window.location.search).get('product');
    if (p) F.product.value = p.slice(0, 200);
  }

  if (dialog && typeof dialog.showModal === 'function') {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-enquire]');
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
      e.preventDefault();
      lastTrigger = link;
      var product = link.getAttribute('data-enquire');
      if (product || !F.product.value) F.product.value = product;
      setStatus('');
      dialog.showModal();
      var focusTarget = F.name.value ? (product ? F.strength : F.product) : F.name;
      focusTarget.focus();
    });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog || e.target.closest('[data-close-dialog]')) dialog.close();
    });
    dialog.addEventListener('close', function () {
      if (lastTrigger) lastTrigger.focus();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var data = { type: 'pharma', licence: F.licence.checked, website: F.website.value };
    ['name', 'company', 'country', 'email', 'phone', 'product', 'strength', 'quantity', 'destination', 'message'].forEach(function (k) {
      data[k] = F[k].value.trim();
    });
    submit.disabled = true;
    setStatus('Sending…');
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok && body.ok, error: body.error }; });
      })
      .then(function (r) {
        if (r.ok) {
          setStatus('Thank you. Your enquiry has been sent. Our team will reply by email.', 'ok');
          // Keep contact details for a follow-up enquiry; clear the requirement.
          ['product', 'strength', 'quantity', 'message'].forEach(function (k) { F[k].value = ''; });
        } else {
          setStatus(r.error || 'Something went wrong. Please try again or email info@incretuss.com.', 'error');
        }
      })
      .catch(function () {
        setStatus('Could not reach the server. Please try again or email info@incretuss.com.', 'error');
      })
      .finally(function () { submit.disabled = false; });
  });
})();
