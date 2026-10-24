#!/usr/bin/env node
// Checks every page before a commit:  node tools/site/verify.mjs
// Fails on a broken local link or asset, an <img> without alt or size, JSON-LD that does not parse,
// a duplicate id, an FAQ whose schema and visible questions differ, stale release text, or a
// product claim the author asked to keep going missing.
// Also fails on a long dash (—) anywhere in a page's copy or structured data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP = new Set(['archive', 'lab', 'tools', 'uploads', 'node_modules', '.git']);
const PAGES_WITH_CLAIMS = ['index.html', 'unreal-engine-3d-pathfinding/index.html'];
const KEPT_CLAIMS = ['10,000', 'GPU solver', 'threat exposure', 'nav links'];
const STALE = [/\bv?2\.05\b/, /\b517\b/, /128-page/, /Next · v3\.0/];

function pages(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) pages(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.html') && !e.name.startsWith('google')) out.push(path.join(dir, e.name));
  }
  return out;
}

const fails = [], warns = [];
const fail = (page, msg) => fails.push(`${page}: ${msg}`);
// Older pages outside the redesign get image-size problems as warnings, not failures.
const LOOSE = new Set(['portfolio.html', 'Style Directions.html']);
const titles = new Map();
const SITEMAP = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
let checkedRefs = 0;

