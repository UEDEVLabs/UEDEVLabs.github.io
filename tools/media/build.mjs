#!/usr/bin/env node
// Builds the website's stills and loops from the in-engine captures listed in shots.json.
//
//   node tools/media/build.mjs                      build what is missing
//   node tools/media/build.mjs --force              rebuild everything
//   node tools/media/build.mjs --only slug,slug     rebuild some items
//   node tools/media/build.mjs --src "<dir>"        captures folder (default: LCM_MEDIA_SRC, then the Marketing Materials path)
//
// Needs ffmpeg (libx264, libsvtav1) and ImageMagick 7 (AVIF, WebP) on PATH.
// Writes assets/media/stills, assets/media/loops and assets/media/media.json, which the pages read.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'assets', 'media');
const CACHE = path.join(HERE, '.cache');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const FORCE = flag('--force');
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
const SRC = opt('--src') || process.env.LCM_MEDIA_SRC || 'E:/OnGoingUE/Nav3D_UE5/Marketing Materials';

// Encoder settings. AVIF and WebP carry the page; one JPEG per still is the fallback and the social-card source.
const Q = { avif: 50, webp: 78, jpg: 82 };
const LOOP_W = 1280;
const LOOP_FPS = 30;

const shots = JSON.parse(fs.readFileSync(path.join(HERE, 'shots.json'), 'utf8'));

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const fresh = (out, src) => !FORCE && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs;
const wanted = (item) => !ONLY || ONLY.has(item.slug);

function clipPath(id) {
  const p = shots.clips[id];
  if (!p) throw new Error(`unknown clip "${id}"`);
  const full = path.join(SRC, p);
  if (!fs.existsSync(full)) throw new Error(`missing capture: ${full}`);
  return full;
}

function cropFilter(name) {
  const c = shots.crops[name];
  if (!Array.isArray(c)) throw new Error(`unknown crop "${name}"`);
  const [x, y, w, h] = c;
  return { vf: `crop=${w}:${h}:${x}:${y}`, w, h };
}

async function ffmpeg(args) {
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
}

async function magick(args) {
  await run('magick', args, { maxBuffer: 1 << 26 });
}

// One lossless frame per still, cut at the crop's full resolution; every size is resized from it.
async function master(item) {
  const out = path.join(CACHE, `${item.slug}.png`);
  const src = clipPath(item.clip);
  if (!fresh(out, src)) {
    const { vf } = cropFilter(item.crop);
    await ffmpeg(['-ss', String(item.t), '-i', src, '-frames:v', '1', '-vf', vf, out]);
  }
  return out;
}

async function encodeImage(png, base, w, fmt) {
  const out = `${base}-${w}.${fmt}`;
  if (fresh(out, png)) return out;
  const common = [png, '-resize', `${w}x`, '-strip'];
  if (fmt === 'jpg') await magick([...common, '-quality', String(Q.jpg), '-sampling-factor', '4:2:0', '-interlace', 'JPEG', out]);
  else await magick([...common, '-quality', String(Q[fmt]), out]);
  return out;
}

function sizes(cropW, cropH) {
  const ws = shots.stillWidths.filter((w) => w <= cropW);
  if (ws[ws.length - 1] < cropW && cropW < shots.stillWidths[shots.stillWidths.length - 1]) ws.push(cropW);
  return ws.map((w) => ({ w, h: Math.round((w * cropH) / cropW) }));
}

async function buildStill(item) {
  const png = await master(item);
  const { w: cw, h: ch } = cropFilter(item.crop);
  const dims = sizes(cw, ch);
  const base = path.join(OUT, 'stills', item.slug);
  const avif = [], webp = [];
  for (const { w } of dims) {
    avif.push(rel(await encodeImage(png, base, w, 'avif')) + ` ${w}w`);
    webp.push(rel(await encodeImage(png, base, w, 'webp')) + ` ${w}w`);
  }
  const fallbackW = dims.find((d) => d.w === 1280) ? 1280 : dims[dims.length - 1].w;
  const jpg = rel(await encodeImage(png, base, fallbackW, 'jpg'));
  const largest = dims[dims.length - 1];
  return {
    slug: item.slug, alt: item.alt, caption: item.caption, use: item.use,
    width: largest.w, height: largest.h,
    avif: avif.join(', '), webp: webp.join(', '), jpg,
    source: { clip: shots.clips[item.clip], t: item.t, crop: item.crop },
  };
}

