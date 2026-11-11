#!/usr/bin/env node
/**
 * Cross-platform build (Windows, macOS, Linux) - no dependencies.
 *
 *   node scripts/build.mjs            -> both browsers
 *   node scripts/build.mjs chrome     -> Chrome / Edge / Brave
 *   node scripts/build.mjs firefox    -> Firefox (+ source zip for AMO review)
 *
 * manifest.json is the single source of truth. Browser-specific manifests are
 * generated here, so the two can never drift apart again.
 *
 * Output: dist/<browser>/ (load unpacked) and dist/price-genius-<browser>-v<version>.zip
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const EXTENSION_DIRS = ['assets', 'background', 'content-scripts', 'lib', 'onboarding', 'options', 'popup', 'utils'];
const SOURCE_EXCLUDE = new Set(['.git', 'node_modules', 'dist', 'build', '.DS_Store']);

const baseManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const version = baseManifest.version;

function chromeManifest() {
  const m = structuredClone(baseManifest);
  delete m.browser_specific_settings;
  m.background = { service_worker: 'background/background-wrapper.js', type: 'module' };
  return m;
}

function firefoxManifest() {
  const m = structuredClone(baseManifest);
  // Firefox MV3 uses an event page; ES module imports need type: module
  m.background = { scripts: ['background/background-wrapper.js'], type: 'module' };
  m.permissions = m.permissions.filter(p => p !== 'offscreen');
  return m;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name.endsWith('.bak') || entry.name === 'TODO.md') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function listFiles(dir, base = dir, exclude = new Set()) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (exclude.has(entry.name) || entry.name.endsWith('.zip')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base, exclude));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

// --- minimal ZIP writer (deflate), enough for store uploads -----------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writeZip(zipPath, baseDir, files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  // Fixed timestamp (1 Jan 2024) for reproducible archives
  const dosTime = 0;
  const dosDate = ((2024 - 1980) << 9) | (1 << 5) | 1;

  for (const rel of files) {
    const data = fs.readFileSync(path.join(baseDir, rel));
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const name = Buffer.from(rel, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, body);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);

    offset += local.length + name.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  fs.writeFileSync(zipPath, Buffer.concat([...chunks, centralBuf, end]));
}

// --- build ------------------------------------------------------------------

function build(browser) {
  const outDir = path.join(DIST, browser);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const dir of EXTENSION_DIRS) copyDir(path.join(ROOT, dir), path.join(outDir, dir));

  const manifest = browser === 'firefox' ? firefoxManifest() : chromeManifest();
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const zipPath = path.join(DIST, `price-genius-${browser}-v${version}.zip`);
  const files = listFiles(outDir);
  writeZip(zipPath, outDir, files);
  console.log(`✓ ${browser.padEnd(7)} ${path.relative(ROOT, zipPath)}  (${files.length} files, ${(fs.statSync(zipPath).size / 1024).toFixed(0)} KB)`);

  if (browser === 'firefox') {
    const srcZip = path.join(DIST, `price-genius-firefox-source-v${version}.zip`);
    writeZip(srcZip, ROOT, listFiles(ROOT, ROOT, SOURCE_EXCLUDE));
    console.log(`✓ source  ${path.relative(ROOT, srcZip)}  (for Mozilla reviewers, if asked)`);
  }
}

const targets = process.argv.slice(2).filter(a => ['chrome', 'firefox'].includes(a));
fs.mkdirSync(DIST, { recursive: true });
console.log(`Building Price Genius v${version}`);
for (const target of targets.length ? targets : ['chrome', 'firefox']) build(target);
console.log(`\nLoad unpacked from dist/chrome (chrome://extensions) or dist/firefox (about:debugging).`);
