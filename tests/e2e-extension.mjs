#!/usr/bin/env node
/**
 * End-to-end smoke test: loads dist/chrome into Chromium and checks
 *  - service worker boots and schedules the periodic price-check alarm
 *  - auto-detection on a supported store saves the product
 *  - a background refresh (fetch + offscreen parse) reads the price back
 *  - the price picker builds a product from a clicked element
 *  - popup renders (screenshots in dist/screenshots)
 *
 * Run `node scripts/build.mjs chrome` first.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'dist', 'chrome');
const SHOTS = path.join(ROOT, 'dist', 'screenshots');
const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');

if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error('Build first: node scripts/build.mjs chrome');
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });

const STORE_URL = 'https://demo-store.myshopify.com/products/organic-lip-balm';
// activeTab can't be granted by automation (needs a real toolbar click), so the
// picker runs on a store the extension has host access to.
const PICK_URL = 'https://moobel-demo.myshopify.com/products/ergonoomiline-kontoritool-aero';
const fixture = name => fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', name));

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-e2e-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: true,
  channel: 'chromium', // new headless mode; the headless shell can't load extensions
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
});

const requests = [];
await context.route('**/*', route => {
  const url = route.request().url();
  requests.push({ url, cookie: route.request().headers()['cookie'] || '', type: route.request().resourceType() });
  if (url.startsWith('https://demo-store.myshopify.com/')) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture('shopify.html') });
  }
  if (url.startsWith('https://moobel-demo.myshopify.com/')) {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture('no-structured-data.html') });
  }
  if (url.startsWith('chrome-extension://')) return route.continue();
  return route.fulfill({ status: 404, body: '' });
});

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

let [worker] = context.serviceWorkers();
if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
const extId = new URL(worker.url()).host;
check(!!worker, 'service worker started', extId);

await new Promise(r => setTimeout(r, 1500));
const alarms = await worker.evaluate(() => chrome.alarms.getAll());
const priceAlarm = alarms.find(a => a.name === 'price-check');
check(!!priceAlarm, 'periodic price-check alarm scheduled', priceAlarm ? `every ${priceAlarm.periodInMinutes} min` : 'missing');

// Close the onboarding tab opened on install
for (const p of context.pages()) if (p.url().includes('onboarding')) await p.close();

// --- auto detection on a supported store
const page = await context.newPage();
await page.goto(STORE_URL);
let products = {};
for (let i = 0; i < 20 && Object.keys(products).length === 0; i++) {
  await page.waitForTimeout(500);
  products = (await worker.evaluate(() => chrome.storage.local.get('products'))).products || {};
}
const saved = Object.values(products)[0];
check(saved?.price?.numeric === 5.99, 'auto-detected product saved on visit', saved ? `${saved.title} ${saved.price.numeric} ${saved.price.currency}` : 'nothing saved');

// --- background refresh through fetch + offscreen parser
if (saved) {
  const result = await worker.evaluate(async id => {
    const r = await chrome.runtime.sendMessage({ type: 'REFRESH_SINGLE_PRODUCT', data: { productId: id } }).catch(e => ({ error: e.message }));
    return r;
  }, saved.productId).catch(e => ({ error: e.message }));
  // sendMessage from the worker to itself is not delivered; call the checker through the popup page instead
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  const refresh = await popup.evaluate(id => chrome.runtime.sendMessage({ type: 'REFRESH_SINGLE_PRODUCT', data: { productId: id } }), saved.productId);
  const status = refresh?.data?.checkResult?.status;
  check(status === 'no_change', 'background refresh read the same price', `${status} ${refresh?.data?.checkResult?.error || ''}`.trim());
  void result;
  await popup.close();
}

