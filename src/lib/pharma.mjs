// Pharma catalogue: reads data/pharma-catalogue.csv (the single source of
// truth for the Pharma section) and derives everything the pages need.
//
// CSV columns: product, category, therapeutic_area, dosage_form, patent_note
import { readFileSync } from 'node:fs';
import { DOCS, PHARMA_CATEGORIES } from '../content/pharma.mjs';

const root = new URL('../../', import.meta.url);
export const CSV_PATH = 'data/pharma-catalogue.csv';

// RFC 4180 parser: quoted fields may contain commas, quotes ("") and newlines.
export function parseCsv(src) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  src = src.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = head.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').trim()])));
}

export function slugify(s, max = 90) {
  let slug = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' ')
    .replace(/%/g, ' pct ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length > max) slug = slug.slice(0, max).replace(/-[^-]*$/, '');
  return slug;
}

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

// ---------- Title wording per dosage form ----------
// [specific wording when it is the only form, base wording when combined]
const FORM_WORDS = {
  'API (bulk drug substance)': ['API', 'API'],
  'Intermediate (for API synthesis)': ['', ''],
  Tablet: ['Tablets', 'Tablets'],
  'Tablet (FC)': ['Tablets', 'Tablets'],
  'Tablet (SR)': ['SR Tablets', 'Tablets'],
  'Tablet (ER)': ['ER Tablets', 'Tablets'],
  'Tablet (CR)': ['CR Tablets', 'Tablets'],
  'Tablet (PR)': ['PR Tablets', 'Tablets'],
  'Tablet (DT)': ['Dispersible Tablets', 'Tablets'],
  'Effervescent Tablet': ['Effervescent Tablets', 'Tablets'],
  Capsule: ['Capsules', 'Capsules'],
  Injection: ['Injection', 'Injection'],
  'Injection (lyophilised)': ['Lyophilised Injection', 'Injection'],
  'Pre-filled syringe': ['Pre-filled Syringe', 'Pre-filled Syringe'],
  'Dental cartridge': ['Dental Cartridge', 'Dental Cartridge'],
  'Eye drops': ['Eye Drops', 'Eye Drops'],
  'Eye ointment': ['Eye Ointment', 'Eye Ointment'],
  'Ear drops': ['Ear Drops', 'Ear Drops'],
  'Syrup / oral liquid': ['Syrup', 'Syrup'],
  'Dry syrup / oral suspension': ['Dry Syrup', 'Dry Syrup'],
  'Oral drops': ['Oral Drops', 'Oral Drops'],
  'Oral solution': ['Oral Solution', 'Oral Solution'],
  'Oral jelly': ['Oral Jelly', 'Oral Jelly'],
  'Granules (sachet)': ['Granules', 'Granules'],
  'Cream / ointment / gel': ['Cream & Ointment', 'Cream & Ointment'],
  Gel: ['Gel', 'Gel'],
  'Topical solution': ['Topical Solution', 'Topical Solution'],
  'Topical spray': ['Topical Spray', 'Topical Spray'],
  Mouthwash: ['Mouthwash', 'Mouthwash'],
  'Inhaler (MDI)': ['Inhaler', 'Inhaler'],
  'Inhalation solution': ['Inhalation Solution', 'Inhalation Solution'],
  'Nasal spray': ['Nasal Spray', 'Nasal Spray'],
  'Nasal drops': ['Nasal Drops', 'Nasal Drops'],
  'Suppository / pessary': ['Suppositories', 'Suppositories'],
  'Veterinary intramammary': ['Intramammary Suspension', 'Intramammary Suspension'],
  'Veterinary injection / liquid': ['Veterinary Injection', 'Veterinary Injection'],
};

export const forms = (p) => p.dosageForm.split(/,\s*/).filter(Boolean);
export const isIntermediate = (p) => forms(p).every((f) => /^Intermediate/i.test(f));

