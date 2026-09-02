#!/usr/bin/env node
/**
 * Adds festivals to the `festivals` table from a paste-format list — the same
 * format the admin panel's paste box accepts:
 *
 *   # BERGEN COUNTY
 *   Ridgefield PBA 330 Food Truck Festival | Ridgefield | Sept 12 | Veterans Memorial Field | 11 AM-7 PM.
 *
 * This exists so a researched list can go straight in without anyone
 * hand-entering it or hand-writing SQL. It is deliberately narrow: it only ever
 * INSERTs into `festivals`, never updates or deletes, and it skips rows already
 * present (state + name + city + start date) so re-running is safe.
 *
 *   node scripts/add-festivals.mjs --state NJ --file events.txt
 *   node scripts/add-festivals.mjs --state NJ --file events.txt --dry-run
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const state = (argOf('--state') ?? '').toUpperCase();
const file = argOf('--file');
const dryRun = args.includes('--dry-run');

if (!/^[A-Z]{2}$/.test(state) || !file) {
  console.error('usage: node scripts/add-festivals.mjs --state XX --file <list.txt> [--dry-run]');
  process.exit(2);
}

// The parser is TypeScript and shared with the app; compile it on the fly so
// this script and the admin panel can never drift apart.
const outDir = mkdtempSync(join(tmpdir(), 'htm-bulk-'));
const require_ = createRequire(import.meta.url);
const tsc = require_.resolve('typescript/bin/tsc');
execFileSync(process.execPath, [
  tsc, 'lib/festivals-bulk.ts', '--outDir', outDir,
  '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
], { stdio: 'inherit' });
const { parseFestivalLines } = await import(join(outDir, 'festivals-bulk.js'));

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const US_STATES = JSON.parse(
  execFileSync(process.execPath, ['-e', `
    const s = require('fs').readFileSync('lib/us-states.ts','utf8');
    const m = s.match(/\\{ code: "([A-Z]{2})", name: "([^"]+)" \\}/g) || [];
    const out = {};
    for (const e of m) { const p = e.match(/"([A-Z]{2})".*?"([^"]+)"/); out[p[1]] = p[2]; }
    process.stdout.write(JSON.stringify(out));
  `], { encoding: 'utf8' })
);
const stateName = US_STATES[state];
if (!stateName) { console.error(`Unknown state code: ${state}`); process.exit(1); }

const { rows, issues } = parseFestivalLines(readFileSync(file, 'utf8'));
console.log(`parsed ${rows.length} event(s) for ${stateName}`);
for (const i of issues) console.log(`  skipped line ${i.line}: ${i.error}\n    ${i.text}`);
if (rows.length === 0) { console.error('nothing to add'); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const existing = await rest(`festivals?select=name,city,start_date&state_code=eq.${state}`);
const key = (n, c, d) => `${n.toLowerCase()}|${c.toLowerCase()}|${d}`;
const have = new Set(existing.map((f) => key(f.name, f.city, f.start_date)));

const toInsert = rows
  .filter((r) => !have.has(key(r.name, r.city, r.start_date)))
  .map((r) => ({ ...r, state_code: state, state_name: stateName }));
const skipped = rows.length - toInsert.length;

console.log(`to insert: ${toInsert.length}  already present: ${skipped}`);
for (const r of toInsert) {
  console.log(`  + ${r.start_date}${r.end_date !== r.start_date ? `..${r.end_date}` : ''}  ${r.county ? r.county + ' Co. / ' : ''}${r.city} — ${r.name}`);
}

if (dryRun) { console.log('\n--dry-run: nothing written'); process.exit(0); }
if (toInsert.length === 0) { console.log('nothing new to add'); process.exit(0); }

const inserted = await rest('festivals', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify(toInsert),
});
console.log(`\ninserted ${inserted.length} event(s)`);
