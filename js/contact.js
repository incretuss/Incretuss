// contact.html only.
//
// 1. Pre-fills the form from ?product=&form=&need= (product pages' request
//    links) or ?shortlist=slug1,slug2 (the compare/shortlist tray).
// 2. Shows a small destination note from /api/geo (Netlify Edge Function).
// 3. Submits to /api/contact -> netlify/functions/contact.js.
(function () {
  var form = document.getElementById('contactForm');
  if (!form) return;
  var select = document.getElementById('product');
  var message = document.getElementById('message');

  var NEED_LABEL = {
    quote: 'a quote',
    brochure: 'the product brochure',
    tds: 'the Technical Data Sheet',
    sds: 'the Safety Data Sheet',
    coa: 'a Certificate of Analysis',
  };

  function selectByText(text) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].text === text) { select.selectedIndex = i; return true; }
    }
    return false;
  }

  var params = new URLSearchParams(window.location.search);
  var product = params.get('product');
  var shortlist = params.get('shortlist');
  if (product) {
    if (!selectByText(product)) selectByText('Custom / Not listed');
    if (!message.value) {
      var formName = params.get('form');
      message.value = 'Requesting ' + (NEED_LABEL[params.get('need')] || 'information') + ' — ' + product +
        (formName ? ' (' + formName + ')' : '') + '.\n\n';
    }
  } else if (shortlist && window.ProductStore) {
    window.ProductStore.byslugs(shortlist.split(',').filter(Boolean)).then(function (list) {
      if (!list.length) return;
      if (list.length === 1) selectByText(list[0].name); else selectByText('Custom / Not listed');
      if (!message.value) {
        message.value = 'Interested in:\n' + list.map(function (p) { return '- ' + p.name; }).join('\n') + '\n\n';
      }
    });
  }

  var note = document.getElementById('geoNote');
  if (note) {
    fetch('/api/geo')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.country) return;
        note.textContent = 'Shipping to ' + data.country + '? We will confirm export documentation and shipping options for your destination.';
        note.hidden = false;
      })
      .catch(function () { /* no geo data (e.g. local preview) — note stays hidden */ });
  }

  var submitBtn = document.getElementById('contactSubmit');
  var status = document.getElementById('contactStatus');

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' is-' + kind : '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var data = {
      name: form.name.value.trim(),
      company: form.company.value.trim(),
      email: form.email.value.trim(),
      product: form.product.value,
      message: form.message.value.trim(),
      website: form.website.value,
    };
    submitBtn.disabled = true;
    setStatus('Sending…');
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok && body.ok, error: body.error }; });
      })
      .then(function (result) {
        if (result.ok) {
          setStatus('Thank you — your inquiry has been sent. Our team will reply by email.', 'ok');
          form.reset();
        } else {
          setStatus(result.error || 'Something went wrong. Please try again or email info@incretuss.com.', 'error');
        }
      })
      .catch(function () {
        setStatus('Could not reach the server. Please try again or email info@incretuss.com.', 'error');
      })
      .finally(function () { submitBtn.disabled = false; });
  });
})();
