#!/usr/bin/env node
// Keeps the hand-written pages in step with facts.json and assets/media/media.json. Run after
// editing either, or after adding a marker to a page:
//
//   node tools/site/build.mjs
//
// It rewrites three things in place and leaves everything else in a page alone:
//
//   <span data-fact="ai.aiNodesTotal">85</span>      text set from facts.json (dotted path)
//   <!-- @picture slug="..." [class] [sizes] [loading="eager"] [alt] --> ... <!-- /@picture -->
//   <!-- @loop slug="..." [class] [hero] [hover] -->                      ... <!-- /@loop -->
//
// A marker's body is regenerated every run, so edit the attributes, never the body.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP = new Set(['archive', 'lab', 'tools', 'uploads', 'node_modules', '.git']);

const facts = JSON.parse(fs.readFileSync(path.join(ROOT, 'facts.json'), 'utf8'));
const media = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'media', 'media.json'), 'utf8'));
const stills = new Map(media.stills.map((s) => [s.slug, s]));
const loops = new Map(media.loops.map((s) => [s.slug, s]));

function pages(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) pages(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.html') && !e.name.startsWith('google')) out.push(path.join(dir, e.name));
  }
  return out;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function attrs(src) {
  const a = {};
  for (const m of src.matchAll(/([a-z-]+)(?:="([^"]*)")?/g)) a[m[1]] = m[2] === undefined ? true : m[2];
  return a;
}

function fact(dotted) {
  const v = dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), facts);
  if (v == null || typeof v === 'object') throw new Error(`facts.json has no value at "${dotted}"`);
  return typeof v === 'number' && v >= 10000 ? v.toLocaleString('en-US') : String(v);
}

// Paths in media.json are from the site root; a page in a folder needs them relative to itself.
const relTo = (page) => (p) => path.posix.relative(path.posix.dirname(page), p) || p;
const srcset = (list, fix) => list.split(', ').map((part) => { const [p, w] = part.split(' '); return `${fix(p)} ${w}`; }).join(', ');

function picture(a, page, indent) {
  const s = stills.get(a.slug);
  if (!s) throw new Error(`${page}: no still "${a.slug}" in media.json`);
  const fix = relTo(page);
  const sizes = a.sizes || '100vw';
  const eager = a.loading === 'eager';
  const alt = a.alt !== undefined && a.alt !== true ? a.alt : s.alt; // alt="" marks a decorative image
  const img = [`src="${fix(s.jpg)}"`, `alt="${esc(alt)}"`, `width="${s.width}"`, `height="${s.height}"`,
    eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"', 'decoding="async"', a.class ? `class="${a.class}"` : '']
    .filter(Boolean).join(' ');
  return [
    `<picture>`,
    `  <source type="image/avif" srcset="${srcset(s.avif, fix)}" sizes="${sizes}">`,
    `  <source type="image/webp" srcset="${srcset(s.webp, fix)}" sizes="${sizes}">`,
    `  <img ${img}>`,
    `</picture>`,
  ].map((l) => indent + l).join('\n');
}

function loop(a, page, indent) {
  const s = loops.get(a.slug);
  if (!s) throw new Error(`${page}: no loop "${a.slug}" in media.json`);
  const fix = relTo(page);
  // Hero loops start at once; the rest load nothing until nav3d.js plays them in view (or on hover).
  const mode = a.hero ? 'autoplay preload="auto" data-autoplay' : a.hover ? 'preload="none" data-hoverplay' : 'preload="none" data-autoplay';
  const tag = [a.id ? `id="${a.id}"` : '', `class="${a.class || ''}"`, 'muted loop playsinline', mode, `poster="${fix(s.posterJpg)}"`,
    `width="${s.width}"`, `height="${s.height}"`, `aria-label="${esc(a.alt || s.alt)}"`].filter(Boolean).join(' ');
  return [
    `<video ${tag}>`,
    `  <source src="${fix(s.webm)}" type='video/webm; codecs="av01.0.05M.08"'>`,
    `  <source src="${fix(s.mp4)}" type="video/mp4">`,
    `</video>`,
  ].map((l) => indent + l).join('\n');
}

let changed = 0;
for (const file of pages()) {
  const page = path.relative(ROOT, file).split(path.sep).join('/');
  const before = fs.readFileSync(file, 'utf8');
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  let html = before.replace(/\r\n/g, '\n');

  html = html.replace(/(<([a-z0-9]+)\b[^>]*\sdata-fact="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g,
    (_, open, _tag, key, _old, close) => open + fact(key) + close);

  html = html.replace(/([ \t]*)<!-- @(picture|loop) ([^>]*?) -->\n(?:[\s\S]*?\n)??[ \t]*<!-- \/@\2 -->/g, (_, indent, kind, a) => {
    const body = kind === 'picture' ? picture(attrs(a), page, indent) : loop(attrs(a), page, indent);
    return `${indent}<!-- @${kind} ${a} -->\n${body}\n${indent}<!-- /@${kind} -->`;
  });

  const open = (html.match(/<!-- @(picture|loop) /g) || []).length;
  const shut = (html.match(/<!-- \/@(picture|loop) -->/g) || []).length;
  if (open !== shut) throw new Error(`${page}: ${open} markers opened, ${shut} closed`);

  html = html.replace(/\n/g, eol);
  if (html !== before) { fs.writeFileSync(file, html); changed++; console.log(`  rewrote ${page}`); }
}
console.log(`build: ${changed} page(s) changed`);