for (const file of pages()) {
  const page = path.relative(ROOT, file).split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');

  // Structured data
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const graphs = [];
  for (const [, body] of ld) { try { graphs.push(JSON.parse(body)); } catch (e) { fail(page, `JSON-LD does not parse: ${e.message}`); } }

  // Consistency: one top bar everywhere, and every demo-world card has a clip behind it.
  if (!LOOSE.has(page)) {
    if (!html.includes('<!-- @nav ')) fail(page, 'top bar is not the shared @nav (tools/site/build.mjs)');
    for (const card of html.match(/<article class="xw__card[\s\S]*?<\/article>/g) || []) {
      if (!/@loop slug="[^"]+" hover/.test(card)) fail(page, `world card without a hover clip: ${(card.match(/<h3>([^<]+)/) || [])[1]}`);
    }
  }

  // Structured data: the fields Google needs for each rich result, and our own URLs must exist.
  const nodes = graphs.flatMap((g) => g['@graph'] || [g]);
  const need = (n, keys) => keys.filter((k) => k.split('|').every((alt) => n[alt] === undefined || n[alt] === '')).map((k) => `${n['@type']} is missing ${k}`);
  for (const n of nodes) {
    const t = n['@type'];
    const miss =
      t === 'VideoObject' ? need(n, ['name', 'description', 'thumbnailUrl', 'uploadDate', 'duration', 'contentUrl|embedUrl'])
      : t === 'SoftwareApplication' ? need(n, ['name', 'applicationCategory', 'operatingSystem', 'offers'])
      : t === 'FAQPage' ? (n.mainEntity || []).filter((q) => !q.name || !q.acceptedAnswer?.text).map(() => 'FAQPage has a question without name or answer')
      : t === 'BreadcrumbList' ? (n.itemListElement || []).filter((it, i, all) => !it.position || !it.name || (!it.item && i < all.length - 1)).map(() => 'BreadcrumbList item without position, name or item')
      : [];
    if (t === 'SoftwareApplication' && n.offers && (!n.offers.price || !n.offers.priceCurrency)) miss.push('SoftwareApplication offers without price and priceCurrency');
    if (t === 'VideoObject' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/.test(n.uploadDate || '')) miss.push(`VideoObject uploadDate "${n.uploadDate}" is not a full ISO 8601 date-time`);
    for (const m of miss) fail(page, `JSON-LD: ${m}`);
  }
  for (const [, body] of ld) {
    for (const m of body.matchAll(/"https:\/\/uedevlabs\.github\.io\/([^"#?]+\.(?:png|jpe?g|webp|avif|svg|json|txt|xml))"/g)) {
      if (!fs.existsSync(path.join(ROOT, decodeURIComponent(m[1])))) fail(page, `JSON-LD points at a missing file: ${m[1]}`);
    }
  }

  // Local references
  const refs = [];
  for (const m of visible.matchAll(/\s(?:src|href|poster|data-poster)="([^"]+)"/g)) refs.push(m[1]);
  for (const m of visible.matchAll(/\ssrcset="([^"]+)"/g)) for (const part of m[1].split(',')) refs.push(part.trim().split(/\s+/)[0]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:|javascript:)/.test(ref) || ref === '') continue;
    const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
    let target = path.resolve(dir, clean);
    if (clean.endsWith('/') || (fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, 'index.html');
    checkedRefs++;
    if (!fs.existsSync(target)) fail(page, `missing ${ref}`);
    else if (fs.statSync(target).size === 0) fail(page, `empty file ${ref} (a failed encode?)`);
  }

  // Images
  for (const m of visible.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\salt="/.test(tag)) fail(page, `<img> without alt: ${tag.slice(0, 90)}`);
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) {
      const msg = `<img> without width/height: ${tag.slice(0, 90)}`;
      if (!LOOSE.has(page)) fail(page, msg); else warns.push(`${page}: ${msg}`);
    }
  }

  // Duplicate ids
  const ids = [...visible.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) fail(page, `duplicate id "${id}"`);

  // FAQ: the schema and the visible questions must match one for one
  const faq = graphs.flatMap((g) => (g['@graph'] || [g])).find((n) => n['@type'] === 'FAQPage');
  if (faq) {
    const asked = faq.mainEntity.map((q) => q.name);
    const shown = [...visible.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    if (asked.length !== shown.length) fail(page, `FAQ schema has ${asked.length} questions, the page shows ${shown.length}`);
  }

  // Search basics: a title Google will not cut, a usable description, one canonical that is this page.
  if (!LOOSE.has(page)) {
    const dec = (t) => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const title = dec((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
    const desc = dec((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
    const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
    const want = 'https://uedevlabs.github.io/' + page.replace(/index\.html$/, '');
    if (!title || title.length > 60) fail(page, `title is ${title.length} characters (max 60): ${title}`);
    if (desc.length < 70 || desc.length > 160) fail(page, `meta description is ${desc.length} characters (70-160)`);
    if (canon !== want) fail(page, `canonical ${canon || '(none)'} should be ${want}`);
    if (titles.has(title)) fail(page, `same title as ${titles.get(title)}`); else titles.set(title, page);
    if (!SITEMAP.includes(`<loc>${want}</loc>`)) fail(page, 'not in sitemap.xml (add it to PAGES in tools/site/seo.mjs)');
  }

  for (const re of STALE) if (re.test(visible) || ld.some(([, b]) => re.test(b))) fail(page, `stale text ${re}`);
  // No long dashes in the copy (the author reads them as machine-written): use a comma, colon or full stop.
  if (page !== 'Style Directions.html') {
    const at = (visible + ld.map(([, b]) => b).join('')).search(/—/);
    if (at >= 0) { const t = visible + ld.map(([, b]) => b).join(''); fail(page, `long dash in the copy: ...${t.slice(Math.max(0, at - 50), at + 30).replace(/\s+/g, ' ')}...`); }
  }
  if (PAGES_WITH_CLAIMS.includes(page)) {
    for (const c of KEPT_CLAIMS) if (!html.toLowerCase().includes(c.toLowerCase())) fail(page, `kept claim missing: "${c}"`);
  }
}

if (fails.length) { console.error(fails.map((f) => '  FAIL ' + f).join('\n')); console.error(`verify: ${fails.length} failure(s)`); process.exit(1); }
if (warns.length) console.log(`verify: ${warns.length} warning(s) on pages outside the strict set (image sizes)`);
console.log(`verify: ok (${pages().length} pages, ${checkedRefs} local references)`);