async function buildLoop(item) {
  const src = clipPath(item.clip);
  const { vf, w: cw, h: ch } = cropFilter(item.crop);
  const speed = item.speed || 1;
  const span = (item.d * speed).toFixed(3);
  const h = Math.round((LOOP_W * ch) / cw / 2) * 2;
  const chain = `${vf},setpts=PTS/${speed},fps=${LOOP_FPS},scale=${LOOP_W}:${h}:flags=lanczos,format=yuv420p`;
  const base = path.join(OUT, 'loops', item.slug);
  const mp4 = `${base}.mp4`, webm = `${base}.webm`, posterPng = path.join(CACHE, `${item.slug}-poster.png`);
  const input = ['-ss', String(item.a), '-t', span, '-i', src, '-an'];

  if (!fresh(mp4, src)) {
    await ffmpeg([...input, '-vf', chain, '-c:v', 'libx264', '-preset', 'slow', '-crf', '31', '-profile:v', 'high',
      '-movflags', '+faststart', mp4]);
  }
  if (!fresh(webm, src)) {
    await ffmpeg([...input, '-vf', chain, '-c:v', 'libsvtav1', '-preset', '5', '-crf', '48', '-g', '120', webm]);
  }
  if (!fresh(posterPng, src)) {
    await ffmpeg(['-ss', String(item.a), '-i', src, '-frames:v', '1', '-vf', `${vf},scale=${LOOP_W}:${h}:flags=lanczos`, posterPng]);
  }
  const poster = path.join(OUT, 'loops', `${item.slug}-poster`);
  const posterAvif = await encodeImage(posterPng, poster, LOOP_W, 'avif');
  const posterJpg = await encodeImage(posterPng, poster, LOOP_W, 'jpg');
  return {
    slug: item.slug, alt: item.alt, use: item.use, width: LOOP_W, height: h, seconds: item.d,
    webm: rel(webm), mp4: rel(mp4), posterAvif: rel(posterAvif), posterJpg: rel(posterJpg),
    source: { clip: shots.clips[item.clip], a: item.a, d: item.d, speed, crop: item.crop },
  };
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      process.stdout.write(`  ${items[i].slug}\n`);
    }
  }));
  return results;
}

async function main() {
  for (const d of [CACHE, path.join(OUT, 'stills'), path.join(OUT, 'loops')]) fs.mkdirSync(d, { recursive: true });
  const slugs = [...shots.stills, ...shots.loops].map((s) => s.slug);
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new Error(`duplicate slug "${dup}"`);

  const manifestPath = path.join(OUT, 'media.json');
  const prev = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { stills: [], loops: [] };
  // An item not rebuilt this run keeps its files from the last manifest, with its text taken from shots.json.
  const keep = (list, built) => list.map((item) => {
    if (built.has(item.slug)) return built.get(item.slug);
    const p = prev[item.kind].find((x) => x.slug === item.slug);
    return p && { ...p, alt: item.alt, caption: item.caption, use: item.use };
  }).filter(Boolean);

  console.log(`stills (${shots.stills.filter(wanted).length})`);
  const stills = await pool(shots.stills.filter(wanted), 4, buildStill);
  console.log(`loops (${shots.loops.filter(wanted).length})`);
  const loops = await pool(shots.loops.filter(wanted), 2, buildLoop);

  const builtStills = new Map(stills.map((s) => [s.slug, s]));
  const builtLoops = new Map(loops.map((s) => [s.slug, s]));
  const manifest = {
    $comment: 'Generated by tools/media/build.mjs from tools/media/shots.json. Do not edit by hand.',
    stills: keep(shots.stills.map((s) => ({ ...s, kind: 'stills' })), builtStills),
    loops: keep(shots.loops.map((s) => ({ ...s, kind: 'loops' })), builtLoops),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${rel(manifestPath)}: ${manifest.stills.length} stills, ${manifest.loops.length} loops`);
  if (!ONLY) prune(new Set(slugs));
}

// Delete outputs whose slug is no longer in shots.json, so a renamed shot leaves nothing behind on the site.
function prune(slugs) {
  const rules = [
    [path.join(OUT, 'stills'), /^(.+)-\d+\.(avif|webp|jpg)$/],
    [path.join(OUT, 'loops'), /^(.+?)(-poster-\d+)?\.(mp4|webm|avif|jpg)$/],
  ];
  for (const [dir, re] of rules) {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(re);
      if (m && !slugs.has(m[1])) { fs.unlinkSync(path.join(dir, f)); console.log(`  removed ${rel(path.join(dir, f))}`); }
    }
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
