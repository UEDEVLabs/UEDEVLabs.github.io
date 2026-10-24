#!/usr/bin/env node
// Self-hosts the store's product previews, so pages load no images (and no cookies) from Fab's CDN:
//
//   node tools/media/store-images.mjs           fetch what is missing
//   node tools/media/store-images.mjs --force   fetch everything again
//
// For each product in data/products.json with Fab gallery image ids, writes
// assets/store/<product id>.webp and .jpg at the preview's own size (Fab serves 639 px wide).
// Also sizes the developer avatar and the Nav3D splash for the pages that show them.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'assets', 'store');
const TMP = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache', 'store');
const FORCE = process.argv.includes('--force');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

async function fetchTo(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (UEDEV site build)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function encode(src, base, { width, square } = {}) {
  const resize = square ? ['-resize', `${width}x${width}^`, '-gravity', 'center', '-extent', `${width}x${width}`] : width ? ['-resize', `${width}x`] : [];
  await run('magick', [src, ...resize, '-strip', '-quality', '80', `${base}.webp`]);
  await run('magick', [src, ...resize, '-strip', '-quality', '82', '-sampling-factor', '4:2:0', '-interlace', 'JPEG', `${base}.jpg`]);
}

let n = 0;
for (const p of store.products.filter((x) => x.img)) {
  const base = path.join(OUT, p.id);
  if (!FORCE && fs.existsSync(`${base}.webp`) && fs.existsSync(`${base}.jpg`)) continue;
  const raw = path.join(TMP, `${p.id}.jpg`);
  await fetchTo(`${store.imageBase}${p.img[0]}/${p.img[1]}.jpg`, raw);
  await encode(raw, base);
  n++;
  console.log(`  ${p.id}`);
}

// The developer avatar (Fab seller profile picture), shown at 84 px: 168 px for high-density screens.
const avatar = path.join(ROOT, 'assets', 'img', 'charitha-madhushanka');
if (FORCE || !fs.existsSync(`${avatar}.webp`)) {
  const raw = path.join(TMP, 'avatar.png');
  await fetchTo('https://cdn1.epicgames.com/fab/seller/o-9f8urqc2ufdfkftuxkaxvn5pa8vq9t/profile/375ceb80.png', raw);
  await encode(raw, avatar, { width: 168, square: true });
  console.log('  avatar');
}
// The Nav3D splash beside the feature list, shown at up to ~480 px: 960 px.
const splash = path.join(ROOT, 'assets', 'nav3d', 'splash-960');
if (FORCE || !fs.existsSync(`${splash}.webp`)) {
  await encode(path.join(ROOT, 'assets', 'nav3d', 'splash.png'), splash, { width: 960 });
  console.log('  splash');
}
console.log(`store-images: ${n} product image(s) fetched`);
