#!/usr/bin/env node
// Tells Bing (and the other IndexNow engines) which URLs changed, after a deploy:
//
//   node tools/site/indexnow.mjs            submit every URL in sitemap.xml
//   node tools/site/indexnow.mjs --dry-run  print what would be sent
//
// Run it only once the site is live: the engines fetch https://uedevlabs.github.io/176d837cb9accf4d5e5ea9104d00eaae.txt to
// check the key. Google does not use IndexNow; submit sitemap.xml in Search Console instead.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEY = '176d837cb9accf4d5e5ea9104d00eaae';
const HOST = 'uedevlabs.github.io';
const urls = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls };

if (process.argv.includes('--dry-run')) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
});
console.log(`indexnow: ${urls.length} URLs, HTTP ${res.status} ${res.statusText}`);
if (!res.ok) process.exit(1);
