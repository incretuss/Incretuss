const header = document.querySelector(".site-header");
const progress = document.querySelector(".scroll-progress span");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");

function updateScrollUI() {
  const scrollTop = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${max > 0 ? (scrollTop / max) * 100 : 0}%`;
  header.classList.toggle("scrolled", scrollTop > 30);
}
window.addEventListener("scroll", updateScrollUI, { passive: true });
updateScrollUI();

menuToggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  document.body.classList.toggle("nav-open", open);
  menuToggle.setAttribute("aria-expanded", open);
});

document.querySelectorAll(".nav a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    document.body.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

// Reveal sections as they enter the viewport.
// threshold is a fraction of the element's own height, not the viewport's — a
// tall element (e.g. the portfolio table stacked on a narrow screen) can need
// more visible height than a phone's viewport ever provides, so the ratio
// never reaches 0.12 and it never reveals. threshold: 0 fires on any visible
// pixel instead, independent of how tall the element is.
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0, rootMargin: "0px 0px -10% 0px" });

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

// Active navigation item.
const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll(".nav a")];

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => link.classList.toggle(
      "active",
      link.getAttribute("href") === `#${entry.target.id}`
    ));
  });
}, { rootMargin: "-35% 0px -55% 0px" });

sections.forEach(section => sectionObserver.observe(section));

// Portfolio search + extraction filter.
const rows = [...document.querySelectorAll("#portfolioBody tr")];
const filters = [...document.querySelectorAll(".filter")];
const search = document.querySelector("#portfolioSearch");
const noResults = document.querySelector("#noResults");
let activeFilter = "all";

function filterPortfolio() {
  const query = search.value.trim().toLowerCase();
  let visible = 0;

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    const extraction = row.dataset.extraction || "";
    const matchesSearch = !query || text.includes(query);
    const matchesFilter =
      activeFilter === "all" || extraction.includes(activeFilter);

    const show = matchesSearch && matchesFilter;
    row.classList.toggle("hidden", !show);
    if (show) visible++;
  });

  noResults.style.display = visible ? "none" : "block";
}

search.addEventListener("input", filterPortfolio);

filters.forEach(button => {
  button.addEventListener("click", () => {
    filters.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    filterPortfolio();
  });
});

// Segment chips: lightweight visual interaction.
document.querySelectorAll(".segment-pill").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segment-pill").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
  });
});
