// Brochure-only content (brochure.html). The switchable settings (which
// section opens first and the event name) live in data/brochure.json so
// they can be changed without touching code; see README.md.

// Brochure tabs, in order. The first three are the catalogue categories;
// "cosmetics" is a view across them for cosmetics and personal-care events.
// `key` is what data/brochure.json "defaultSection" and ?section= links use.
export const SECTIONS = [
  { key: 'botanicals', category: 'botanical-extracts' },
  { key: 'nutraceuticals', category: 'nutraceuticals' },
  { key: 'aroma', category: 'aroma-chemicals' },
  {
    key: 'cosmetics',
    name: 'Cosmetics & Personal Care',
    tone: 'botanical',
    intro:
      'Products from our range used in skin-care, hair-care and fragrance work: botanical extracts and essential oils, and aroma chemicals supplied as fragrance materials. Suitability for a specific cosmetic formulation, including IFRA and local regulatory requirements, is confirmed per order.',
  },
];

// Accepted spellings for defaultSection and ?section= (keep in step with
// ALIASES in js/brochure.js).
export const SECTION_ALIASES = {
  botanicals: 'botanicals',
  botanical: 'botanicals',
  'botanical-extracts': 'botanicals',
  nutraceuticals: 'nutraceuticals',
  nutraceutical: 'nutraceuticals',
  nutra: 'nutraceuticals',
  aroma: 'aroma',
  'aroma-chemicals': 'aroma',
  chemicals: 'aroma',
  ketones: 'aroma',
  cosmetics: 'cosmetics',
  cosmetic: 'cosmetics',
  'personal-care': 'cosmetics',
};

// Extraction route per botanical, from the previous printed brochure.
// Green tea and bacopa were marked "under final confirmation" there, so
// they are left out until confirmed.
export const EXTRACTION = {
  ginger: 'CO₂ · Solvent',
  pepper: 'CO₂',
  turmeric: 'CO₂ · Solvent',
  cinnamon: 'CO₂',
  'garcinia-cambogia': 'Solvent · H₂O',
  'boswellia-serrata': 'CO₂ · Solvent',
  nutmeg: 'CO₂',
  'green-coffee': 'Solvent',
  ashwagandha: 'Solvent',
  tulsi: 'Solvent',
};

export const ROUTES = [
  [
    'CO₂ supercritical extraction',
    'Solvent-free, low-temperature extraction that preserves volatile actives and leaves no residual solvent.',
  ],
  [
    'Solvent & H₂O extraction',
    'Used for water-soluble and standardized actives, with defined purity and percentage grades to specification.',
  ],
];
