#!/usr/bin/env node
// Builds public/data/europe.topo.json from Natural Earth 1:10m admin-0 boundaries, using the
// German (EU member state) point-of-view edition: Kosovo is shown separately and
// Crimea as part of Ukraine, in line with the EU position on internationally recognised borders.
// Run with: npm run data:geo
//
// - Countries are joined to the data on our canonical id (ISO alpha-2, XK for Kosovo)
//   via the Natural Earth ADM0_A3 code listed in config/countries.mjs.
// - Natural Earth draws Northern Cyprus separately; following EU/Eurostat practice we
//   dissolve it into Cyprus for display. Eurostat figures for Cyprus refer only to the
//   areas under the effective control of the government of the Republic of Cyprus.
// - Neighbouring countries outside the explorer are kept as grey context shapes.
// - Shapes are clipped to a European frame (overseas territories are dropped) and simplified.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';
import { COUNTRIES } from './config/countries.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, 'scripts/.cache');
const SRC_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries_deu.geojson';
const SRC = resolve(CACHE, 'ne_10m_admin_0_countries_deu.geojson');
const OUT = resolve(ROOT, 'public/data/europe.topo.json');

const CONTEXT = ['RUS', 'GEO', 'ARM', 'AZE', 'KAZ', 'MAR', 'DZA', 'TUN', 'LBY', 'EGY', 'SYR', 'IRQ', 'IRN', 'LBN', 'ISR', 'PSE', 'JOR', 'SAU', 'GRL', 'FRO', 'AND', 'LIE', 'MCO', 'SMR', 'VAT', 'ALD', 'IMN', 'JEY', 'GGY'];

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function main() {
  await mkdir(CACHE, { recursive: true });
  if (!(await exists(SRC))) {
    console.log('Downloading Natural Earth 1:10m countries…');
    const res = await fetch(SRC_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${SRC_URL}`);
    await writeFile(SRC, Buffer.from(await res.arrayBuffer()));
  }
  const map = Object.fromEntries(COUNTRIES.map((c) => [c.ne, c.id]));
  map.CYN = 'CY';
  const geo = JSON.parse(await readFile(SRC, 'utf8'));
  geo.features = geo.features
    .filter((f) => map[f.properties.ADM0_A3] || CONTEXT.includes(f.properties.ADM0_A3))
    .map((f) => {
      const a3 = f.properties.ADM0_A3;
      const id = map[a3];
      return { type: 'Feature', geometry: f.geometry, properties: id ? { id, covered: 1 } : { id: `x-${a3}`, name: f.properties.NAME_EN, covered: 0 } };
    });

  const out = await mapshaper.applyCommands(
    [
      '-i input.json name=countries',
      '-clip bbox=-26,33.5,48,71.5 remove-slivers',
      '-dissolve id copy-fields=covered,name',
      '-simplify interval=2500 weighted keep-shapes',
      '-filter-slivers min-area=60km2',
      '-o output.json format=topojson quantization=60000 precision=0.0001',
    ].join(' '),
    { 'input.json': JSON.stringify(geo) },
  );
  const topo = out['output.json'];
  const parsed = JSON.parse(topo);
  const ids = parsed.objects.countries.geometries.map((g) => g.properties.id);
  const missing = COUNTRIES.filter((c) => !ids.includes(c.id)).map((c) => c.id);
  if (missing.length) throw new Error(`Countries missing from geometry: ${missing.join(', ')}`);
  await writeFile(OUT, topo);
  console.log(`Wrote ${OUT} (${(topo.length / 1024).toFixed(0)} KB, ${ids.length} shapes)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
