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
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));

// Store totals are facts too (data-fact="store.ratings"), so no page has to count by hand.
{
  const rated = store.products.filter((p) => p.rating);
  const ratings = rated.reduce((n, p) => n + p.ratings, 0);
  const avg = rated.reduce((n, p) => n + parseFloat(p.rating) * p.ratings, 0) / ratings;
  facts.store = {
    products: store.products.length,
    vfx: store.products.filter((p) => p.cat !== 'Plugins').length,
    plugins: store.products.filter((p) => p.cat === 'Plugins').length,
    ratings, average: avg.toFixed(1), checked: store.checked,
  };
}

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
// A folder (trailing slash) keeps its slash, and a page's own folder is "./".
const relTo = (page) => (p) => {
  const r = path.posix.relative(path.posix.dirname(page), p);
  return p.endsWith('/') ? (r ? r + '/' : './') : r || p;
};
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
  // Nothing downloads video before the page has painted. A hero sits on a responsive still of its
  // own first frame (the LCP image: ~40 KB on a phone, where a poster could only be one fixed JPEG)
  // and fades in once nav3d.js has it playing after load. Other loops get their poster when they
  // come near the screen; a hover loop has no poster, because the still underneath is showing.
  const mode = a.hero ? 'preload="none" data-autoplay data-hero' : a.hover ? 'preload="none" data-hoverplay' : 'preload="none" data-autoplay';
  const poster = a.hero || a.hover ? '' : `data-poster="${fix(s.posterJpg)}"`;
  const tag = [a.id ? `id="${a.id}"` : '', `class="${a.class || ''}"`, 'muted loop playsinline', mode, poster,
    `width="${s.width}"`, `height="${s.height}"`, `aria-label="${esc(a.alt || s.alt)}"`].filter(Boolean).join(' ');
  const still = a.hero
    ? picture({ slug: 'poster-' + a.slug.replace(/^loop-/, ''), sizes: '100vw', loading: 'eager', class: 'xh__still', alt: '' }, page, indent) + '\n'
    : '';
  // A hover loop also gets a play button: phones cannot hover, and keyboards need something to press.
  const button = a.hover
    ? [`<button class="xw__play" type="button" aria-pressed="false" aria-label="Play clip: ${esc((a.alt || s.alt).replace(/^Looping clip: /, ''))}">`,
       `  <svg class="i-play" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z"/></svg>`,
       `  <svg class="i-pause" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>`,
       `</button>`]
    : [];
  return still + [
    `<video ${tag}>`,
    `  <source src="${fix(s.webm)}" type='video/webm; codecs="av01.0.05M.08"'>`,
    `  <source src="${fix(s.mp4)}" type="video/mp4">`,
    `</video>`,
    ...button,
  ].map((l) => indent + l).join('\n');
}

// Store cards, styled by company.css (.card). Attributes: cat="Combat", ids="a,b,c", no-flagship, sizes.
const CATGRAD = {
  Combat: 'linear-gradient(135deg,#7fe05a,#c8ff5e)', Weapons: 'linear-gradient(135deg,#2fe06a,#10c9b0)',
  Environment: 'linear-gradient(135deg,#2fe06a,#2fe06a)', Character: 'linear-gradient(135deg,#10c9b0,#c8ff5e)',
  Packs: 'linear-gradient(135deg,#d6f77a,#7fe05a)', Plugins: 'linear-gradient(135deg,#10c9b0,#2fe06a)',
};
const stars = (r) => { const n = Math.round(parseFloat(r)); return '★'.repeat(n) + '☆'.repeat(5 - n); };

function catalog(a, page, indent) {
  let list = store.products;
  if (a.ids) list = a.ids.split(',').map((id) => {
    const p = store.products.find((x) => x.id === id);
    if (!p) throw new Error(`${page}: no product "${id}" in data/products.json`);
    return p;
  });
  if (a.cat) list = list.filter((p) => p.cat === a.cat);
  if (a['no-flagship']) list = list.filter((p) => !p.flagship);
  const fix = relTo(page);
  const sizes = a.sizes || '(min-width:1100px) 25vw, (min-width:560px) 50vw, 100vw';
  return list.map((p) => {
    const label = store.categories[p.cat];
    const href = p.page ? fix(p.page) : store.listingBase + p.fab;
    const ext = p.page ? '' : ' target="_blank" rel="noopener"';
    const media = p.still
      ? picture({ slug: p.still, sizes, alt: `${p.short}, ${label} for Unreal Engine` }, page, '').replace(/\n\s*/g, '')
      // Self-hosted by tools/media/store-images.mjs: Fab's CDN sets third-party cookies.
      : `<picture><source type="image/webp" srcset="${fix(`assets/store/${p.id}.webp`)}">` +
        `<img src="${fix(`assets/store/${p.id}.jpg`)}" alt="${esc(p.short)}, ${label} for Unreal Engine by UEDEV" width="639" height="349" loading="lazy" decoding="async"></picture>`;
    const rating = p.rating
      ? `<span class="rating"><span class="stars" aria-hidden="true">${stars(p.rating)}</span>${p.rating} <span class="rating__n">(${p.ratings})</span></span>`
      : '<span class="rating rating--new">New</span>';
    return `${indent}<a class="card" data-cat="${p.cat}" href="${href}"${ext}>` +
      `<div class="card__media" style="background:${CATGRAD[p.cat]}">${media}<span class="card__cat">${label}</span>` +
      `<div class="card__view"><span>${p.page ? 'Explore the plugin →' : 'View on Fab ↗'}</span></div></div>` +
      `<div class="card__body"><h3 class="card__title">${esc(p.short)}</h3>` +
      `<div class="card__meta"><span class="price">From $${p.price}</span>${rating}</div></div></a>`;
  }).join('\n');
}

