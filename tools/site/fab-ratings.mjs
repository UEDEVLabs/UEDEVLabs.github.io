#!/usr/bin/env node
// Reads every product's rating from Fab and writes it into the site's data:
//   node tools/site/fab-ratings.mjs            then build.mjs, seo.mjs and verify.mjs as usual
// The flagship's rating goes to facts.json (reviews.*), every product's to data/products.json, and
// the store totals follow from those at build time. Files are written only when a number changed,
// so the daily job (.github/workflows/fab-ratings.yml) commits nothing on a quiet day. A listing
// Fab will not serve is skipped with a warning and keeps its last known rating.
// It also keeps the developer avatar (assets/img/charitha-madhushanka.*) as the Fab seller profile
// picture: when Fab serves a new picture (its URL changes), it is downloaded and resized.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FACTS = path.join(ROOT, 'facts.json');
const STORE = path.join(ROOT, 'data', 'products.json');
const API = 'https://www.fab.com/i/listings/';
// curl, not fetch(): Fab's Cloudflare front challenges Node's own HTTP client but serves curl.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `warning: ${msg}`);
const today = new Date().toISOString().slice(0, 10);

function rating(id) {
  const out = execFileSync('curl', ['-s', '--max-time', '20', '-A', UA, '-H', 'Accept: application/json',
    '-w', ' HTTP:%{http_code}', API + id], { encoding: 'utf8', maxBuffer: 8 << 20 });
  const at = out.lastIndexOf(' HTTP:');
  if (out.slice(at + 6) !== '200') throw new Error(`HTTP ${out.slice(at + 6)}`);
  const listing = JSON.parse(out.slice(0, at));
  if (!listing.uid && !listing.title) throw new Error('not a listing');
  const r = listing.ratings ?? {};
  const total = r.total ?? 0, avg = r.averageRating ?? (total ? undefined : 0); // unrated: no average
  if (!Number.isInteger(total) || total < 0 || typeof avg !== 'number' || avg < 0 || avg > 5) throw new Error('no ratings block');
  return { total, avg, listing };
}

const facts = JSON.parse(fs.readFileSync(FACTS, 'utf8'));
const store = JSON.parse(fs.readFileSync(STORE, 'utf8'));
const changes = [];
let read = 0, avatarUrl = null;

for (const p of store.products) {
  if (!p.fab) continue;
  let r;
  try { r = rating(p.fab); read++; if (p.flagship) avatarUrl = r.listing.user?.profileImageUrl; } catch (e) { warn(`${p.id}: Fab did not return a rating (${e.message}); kept ${p.rating ?? 'none'} (${p.ratings})`); continue; }
  // A listing never loses every rating at once; an empty answer is Fab having a bad moment.
  if (r.total === 0 && p.ratings > 0) { warn(`${p.id}: Fab reported 0 ratings, had ${p.ratings}; kept`); continue; }
  const value = r.total ? r.avg.toFixed(1) : null;
  if (value !== p.rating || r.total !== p.ratings) {
    changes.push(`${p.short || p.id}: ${p.rating ?? 'none'} (${p.ratings}) -> ${value ?? 'none'} (${r.total})`);
    p.rating = value; p.ratings = r.total;
  }
  if (p.flagship) {
    const rv = facts.reviews;
    if (rv.ratingValue !== Number(value) || rv.ratingCount !== r.total) {
      rv.ratingValue = Number(value); rv.ratingDisplay = value; rv.ratingCount = r.total; rv.checked = today;
    }
  }
  await new Promise((ok) => setTimeout(ok, 400));
}

if (!read) { warn('Fab returned no ratings at all (blocked or down); nothing changed'); process.exit(0); }

// The developer avatar follows the Fab seller profile picture.
if (avatarUrl && /^https:\/\/[^/]*epicgames\.com\//.test(avatarUrl) && avatarUrl !== store.sellerAvatar) {
  try {
    const base = path.join(ROOT, 'assets', 'img', 'charitha-madhushanka'), raw = path.join(os.tmpdir(), 'fab-avatar.png');
    execFileSync('curl', ['-s', '--fail', '--max-time', '30', '-A', UA, '-o', raw, avatarUrl]);
    const im = (args) => { try { execFileSync('magick', args); } catch { execFileSync('convert', args); } };   // ImageMagick 7, or 6 on CI
    const square = ['-resize', '168x168^', '-gravity', 'center', '-extent', '168x168', '-strip'];
    im([raw, ...square, '-quality', '80', `${base}.webp`]);
    im([raw, ...square, '-quality', '82', '-sampling-factor', '4:2:0', '-interlace', 'JPEG', `${base}.jpg`]);
    changes.push(`developer avatar: ${avatarUrl}`);
    store.sellerAvatar = avatarUrl;
  } catch (e) { warn(`developer avatar not updated (${e.message.split('\n')[0]})`); }
}
if (!changes.length) { console.log(`fab-ratings: ${read} listing(s) read, no rating changed`); process.exit(0); }

// products.json keeps one product per line, so the new numbers go into its text in place.
let text = fs.readFileSync(STORE, 'utf8').replace(/("checked": )"[^"]*"/, `$1"${today}"`)
  .replace(/("sellerAvatar": )"[^"]*"/, `$1"${store.sellerAvatar}"`);
for (const p of store.products) {
  text = text.replace(new RegExp(`(\\{ "id": "${p.id}",[^\\n]*?"rating": )(?:"[^"]*"|null)(, "ratings": )\\d+`),
    (_, a, b) => a + (p.rating === null ? 'null' : `"${p.rating}"`) + b + p.ratings);
}
fs.writeFileSync(STORE, text);
fs.writeFileSync(FACTS, JSON.stringify(facts, null, 2) + '\n');
console.log(`fab-ratings: ${changes.length} change(s)\n  ` + changes.join('\n  '));
