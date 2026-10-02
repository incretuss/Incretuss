import { readFileSync } from 'node:fs';
import { CATEGORIES, GROUP_LABELS } from '../content/site.mjs';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

// Compound entries have no forms/markers/industries; default them so the
// helpers below can treat every entry the same way.
export const PRODUCTS = read('data/products.json').map((p) => ({
  forms: [],
  markers: [],
  industries: [],
  listings: [],
  ...p,
}));
const CONTENT = read('src/content/botanicals.json');

export const isCompound = (p) => p.category === 'cosmetics';

// Botanical pages keep their existing URLs (ginger.html, …); compounds get
// one static page each (acetophenone.html, …).
export const url = (p) => p.slug + '.html';

export const content = (p) => CONTENT[p.slug] || {};

export const category = (key) => CATEGORIES.find((c) => c.key === key);

export const inCategory = (key) => PRODUCTS.filter((p) => p.category === key);

export const counts = Object.fromEntries(CATEGORIES.map((c) => [c.key, inCategory(c.key).length]));

export const groupLabel = (g) => GROUP_LABELS[g] || g;

// The source sheet capitalises opportunity terms inconsistently
// ("Intermediate, Flavor, fragrance"); display them in sentence case.
export function sentenceCase(list) {
  let first = true;
  return list.replace(/[^,;]+/g, (term) => {
    const lead = term.match(/^\s*/)[0];
    let t = term.trim();
    t = first ? t.charAt(0).toUpperCase() + t.slice(1) : t.charAt(0).toLowerCase() + t.slice(1);
    first = false;
    return lead + t;
  });
}

// Compound listing groups in source-sheet order: [{group, label, items:[{p, listing}]}]
export function compoundGroups() {
  const order = [];
  const byGroup = {};
  inCategory('cosmetics').forEach((p) => {
    p.listings.forEach((l) => {
      if (!byGroup[l.group]) {
        byGroup[l.group] = [];
        order.push(l.group);
      }
      byGroup[l.group].push({ p, listing: l });
    });
  });
  return order.map((g) => ({ group: g, label: groupLabel(g), items: byGroup[g] }));
}

// Individual opportunity terms across a compound's listings, de-duplicated.
export function opportunities(p) {
  const seen = new Set();
  const out = [];
  (p.listings || []).forEach((l) =>
    l.opportunity.split(/[,;]/).forEach((t) => {
      t = t.trim();
      if (!t || seen.has(t.toLowerCase())) return;
      seen.add(t.toLowerCase());
      out.push(t.charAt(0).toUpperCase() + t.slice(1));
    })
  );
  return out;
}

// Related products: shared industries weigh most, then forms/markers.
// Compounds relate to compounds in the same listing group.
export function related(p, limit = 4) {
  if (isCompound(p)) {
    const groups = p.listings.map((l) => l.group);
    return inCategory('cosmetics')
      .filter((q) => q.slug !== p.slug && q.listings.some((l) => groups.includes(l.group)))
      .slice(0, limit);
  }
  const named = (content(p).relatedNote || '').match(/href="([a-z0-9-]+)\.html"/g) || [];
  const pinned = named.map((h) => h.slice(6, -6));
  return PRODUCTS.filter((q) => q.slug !== p.slug && !isCompound(q))
    .map((q) => {
      let score = pinned.includes(q.slug) ? 10 : 0;
      q.industries.forEach((i) => p.industries.includes(i) && (score += 2));
      q.forms.forEach((f) => p.forms.includes(f) && (score += 1));
      if (q.category === p.category) score += 1;
      return { q, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.q);
}

// ---------- Applications (sectors), derived from the catalogue ----------
// Each product's application notes start with a bold label
// ("<b>Food &amp; flavor</b> — …"); map those labels onto sectors so the
// Applications page quotes the product's own copy.
const LABEL_TO_SECTOR = {
  Nutraceuticals: 'nutraceuticals',
  'Sports nutrition': 'nutraceuticals',
  'Sports &amp; student nutrition': 'nutraceuticals',
  'Weight management supplements': 'nutraceuticals',
  'Antioxidant supplements': 'nutraceuticals',
  'Food &amp; beverage': 'food',
  'Food &amp; flavor': 'food',
  'Functional beverages': 'food',
  Cosmetics: 'cosmetics',
  Fragrance: 'fragrance',
  'Aromatherapy &amp; fragrance': 'fragrance',
};

export const SECTORS = [
  {
    key: 'nutraceuticals',
    name: 'Nutraceuticals & dietary supplements',
    lede: 'Standardized extracts specified by marker compound, for capsule, tablet, powder and softgel formats.',
    industries: ['Nutraceuticals'],
  },
  {
    key: 'food',
    name: 'Food, beverage & functional foods',
    lede: 'Oleoresins, CO₂ extracts and essential oils for consistent flavor and color; functional extracts for fortified foods and drinks.',
    industries: ['Food', 'Beverages', 'Functional Foods'],
  },
  {
    key: 'pharmaceuticals',
    name: 'Pharmaceuticals',
    lede: 'Botanical extracts used in pharmaceutical formulation, and acetophenones used as pharmaceutical intermediates.',
    industries: ['Pharmaceuticals'],
    terms: ['pharmaceutical intermediate'],
  },
  {
    key: 'cosmetics',
    name: 'Cosmetics & personal care',
    lede: 'Botanical extracts and oils used in skincare formulation.',
    industries: ['Cosmetics'],
  },
  {
    key: 'fragrance',
    name: 'Fragrance & flavor',
    lede: 'Aliphatic ketones and acetophenones used as aroma chemicals, alongside spice essential oils.',
    terms: ['fragrance', 'flavor', 'flavor chemistry'],
  },
  {
    key: 'specialty',
    name: 'Specialty chemicals & synthesis',
    lede: 'Ketones and acetophenones used as solvents, intermediates and building blocks in organic synthesis and agrochemicals.',
    terms: ['specialty chemicals', 'solvent', 'intermediate', 'agrochem', 'agrochemical intermediate', 'organic synthesis', 'fine chemicals', 'heterocycle'],
  },
];

function appNotes(p, sectorKey) {
  return (content(p).applications || []).filter((a) => {
    const m = a.match(/^<b>(.*?)<\/b>/);
    return m && LABEL_TO_SECTOR[m[1]] === sectorKey;
  });
}

export function sectorProducts(sector) {
  return PRODUCTS.map((p) => {
    let match = false;
    if (sector.industries && p.industries.some((i) => sector.industries.includes(i))) match = true;
    if (sector.terms && isCompound(p)) {
      const ops = opportunities(p).map((o) => o.toLowerCase());
      if (ops.some((o) => sector.terms.includes(o))) match = true;
    }
    const notes = isCompound(p) ? [] : appNotes(p, sector.key);
    if (notes.length) match = true;
    return match ? { p, notes } : null;
  }).filter(Boolean);
}
