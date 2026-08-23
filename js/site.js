// Shared site behavior: mobile nav toggle + scroll-reveal animations.
// Loaded on every page via <script src="js/site.js" defer></script>.
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
})();

(function () {
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add('in');
      });
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll('.reveal').forEach(function (el) {
    io.observe(el);
  });
})();