// --- price picker on a store without structured data
const pickPage = await context.newPage();
await pickPage.goto(PICK_URL);
await pickPage.waitForTimeout(300);
// The picker is normally launched from the popup via scripting.executeScript
const popupForPicker = await context.newPage();
await popupForPicker.goto(`chrome-extension://${extId}/popup/popup.html`);
const tabId = await popupForPicker.evaluate(async url => {
  const tabs = await chrome.tabs.query({});
  return tabs.find(t => t.url === url)?.id;
}, PICK_URL);
const injected = await popupForPicker.evaluate(async id => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: id },
      func: async () => {
        const { startPicker } = await import(chrome.runtime.getURL('content-scripts/price-picker.js'));
        startPicker();
      }
    });
    return 'ok';
  } catch (e) {
    return e.message;
  }
}, tabId);
check(injected === 'ok', 'picker injected', injected);
await popupForPicker.close();
await pickPage.bringToFront();
await pickPage.waitForTimeout(500);
const box = await pickPage.locator('.pdp-amount').boundingBox();
await pickPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await pickPage.waitForTimeout(150);
await pickPage.screenshot({ path: path.join(SHOTS, 'picker.png') });
await pickPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
let picked = null;
for (let i = 0; i < 20 && !picked; i++) {
  await pickPage.waitForTimeout(300);
  const all = (await worker.evaluate(() => chrome.storage.local.get('products'))).products || {};
  picked = Object.values(all).find(p => p.domain === 'moobel-demo.myshopify.com' && p.detectionMethod === 'manual');
}
check(picked?.price?.numeric === 249.9 && picked?.detectionMethod === 'manual' && !!picked?.priceSelector,
  'picked price saved with selector', picked ? `${picked.price.numeric} ${picked.price.currency} ${picked.priceSelector}` : 'nothing saved');
await pickPage.screenshot({ path: path.join(SHOTS, 'picker-done.png') });

// --- popup screenshots (light + dark). Seed a price history for the sparkline.
await worker.evaluate(async () => {
  const { products } = await chrome.storage.local.get('products');
  const now = Date.now();
  for (const p of Object.values(products)) {
    const base = p.price.numeric;
    p.priceHistory = [base * 1.2, base * 1.15, base * 1.18, base * 1.05, base].map((price, i) => ({
      price: Math.round(price * 100) / 100, currency: p.price.currency, timestamp: now - (5 - i) * 86400000
    }));
    p.tracking.firstSeen = now - 5 * 86400000;
  }
  await chrome.storage.local.set({ products });
});

for (const scheme of ['light', 'dark']) {
  const popup = await context.newPage();
  await popup.emulateMedia({ colorScheme: scheme });
  await popup.setViewportSize({ width: 400, height: 560 });
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  await popup.waitForTimeout(1200);
  await popup.screenshot({ path: path.join(SHOTS, `popup-${scheme}.png`) });
  const cards = await popup.locator('.card').count();
  check(cards === 2, `popup lists tracked products (${scheme})`, `${cards} cards`);
  await popup.close();
}


// --- safety: old product saved with an add-to-cart URL must never be re-requested,
//     and background checks must not send the user's cookies
await context.addCookies([{ name: 'session', value: 'logged-in', domain: 'demo-store.myshopify.com', path: '/' }]);
const unsafe = await worker.evaluate(async () => {
  const { products } = await chrome.storage.local.get('products');
  const p = Object.values(products).find(x => x.domain === 'demo-store.myshopify.com');
  p.url = p.url + '?add-to-cart=7001&quantity=1';
  p.tracking.status = 'no_permission';
  await chrome.storage.local.set({ products });
  return p.productId;
});
requests.length = 0;
const popupCheck = await context.newPage();
await popupCheck.goto(`chrome-extension://${extId}/popup/popup.html`);
await popupCheck.evaluate(id => chrome.runtime.sendMessage({ type: 'REFRESH_SINGLE_PRODUCT', data: { productId: id } }), unsafe);
const fetched = requests.filter(r => r.url.startsWith('https://demo-store.myshopify.com/'));
check(fetched.length > 0 && fetched.every(r => !/add-to-cart|quantity/.test(r.url)), 'background check strips add-to-cart from saved URL', fetched.map(r => r.url).join(', '));
check(fetched.every(r => !r.cookie.includes('session=')), 'background check sends no cookies', fetched.map(r => r.cookie || '(none)').join(', '));
const after = await worker.evaluate(async id => (await chrome.storage.local.get('products')).products[id], unsafe);
check(!after.url.includes('add-to-cart') && after.tracking.status === 'active', 'stored URL cleaned and "Allow checks" status cleared', `${after.url} ${after.tracking.status}`);
await popupCheck.reload();
await popupCheck.waitForTimeout(800);
const cardText = await popupCheck.locator('body').innerText();
check(!/\bnull\b/.test(cardText) && !cardText.includes('Allow checks'), 'popup shows no "null" and no stale "Allow checks"');
await popupCheck.close();