// The top bar, the same on every page. active = home | how | uses | store | dev; on a use-case page
// current="<slug>/" marks its entry in the Use cases menu.
const USE_CASES = [
  ['unreal-engine-flying-ai/', 'Flying AI &amp; drones', '6-DOF flight, landing on moving decks, perching'],
  ['unreal-engine-underwater-ai/', 'Underwater &amp; fish AI', 'Schooling through the whole water column'],
  ['unreal-engine-space-combat-ai/', 'Space combat', 'Chase, intercept and raider swarms'],
  ['unreal-engine-open-world-navigation/', 'Open worlds', 'No bounds volume, no edge'],
  ['unreal-engine-mass-entity-crowds/', 'Mass Entity crowds', '10,000+ agents navigating in 3D'],
  ['unreal-engine-moving-obstacle-avoidance/', 'Moving obstacles', 'New in 3.6: predict and time the pass'],
];
function nav(a, page, indent) {
  const fix = relTo(page);
  const home = fix('index.html').replace(/index\.html$/, '') || './';
  const cur = (key) => (a.active === key ? ' class="active" aria-current="page"' : '');
  const fab = facts.product.fab;
  const items = USE_CASES.map(([href, label, sub]) =>
    `        <a href="${fix(href)}"${a.current === href ? ' aria-current="page"' : ''}><b>${label}</b><span>${sub}</span></a>`).join('\n');
  return `<header class="nav" id="nav">
  <div class="nav__in">
    <a href="${home}" class="brand" aria-label="UEDEV home"><img class="brand__mark" src="${fix('assets/brand/uedev-mark.svg')}" width="34" height="34" alt=""><img class="brand__word" src="${fix('assets/brand/uedev-wordmark.svg')}" width="109" height="17" alt=""></a>
    <nav class="nav__links" id="nav-links" aria-label="Main">
      <a href="${home}"${cur('home')}>3D Navigation AI</a>
      <a href="${fix('unreal-engine-3d-pathfinding/')}"${cur('how')}>How it works</a>
      <div class="nav__dd${a.active === 'uses' ? ' active' : ''}">
        <button class="nav__ddbtn" type="button" aria-expanded="false" aria-controls="nav-uses">Use cases<svg class="nav__chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg></button>
        <div class="nav__menu" id="nav-uses">
${items}
        </div>
      </div>
      <a href="${facts.product.docs}" target="_blank" rel="noopener">Docs<span class="nav__ext" aria-hidden="true">↗</span></a>
      <a href="${fix('unreal-engine-niagara-vfx/')}"${cur('store')}>More Products</a>
      <a href="${fix('portfolio.html')}" class="nav__opt">Developer</a>
      <a href="${fab}" target="_blank" rel="noopener" class="nav__mcta">Get it on Fab ↗</a>
    </nav>
    <a href="${fab}" target="_blank" rel="noopener" class="nav__cta">Get it on Fab ↗</a>
    <button class="burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav-links"><span></span><span></span><span></span></button>
  </div>
</header>`.split('\n').map((l) => indent + l).join('\n');
}

const KINDS = { picture, loop, catalog, nav };
let changed = 0;
for (const file of pages()) {
  const page = path.relative(ROOT, file).split(path.sep).join('/');
  const before = fs.readFileSync(file, 'utf8');
  const eol = before.includes('\r\n') ? '\r\n' : '\n';
  let html = before.replace(/\r\n/g, '\n');

  html = html.replace(/(<([a-z0-9]+)\b[^>]*\sdata-fact="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g,
    (_, open, _tag, key, _old, close) => open + fact(key) + close);
  // Star rows follow the rating they show (data-fact-stars="reviews.ratingValue").
  html = html.replace(/(<span\b[^>]*\sdata-fact-stars="([^"]+)"[^>]*>)[^<]*(<\/span>)/g, (_, open, key, close) => open + stars(fact(key)) + close);
  // Animated counters keep their target in data-count; data-fact-count sets it.
  html = html.replace(/data-fact-count="([^"]+)" data-count="[^"]*"/g, (_, key) => `data-fact-count="${key}" data-count="${fact(key)}"`);

  html = html.replace(/([ \t]*)<!-- @(picture|loop|catalog|nav)(?: ([^>]*?))? -->\n(?:[\s\S]*?\n)??[ \t]*<!-- \/@\2 -->/g, (_, indent, kind, a = '') => {
    const body = KINDS[kind](attrs(a), page, indent);
    return `${indent}<!-- @${kind}${a ? ' ' + a : ''} -->\n${body}\n${indent}<!-- /@${kind} -->`;
  });

  const open = (html.match(/<!-- @(picture|loop|catalog|nav)[ -]/g) || []).length;
  const shut = (html.match(/<!-- \/@(picture|loop|catalog|nav) -->/g) || []).length;
  if (open !== shut) throw new Error(`${page}: ${open} markers opened, ${shut} closed`);

  html = html.replace(/\n/g, eol);
  if (html !== before) { fs.writeFileSync(file, html); changed++; console.log(`  rewrote ${page}`); }
}
console.log(`build: ${changed} page(s) changed`);
