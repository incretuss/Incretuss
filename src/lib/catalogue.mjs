import { readFileSync } from 'node:fs';
import { CATEGORIES, COMPOUND_GROUPS } from '../content/site.mjs';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

// Compound entries have no forms/markers/industries, and botanicals have no
// applications; default them so the helpers below can treat every entry
// the same way.
export const PRODUCTS = read('data/products.json').map((p) => ({
  forms: [],
  markers: [],
  industries: [],
  applications: [],
  ...p,
}));
const CONTENT = read('src/content/botanicals.json');

// Aroma Chemicals & Specialty Ketones: single compounds identified by CAS
// number rather than by botanical source.
export const AROMA = 'aroma-chemicals';
export const isCompound = (p) => p.category === AROMA;

// Botanical pages keep their existing URLs (ginger.html, …); compounds get
// one static page each (acetophenone.html, …).
export const url = (p) => p.slug + '.html';

export const content = (p) => CONTENT[p.slug] || {};

export const category = (key) => CATEGORIES.find((c) => c.key === key);

export const inCategory = (key) => PRODUCTS.filter((p) => p.category === key);

export const counts = Object.fromEntries(CATEGORIES.map((c) => [c.key, inCategory(c.key).length]));

export const groupOf = (p) => COMPOUND_GROUPS.find((g) => g.key === p.group);

// CAS number to display, or null when it is missing or still being
// confirmed (casUnverified in data/products.json).
export const shownCas = (p) => (p.cas && !p.casUnverified ? p.cas : null);
export const casText = (p) => shownCas(p) || 'On request';

// Compounds grouped by chemical structure, in COMPOUND_GROUPS order:
// [{key, label, family, items:[p]}]
export function compoundGroups(filter = () => true) {
  return COMPOUND_GROUPS.map((g) => ({
    ...g,
    items: inCategory(AROMA).filter((p) => p.group === g.key && filter(p)),
  })).filter((g) => g.items.length);
}

// Compounds documented for fragrance use (a subset of "Flavor & fragrance").
export const isFragranceMaterial = (p) => p.applications.includes('Flavor & fragrance');

// Related products: shared industries weigh most, then forms/markers.
// Compounds relate to compounds in the same structural group.
export function related(p, limit = 4) {
  if (isCompound(p)) {
    return inCategory(AROMA)
      .filter((q) => q.slug !== p.slug && q.group === p.group)
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
// ("<b>Food &amp; flavor</b>: …"); map those labels onto sectors so the
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
    applications: ['Pharmaceutical intermediate'],
  },
  {
    key: 'cosmetics',
    name: 'Cosmetics & personal care',
    lede: 'Botanical extracts and essential oils used in skin-care, hair-care and personal-care formulation.',
    industries: ['Cosmetics'],
  },
  {
    key: 'fragrance',
    name: 'Fragrance & flavor',
    lede: 'Botanical essential oils such as lavender and rosemary, alongside aliphatic and aromatic ketones used as aroma chemicals.',
    industries: ['Fragrance'],
    applications: ['Flavor & fragrance', 'Flavor'],
  },
  {
    key: 'specialty',
    name: 'Specialty chemicals & synthesis',
    lede: 'Ketones used as solvents and as intermediates in pharmaceutical, agrochemical and fine-chemical synthesis.',
    applications: ['Solvent', 'Synthesis intermediate', 'Agrochemical intermediate'],
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
    if (sector.applications && p.applications.some((a) => sector.applications.includes(a))) match = true;
    const notes = isCompound(p) ? [] : appNotes(p, sector.key);
    if (notes.length) match = true;
    return match ? { p, notes } : null;
  }).filter(Boolean);
}