function formWord(p) {
  const list = forms(p);
  const words =
    list.length === 1
      ? [(FORM_WORDS[list[0]] || [list[0]])[0]]
      : [...new Set(list.map((f) => (FORM_WORDS[f] || [f, f])[1]))];
  return words
    .filter((w) => w && !p.name.toLowerCase().includes(w.toLowerCase()))
    .join(' & ');
}

export function documentation(p) {
  if (isIntermediate(p)) return DOCS.intermediate;
  return p.cat.api ? DOCS.api : DOCS.finished;
}

// ---------- Load ----------
const raw = parseCsv(readFileSync(new URL(CSV_PATH, root), 'utf8'));
const catByName = new Map(PHARMA_CATEGORIES.map((c) => [c.name, c]));

const problems = [];
export const PHARMA = raw
  .map((r, i) => {
    const cat = catByName.get(r.category);
    if (!cat || cat.partnering) {
      problems.push(`row ${i + 2}: unknown category "${r.category}"`);
      return null;
    }
    if (!r.product) problems.push(`row ${i + 2}: empty product name`);
    return {
      name: r.product,
      cat,
      area: r.therapeutic_area || 'Other',
      areaSlug: slugify(r.therapeutic_area || 'Other'),
      dosageForm: r.dosage_form,
      patent: /^y(es)?$/i.test(r.patent_note),
      slug: slugify(r.product),
    };
  })
  .filter(Boolean);
if (problems.length) throw new Error(CSV_PATH + ':\n  ' + problems.join('\n  '));

for (const p of PHARMA) {
  p.path = `pharma/${p.cat.slug}/${p.slug}/index.html`;
  p.href = `/pharma/${p.cat.slug}/${p.slug}/`;
  p.titleName = [p.name, formWord(p)].filter(Boolean).join(' ');
}

// Same product twice in one category would collide on its URL.
{
  const seen = new Map();
  for (const p of PHARMA) {
    const k = p.path;
    if (seen.has(k)) throw new Error(`${CSV_PATH}: "${p.name}" and "${seen.get(k).name}" share the URL ${p.href}`);
    seen.set(k, p);
  }
  // Keep every <title> unique: add the category when two pages would match.
  const titles = new Map();
  PHARMA.forEach((p) => titles.set(p.titleName, (titles.get(p.titleName) || 0) + 1));
  PHARMA.forEach((p) => titles.get(p.titleName) > 1 && (p.titleName += ` (${p.cat.name})`));
}

export const pharmaCategory = (slug) => PHARMA_CATEGORIES.find((c) => c.slug === slug);
export const catHref = (c) => `/pharma/${c.slug}/`;

export function inPharmaCategory(c) {
  return PHARMA.filter((p) => p.cat === c).sort(byName);
}

// [{area, slug, items:[p]}], areas alphabetical, products alphabetical.
export function areaGroups(c) {
  const map = new Map();
  for (const p of inPharmaCategory(c)) {
    if (!map.has(p.area)) map.set(p.area, { area: p.area, slug: p.areaSlug, items: [] });
    map.get(p.area).items.push(p);
  }
  return [...map.values()].sort((a, b) => a.area.localeCompare(b.area));
}

// Up to `limit` products from the same therapeutic area: the alphabetical
// neighbours in the same category first, then other categories (skipping
// the same product in another form).
export function relatedPharma(p, limit = 6) {
  const same = inPharmaCategory(p.cat).filter((q) => q.area === p.area);
  const i = same.indexOf(p);
  const around = [...same.slice(i + 1), ...same.slice(0, i)];
  const others = PHARMA.filter((q) => q.cat !== p.cat && q.area === p.area && q.name !== p.name).sort(byName);
  return [...around, ...others].slice(0, limit);
}

export const pharmaCounts = Object.fromEntries(PHARMA_CATEGORIES.map((c) => [c.slug, PHARMA.filter((p) => p.cat === c).length]));