// --- per-product alert via the popup editor
{
  const pop = await context.newPage();
  await pop.setViewportSize({ width: 400, height: 600 });
  await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
  await pop.waitForTimeout(900);
  const card = pop.locator('.card').first();
  await card.hover();
  await card.locator('button[title="Price alert"]').click();
  await pop.locator('.alert-editor select').selectOption('below');
  await pop.locator('.alert-field input').fill('3.50');
  await pop.screenshot({ path: path.join(SHOTS, 'popup-alert-editor.png') });
  await pop.locator('.alert-editor button:has-text("Save alert")').click();
  await pop.waitForTimeout(500);
  const alerts = await worker.evaluate(async () => Object.values((await chrome.storage.local.get('products')).products).map(p => p.alert).filter(Boolean));
  check(alerts.some(a => a.mode === 'below' && a.targetPrice === 3.5), 'alert saved from popup editor', JSON.stringify(alerts));
  const badge = await pop.locator('.alert-badge').first().innerText().catch(() => '');
  check(/Below/.test(badge), 'alert badge shown on card', badge);
  await pop.screenshot({ path: path.join(SHOTS, 'popup-alert-saved.png') });
  await pop.close();
}

// --- keyboard shortcuts registered, CSV button present
{
  const commands = await worker.evaluate(() => chrome.commands.getAll());
  const names = commands.map(c => `${c.name}=${c.shortcut || '-'}`).join(', ');
  check(commands.some(c => c.name === 'track-page') && commands.some(c => c.name === '_execute_action'), 'keyboard shortcuts registered', names);
  const st = await context.newPage();
  await st.goto(`chrome-extension://${extId}/options/settings.html`);
  await st.waitForTimeout(600);
  const rows = await st.locator('#shortcutList li').count();
  check(rows === 2 && await st.locator('#exportCsvBtn').count() === 1, 'settings lists shortcuts and CSV export', `${rows} shortcuts`);
  const [download] = await Promise.all([st.waitForEvent('download', { timeout: 5000 }).catch(() => null), st.click('#exportCsvBtn')]);
  const csvPath = download ? await download.path() : null;
  const csv = csvPath ? fs.readFileSync(csvPath, 'utf8') : '';
  check(csv.includes('Organic Lip Balm') && csv.split('\n').length >= 3, 'CSV export downloads tracked products', download?.suggestedFilename() || 'no download');
  await st.close();
}

// --- page screenshots
for (const [name, rel] of [['settings', 'options/settings.html'], ['history', 'options/price-history.html'], ['privacy', 'options/privacy-policy.html'], ['welcome', 'onboarding/welcome.html']]) {
  for (const scheme of ['light', 'dark']) {
    const pg = await context.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.emulateMedia({ colorScheme: scheme });
    await pg.setViewportSize({ width: 1100, height: 900 });
    await pg.goto(`chrome-extension://${extId}/${rel}`);
    await pg.waitForTimeout(700);
    await pg.screenshot({ path: path.join(SHOTS, `${name}-${scheme}.png`), fullPage: scheme === 'light' });
    if (scheme === 'light') check(errs.length === 0, `${name} page loads without errors`, errs.join('; '));
    await pg.close();
  }
}

await context.close();
fs.rmSync(userDataDir, { recursive: true, force: true });
console.log(failures ? `\n${failures} check(s) failed` : '\nAll end-to-end checks passed');
process.exit(failures ? 1 : 0);
