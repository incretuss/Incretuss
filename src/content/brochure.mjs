// Brochure-only content (brochure.html). The switchable settings — which
// section opens first and the event name — live in data/brochure.json so
// they can be changed without touching code; see README.md.

// Section keys as used in data/brochure.json and ?section= links, mapped to
// catalogue categories. Several spellings are accepted for convenience.
export const SECTION_ALIASES = {
  botanicals: 'botanical-extracts',
  botanical: 'botanical-extracts',
  'botanical-extracts': 'botanical-extracts',
  nutraceuticals: 'nutraceuticals',
  nutraceutical: 'nutraceuticals',
  nutra: 'nutraceuticals',
  cosmetics: 'cosmetics',
  cosmetic: 'cosmetics',
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
