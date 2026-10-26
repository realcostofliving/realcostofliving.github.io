// Canonical country list for the explorer.
// `id` is the ISO 3166-1 alpha-2 code (with XK for Kosovo, as used by Eurostat and the EU).
// Source-specific codes are mapped here once so every dataset joins on the same key:
//   eurostat: Eurostat geo code (EL for Greece, UK for the United Kingdom)
//   iso3:     World Bank / OECD code (XKX for Kosovo in the World Bank API)
//   ne:       Natural Earth ADM0_A3 code used to join boundaries to data
//
// Regions follow the UN M49 geoscheme for Europe, with two documented exceptions:
//   - Türkiye is classified by UN M49 as Western Asia. It is an EU candidate country
//     covered by Eurostat, so we include it and place it in Southern Europe.
//   - Cyprus is UN M49 Western Asia; as an EU member state we place it in Southern Europe.
// The "Western Balkans" group follows the EU definition (the six enlargement countries).

export const REGIONS = [
  { id: 'ALL', label: 'All European countries' },
  { id: 'EU', label: 'European Union (27 countries)' },
  { id: 'WB', label: 'Western Balkans' },
  { id: 'N', label: 'Northern Europe' },
  { id: 'W', label: 'Western Europe' },
  { id: 'S', label: 'Southern Europe' },
  { id: 'E', label: 'Eastern Europe' },
];

const c = (id, name, region, flags, eurostat, iso3, ne) => ({
  id,
  name,
  region,
  eu: flags.includes('eu'),
  wb: flags.includes('wb'),
  euro: flags.includes('ea'),
  eurostat: eurostat ?? id,
  iso3,
  ne: ne ?? iso3,
});

export const COUNTRIES = [
  // EU-27
  c('AT', 'Austria', 'W', 'eu ea', null, 'AUT'),
  c('BE', 'Belgium', 'W', 'eu ea', null, 'BEL'),
  c('BG', 'Bulgaria', 'E', 'eu ea', null, 'BGR'),
  c('HR', 'Croatia', 'S', 'eu ea', null, 'HRV'),
  c('CY', 'Cyprus', 'S', 'eu ea', null, 'CYP'),
  c('CZ', 'Czechia', 'E', 'eu', null, 'CZE'),
  c('DK', 'Denmark', 'N', 'eu', null, 'DNK'),
  c('EE', 'Estonia', 'N', 'eu ea', null, 'EST'),
  c('FI', 'Finland', 'N', 'eu ea', null, 'FIN'),
  c('FR', 'France', 'W', 'eu ea', null, 'FRA'),
  c('DE', 'Germany', 'W', 'eu ea', null, 'DEU'),
  c('GR', 'Greece', 'S', 'eu ea', 'EL', 'GRC'),
  c('HU', 'Hungary', 'E', 'eu', null, 'HUN'),
  c('IE', 'Ireland', 'N', 'eu ea', null, 'IRL'),
  c('IT', 'Italy', 'S', 'eu ea', null, 'ITA'),
  c('LV', 'Latvia', 'N', 'eu ea', null, 'LVA'),
  c('LT', 'Lithuania', 'N', 'eu ea', null, 'LTU'),
  c('LU', 'Luxembourg', 'W', 'eu ea', null, 'LUX'),
  c('MT', 'Malta', 'S', 'eu ea', null, 'MLT'),
  c('NL', 'Netherlands', 'W', 'eu ea', null, 'NLD'),
  c('PL', 'Poland', 'E', 'eu', null, 'POL'),
  c('PT', 'Portugal', 'S', 'eu ea', null, 'PRT'),
  c('RO', 'Romania', 'E', 'eu', null, 'ROU'),
  c('SK', 'Slovakia', 'E', 'eu ea', null, 'SVK'),
  c('SI', 'Slovenia', 'S', 'eu ea', null, 'SVN'),
  c('ES', 'Spain', 'S', 'eu ea', null, 'ESP'),
  c('SE', 'Sweden', 'N', 'eu', null, 'SWE'),
  // Western Balkans
  c('AL', 'Albania', 'S', 'wb', null, 'ALB'),
  c('BA', 'Bosnia and Herzegovina', 'S', 'wb', null, 'BIH'),
  c('XK', 'Kosovo', 'S', 'wb', 'XK', 'XKX', 'KOS'),
  c('ME', 'Montenegro', 'S', 'wb', null, 'MNE'),
  c('MK', 'North Macedonia', 'S', 'wb', null, 'MKD'),
  c('RS', 'Serbia', 'S', 'wb', null, 'SRB'),
  // Other European countries
  c('GB', 'United Kingdom', 'N', '', 'UK', 'GBR'),
  c('IS', 'Iceland', 'N', '', null, 'ISL'),
  c('NO', 'Norway', 'N', '', null, 'NOR'),
  c('CH', 'Switzerland', 'W', '', null, 'CHE'),
  c('TR', 'Türkiye', 'S', '', null, 'TUR'),
  c('UA', 'Ukraine', 'E', '', null, 'UKR'),
  c('MD', 'Moldova', 'E', '', null, 'MDA'),
  c('BY', 'Belarus', 'E', '', null, 'BLR'),
];

// Countries deliberately left out, shown on the methodology page.
export const EXCLUDED = [
  { name: 'Russia', reason: 'Most of its territory and population statistics extend far beyond Europe, and comparable housing and income series are not published by Eurostat or the OECD after 2022.' },
  { name: 'Georgia, Armenia, Azerbaijan', reason: 'Often counted as transcontinental; they are not covered by the Eurostat house price, EU SILC or HICP datasets used here.' },
  { name: 'Andorra, Liechtenstein, Monaco, San Marino, Vatican City', reason: 'Microstates with almost no data in the comparable datasets used here. They are drawn on the map as context only.' },
];

// Official aggregates used as benchmarks, keyed by the source code.
export const AGGREGATES = {
  EU27: { id: 'EU27', name: 'EU', eurostat: 'EU27_2020', worldbank: 'EUU' },
  EA: { id: 'EA', name: 'Euro area', oecd: 'EA' },
};
