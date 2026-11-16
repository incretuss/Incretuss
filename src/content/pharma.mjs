// Copy and structure for the Pharma section (/pharma/…).
//
// Products are NOT listed here: every product page, count and filter is
// generated from data/pharma-catalogue.csv (see src/lib/pharma.mjs). To
// update the range, replace that file and run "npm run build".
//
// `name` must match the `category` column of the CSV exactly.
export const PHARMA_CATEGORIES = [
  {
    slug: 'active-pharmaceutical-ingredients',
    name: 'Active Pharmaceutical Ingredients',
    short: 'APIs',
    intro:
      'Bulk drug substances and intermediates for formulators. Antiretroviral, inhalation, cardiovascular, CNS, oncology and specialty molecules.',
    api: true,
  },
  {
    slug: 'tablets-capsules',
    name: 'Tablets & Capsules',
    intro: 'Finished tablets and capsules, including dispersible, sustained-release and effervescent forms.',
  },
  {
    slug: 'injectables-sterile-products',
    name: 'Injectables & Sterile Products',
    intro: 'Liquid and lyophilised vials, ampoules, pre-filled syringes and dental cartridges.',
  },
  {
    slug: 'inhalers-nasal-products',
    name: 'Inhalers & Nasal Products',
    intro: 'Metered-dose inhalers, inhalation solutions, nasal sprays and drops.',
  },
  {
    slug: 'eye-ear-care',
    name: 'Eye & Ear Care',
    intro: 'Sterile eye drops, eye ointments and ear drops.',
  },
  {
    slug: 'syrups-suspensions-sachets',
    name: 'Syrups, Suspensions & Sachets',
    intro: 'Syrups, dry syrups, oral drops, granules and oral jellies.',
  },
  {
    slug: 'creams-ointments-solutions',
    name: 'Creams, Ointments & Solutions',
    intro: 'Dermatological creams, gels, ointments, antiseptic and topical solutions.',
  },
  {
    slug: 'suppositories-pessaries',
    name: 'Suppositories & Pessaries',
    intro: 'Rectal and vaginal dosage forms.',
  },
  {
    slug: 'veterinary',
    name: 'Veterinary',
    intro: 'Intramammary suspensions and livestock products.',
  },
  {
    slug: 'partnering',
    name: 'Partnering & Licensing',
    intro: 'Regulated-market generics for licensing, dossier supply or technology transfer.',
    partnering: true,
  },
];

export const DOCS = {
  finished: 'COA, specifications, COPP and CTD dossier available on request',
  api: 'COA, specifications and DMF available on request',
  intermediate: 'COA and specifications available on request',
};

export const PATENT_NOTE =
  'Supplied only to markets where no valid patent or regulatory exclusivity applies. Availability is confirmed per destination country.';

// Shown in the footer of every /pharma page.
export const COMPLIANCE =
  'Products listed are available for business-to-business supply to licensed pharmaceutical companies, distributors and government buyers only. Product availability depends on registration and patent status in the destination country. Information on this site is not medical advice and does not promote any product to patients.';

export const LICENCE_CONFIRM =
  'I confirm we hold the licence required to import or distribute pharmaceutical products in our country.';

export const HOW_WE_WORK = [
  ['Send your requirement', 'Molecule or product, dosage form and strength, quantity and destination market.'],
  ['We share specs, COA and dossier status', 'Specifications, a recent Certificate of Analysis and the registration documents available for your market.'],
  ['Quote and supply', 'A quotation for the confirmed product and market, then supply against your order.'],
];

export const PARTNERING = {
  options: [
    ['Licensing', 'Out-licensing of generic products registered in regulated markets, for distribution under your own marketing authorisation.'],
    ['Dossier supply', 'CTD-format dossiers for your own registration, with the technical data the dossier references.'],
    ['Technology transfer', 'Transfer of a product’s manufacturing process and analytical methods to your site.'],
  ],
  steps: [
    'Tell us the molecule, dosage form and target markets.',
    'We confirm what is available for licensing, dossier supply or transfer, under a confidentiality agreement where needed.',
    'We agree the technical package and commercial terms.',
  ],
};

// Prefilled "Product" value when the enquiry form is opened from the
// Partnering & Licensing page.
export const PARTNERING_ENQUIRY = 'Partnering & Licensing';
