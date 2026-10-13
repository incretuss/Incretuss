// Company facts used across every page. Everything here comes from the
// existing site; do not add claims (certifications, years, capacities)
// that the company has not confirmed.
export const SITE = {
  name: 'Incretuss',
  legalName: 'Incretuss Private Limited',
  url: 'https://incretuss.com',
  email: 'info@incretuss.com',
  phone: '+91 89716 97115',
  phoneHref: '+918971697115',
  phoneSchema: '+91-89716-97115',
  hours: 'Mon–Fri, 9:00–18:00 IST',
  address: {
    lines: ['WeWork Mahogany, F2 Block', 'Manyata Business Park', 'Bengaluru 560045, Karnataka, India'],
    street: 'WeWork Mahogany, F2 Block, Manyata Business Park',
    locality: 'Bengaluru',
    region: 'Karnataka',
    postalCode: '560045',
    country: 'IN',
  },
  ogImage: 'https://incretuss.com/images/og-image.png',
  description:
    'Incretuss Private Limited supplies botanical extracts, nutraceutical ingredients and aroma chemicals (extracts, oleoresins, essential oils and specialty ketones) to manufacturers in bulk.',
};

// The three catalogue categories. `key` matches `category` in
// data/products.json; `anchor` is the section id on products.html (kept
// from the previous site so existing #links keep working).
export const CATEGORIES = [
  {
    key: 'botanical-extracts',
    anchor: 'botanical-extracts',
    page: 'botanical-extracts.html',
    index: '01',
    name: 'Botanical Extracts',
    short: 'Botanical Extracts',
    tone: 'botanical',
    lede: 'Spice and aromatic botanicals supplied as extracts, oleoresins, CO₂ extracts and essential oils.',
    intro:
      'Spice and aromatic botanicals (ginger, turmeric, pepper, cinnamon, nutmeg, green tea, lavender and rosemary) supplied as standardized extracts, oleoresins, CO₂ extracts and essential oils for food, beverage, nutraceutical, pharmaceutical, cosmetic and fragrance use.',
  },
  {
    key: 'nutraceuticals',
    anchor: 'nutraceuticals',
    page: 'nutraceutical-ingredients.html',
    index: '02',
    name: 'Nutraceutical Ingredients',
    short: 'Nutraceuticals',
    tone: 'nutra',
    lede: 'Standardized botanical actives for supplement and functional-food formulations.',
    intro:
      'Standardized botanical actives for supplement and functional-food manufacturers, each extract specified by its marker compound, from withanolides and bacosides to hydroxycitric acid and chlorogenic acid.',
  },
  {
    // Formerly "Cosmetic Ingredients" (cosmetic-ingredients.html, which now
    // redirects here). These are aroma chemicals, solvents and synthesis
    // intermediates; cosmetic suitability is not claimed for any of them.
    key: 'aroma-chemicals',
    anchor: 'aroma-chemicals',
    page: 'aroma-chemicals.html',
    index: '03',
    name: 'Aroma Chemicals & Specialty Ketones',
    short: 'Aroma Chemicals',
    tone: 'cosmetic',
    lede: 'Aliphatic and aromatic ketones for fragrance and flavor formulation, and as solvents and synthesis intermediates.',
    intro:
      'Aliphatic and aromatic ketones supplied as aroma chemicals for fragrance and flavor formulation, and as solvents and intermediates for chemical synthesis. Each compound is listed by CAS number; grade, purity and regulatory documentation are confirmed per order.',
  },
];

// Groups within Aroma Chemicals & Specialty Ketones, by chemical structure.
// `group` on each compound in data/products.json is one of these keys.
export const COMPOUND_GROUPS = [
  { key: 'methyl', label: 'Methyl ketones', family: 'Aliphatic ketones' },
  { key: 'ethyl', label: 'Ethyl ketones', family: 'Aliphatic ketones' },
  { key: 'symmetric', label: 'Symmetric dialkyl ketones', family: 'Aliphatic ketones' },
  { key: 'aryl', label: 'Acetophenone and related aryl ketones', family: 'Aromatic ketones' },
];

export const NAV = [
  { href: 'products.html', label: 'Products', key: 'products', menu: true },
  { href: 'applications.html', label: 'Applications', key: 'applications' },
  { href: 'quality.html', label: 'Quality & Manufacturing', key: 'quality' },
  { href: 'about.html', label: 'About', key: 'about' },
  { href: 'contact.html', label: 'Contact', key: 'contact' },
];

// Flow / vapour-phase chemistry capability statement (from the original
// "Flow Chem Advantages" content). Quoted text kept verbatim. Shown on the
// Quality page as a general capability; it is not presented as the
// manufacturing route for any particular product.
export const FLOW_CHEM = {
  quote: 'flow processes can produce higher yields, and be safer, cleaner and cheaper to set up and operate',
  vapour:
    'Vapour phase chemistry is especially suited for hazardous, exothermic, and high-temperature processes, offering better reaction control, faster kinetics, and minimized solvent usage, aligning with both economic and environmental goals.',
  infrastructure: [
    ['High-pressure operations', 'up to 50 bar'],
    ['High-temperature reactions', 'up to 600 °C'],
    ['Flexible reactor configurations', 'for rapid scale-up from pilot to commercial scale'],
  ],
  reactions: [
    'Alcohol → aldehyde / ketone',
    'Ammoxidation',
    'Dehydrogenation',
    'Hydrogenation',
    'Decarboxylation / decarbonylation',
  ],
};

// Manufacturing stages and quality practices, as described on the
// previous site.
export const PROCESS = [
  ['Procurement', 'Raw material sourced and checked against specification before processing.'],
  ['Extraction', 'Solvent, CO₂ or steam-distillation route chosen for the product and target fraction.'],
  ['Filtration', 'Removal of plant solids from the extract.'],
  ['Concentration', 'Solvent recovery and concentration of the extract.'],
  ['Drying', 'Conversion to the required physical form where applicable.'],
  ['Standardization', 'Adjusted to the specified marker-compound content.'],
  ['Packaging', 'Packed and labelled per order, with batch documentation.'],
];

export const QUALITY = [
  ['Batch traceability', 'Every batch is traceable from raw material through to the finished product.'],
  ['Raw material testing', 'Incoming botanical material is tested before it enters production.'],
  ['Finished goods testing', 'Batch-level checks before anything is cleared to ship.'],
  ['Documentation', 'Certificate of Analysis per batch; specification sheet, TDS and SDS on request.'],
];
