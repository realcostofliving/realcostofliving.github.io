#!/usr/bin/env node
// Lists interface strings that have no Albanian translation yet.
// Run with: npm run i18n:check   (add --json to print the missing keys as JSON)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && !p.endsWith('sq.ts')) files.push(p);
  }
};
walk(resolve(ROOT, 'src'));

// Keys are the first string argument of t('...') calls; dynamic keys (t(label)) are listed in
// DYNAMIC below because they come from constants.
const keys = new Set();
const re = /\bt\(\s*'((?:[^'\\]|\\.)*)'/g;
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(s))) keys.add(m[1].replace(/\\'/g, "'"));
}

const sq = readFileSync(resolve(ROOT, 'src/lib/sq.ts'), 'utf8');
const has = (k) => sq.includes(JSON.stringify(k)) || sq.includes(`'${k.replace(/'/g, "\\'")}'`);
const missing = [...keys].filter((k) => !has(k)).sort();

if (process.argv.includes('--json')) console.log(JSON.stringify(missing, null, 1));
else {
  for (const k of missing) console.log(`missing  ${k}`);
  console.log(`\n${keys.size} strings, ${missing.length} without an Albanian translation.`);
}
