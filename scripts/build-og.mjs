#!/usr/bin/env node
// Builds the link-preview image (public/og.png, 1200×630) shown when the site is shared on
// WhatsApp, Facebook, X, LinkedIn… It draws the real map of home prices per m² from the
// committed data, so re-run it after a data update:  npm run og
// Uses system fonts (Georgia / Segoe UI on Windows; any serif / sans-serif elsewhere).

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAzimuthalEqualArea, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { Resvg } from '@resvg/resvg-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(resolve(ROOT, 'public/data/data.json'), 'utf8'));
const topo = JSON.parse(await readFile(resolve(ROOT, 'public/data/europe.topo.json'), 'utf8'));

const W = 1200, H = 630;
const ind = (id) => data.indicators.find((i) => i.id === id);
const pm = ind('price_m2');
const latest = (s) => s?.[s.length - 1];

// Same terracotta ramp and quantile breaks idea as the site's map.
const RAMP = ['#f6e1d3', '#edbf9f', '#df9a75', '#cc7552', '#ac5536', '#7e3b24'];
const vals = Object.values(pm.series).map((s) => latest(s)[1]).sort((a, b) => a - b);
const q = (p) => vals[Math.floor((vals.length - 1) * p)];
const breaks = [1, 2, 3, 4, 5].map((i) => q(i / 6));
const color = (v) => { let i = 0; while (i < breaks.length && v >= breaks[i]) i++; return RAMP[i]; };

const features = feature(topo, topo.objects.countries).features;
const covered = { type: 'FeatureCollection', features: features.filter((f) => f.properties.covered) };
const MAP = { x: 560, y: 20, w: 630, h: 590 };
const projection = geoAzimuthalEqualArea().rotate([-12, -52]).fitExtent([[MAP.x, MAP.y], [MAP.x + MAP.w, MAP.y + MAP.h]], covered);
const path = geoPath(projection);
const paths = features
  .map((f) => {
    const d = path(f);
    if (!d) return '';
    if (!f.properties.covered) return `<path d="${d}" fill="#f1efea" stroke="#ddd8cf" stroke-width="0.6"/>`;
    const o = latest(pm.series[f.properties.id]);
    return `<path d="${d}" fill="${o ? color(o[1]) : 'url(#hatch)'}" stroke="#fffdf8" stroke-width="0.8"/>`;
  })
  .join('');

const price = (id) => latest(pm.series[id])?.[1];
const fmt = (v) => `€${Math.round(v).toLocaleString('en-GB')}`;
const hpi = ind('hpi').series.AL;
const al2015 = hpi.find((o) => o[0] === 2015)[1], alLast = latest(hpi);
const albaniaX = (alLast[1] / al2015).toFixed(1);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const facts = [
  [`${fmt(price('AL'))}`, 'per m² in Albania'],
  [`${fmt(price('DE'))}`, 'per m² in Germany'],
  [`×${albaniaX}`, `Albanian house prices, 2015–${alLast[0]}`],
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="#f3efe7"/><line x1="0" y1="0" x2="0" y2="6" stroke="#cfc6b6" stroke-width="1.4"/>
    </pattern>
    <clipPath id="mapclip"><rect x="${MAP.x - 10}" y="0" width="${W - MAP.x + 10}" height="${H}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="#f7f3ec"/>
  <rect x="${MAP.x - 10}" y="0" width="${W - MAP.x + 10}" height="${H}" fill="#e8eef3"/>
  <g clip-path="url(#mapclip)">${paths}</g>
  <rect x="0" y="0" width="${W}" height="8" fill="#1d2a44"/>
  <text x="56" y="92" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="5" fill="#a8432e">EUROPE</text>
  <text font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#1d2a44" font-size="64" letter-spacing="-1.5">
    <tspan x="52" y="166">The Real Cost</tspan><tspan x="52" y="238">of Living</tspan>
  </text>
  <text font-family="Georgia, 'Times New Roman', serif" font-style="italic" fill="#4a5468" font-size="25">
    <tspan x="56" y="294">Home prices, rents, wages and</tspan><tspan x="56" y="328">affordability in ${data.countries.length} countries</tspan>
  </text>
  ${facts.map(([big, small], i) => `
  <g transform="translate(56, ${386 + i * 66})">
    <rect x="0" y="-38" width="5" height="50" fill="#c8553d"/>
    <text x="20" y="0" font-family="Georgia, serif" font-weight="700" font-size="36" fill="#1d2a44">${esc(big)}</text>
    <text x="${20 + big.length * 21 + 14}" y="-4" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="19" fill="#4a5468">${esc(small)}</text>
  </g>`).join('')}
  <text x="56" y="600" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="16" fill="#6b7385">Eurostat · OECD · BIS · World Bank · Bank of Albania · Deloitte</text>
  <g transform="translate(${MAP.x + 14}, ${H - 40})">
    <rect x="-8" y="-24" width="250" height="44" rx="6" fill="#fffdf8" opacity="0.92"/>
    <text x="0" y="-6" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#1d2a44">Home price, € per m², ${latest(pm.series.AL)[0]}</text>
    ${RAMP.map((c, i) => `<rect x="${i * 38}" y="4" width="36" height="9" fill="${c}"/>`).join('')}
  </g>
</svg>`;

const fontFiles = ['C:/Windows/Fonts/georgia.ttf', 'C:/Windows/Fonts/georgiab.ttf', 'C:/Windows/Fonts/georgiai.ttf', 'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/segoeuib.ttf'].filter(existsSync);
const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { fontFiles, loadSystemFonts: true, defaultFontFamily: 'Georgia' } }).render().asPng();
await writeFile(resolve(ROOT, 'public/og.png'), png);
console.log(`Wrote public/og.png (${(png.length / 1024).toFixed(0)} KB)`);
