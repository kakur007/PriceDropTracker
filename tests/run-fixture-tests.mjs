#!/usr/bin/env node
/**
 * Detection fixture tests - runs the real detector in a real browser.
 *
 * Each fixture is served under a realistic store URL (requests are routed
 * locally, nothing hits the network). The test checks:
 *   1. live detection (what the user sees when tracking)
 *   2. background refresh on the same HTML (what later price checks see)
 *
 * Requires Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).
 * Skips with a notice when Playwright is not available.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');

let chromium;
try {
  chromium = createRequire(path.join(ROOT, 'package.json'))('playwright').chromium;
} catch (_) {
  try {
    chromium = createRequire(import.meta.url)('playwright').chromium;
  } catch (__) {
    console.log('⚠ Playwright not installed - skipping browser fixture tests.');
    process.exit(0);
  }
}

const CASES = [
  {
    name: 'JSON-LD with comments, raw newlines, trailing commas, priceSpecification',
    fixture: 'dirty-jsonld.html',
    url: 'https://www.laufladen-demo.de/trail-runner-x-4711',
    expect: { numeric: 149, currency: 'EUR', title: 'Trail Runner X', regularPrice: 189 }
  },
  {
    name: 'No structured data, localized button, slug URL (heuristics)',
    fixture: 'no-structured-data.html',
    url: 'https://www.moobel-demo.ee/kontoritoolid/ergonoomiline-kontoritool-aero-must',
    expect: { numeric: 249.9, currency: 'EUR', method: 'heuristic' },
    refreshFromSelector: true
  },
  {
    name: 'Shopify product JSON in cents (sub-$10 item)',
    fixture: 'shopify.html',
    url: 'https://demo-store.myshopify.com/products/organic-lip-balm',
    expect: { numeric: 5.99, currency: 'USD', title: 'Organic Lip Balm', regularPrice: 7.99 }
  },
  {
    name: 'Microdata with nested related product',
    fixture: 'microdata-nested.html',
    url: 'https://www.kitchen-demo.co.uk/kettles/stainless-steel-kettle',
    expect: { numeric: 39.99, currency: 'GBP' }
  },
  {
    name: 'ProductGroup variant chosen from URL',
    fixture: 'product-group.html',
    url: 'https://shop.example.se/vinterjacka-nord?size=m',
    expect: { numeric: 1299, currency: 'SEK' }
  },
  {
    name: 'Category page is not tracked automatically',
    fixture: 'category.html',
    url: 'https://www.shoes-demo.com/c/shoes',
    expect: null
  },
  {
    name: 'WooCommerce sale price (platform adapter still used)',
    fixture: 'woocommerce.html',
    url: 'https://studio-demo.com/product/ceramic-vase/',
    expect: { numeric: 36, currency: 'USD', method: 'siteAdapter' }
  },
  {
    name: 'OpenCart special price (platform adapter still used)',
    fixture: 'opencart.html',
    url: 'https://www.audio-demo.ee/korvaklapid-x200',
    expect: { numeric: 79.9, currency: 'EUR', method: 'siteAdapter' }
  },
  {
    name: 'Price rendered late by JavaScript',
    fixture: 'late-price.html',
    url: 'https://www.gadgets-demo.com/smart-gadget-pro',
    waitMs: 1800,
    expect: { numeric: 129.99, currency: 'USD' }
  }
];

const browser = await chromium.launch();
const context = await browser.newContext();

await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.pathname.startsWith('/__ext/')) {
    const file = path.join(ROOT, url.pathname.slice('/__ext/'.length));
    if (fs.existsSync(file)) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
    }
    return route.fulfill({ status: 404, body: '' });
  }
  const testCase = CASES.find(c => new URL(c.url).hostname === url.hostname);
  if (testCase && route.request().resourceType() === 'document') {
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(FIXTURES, testCase.fixture)) });
  }
  return route.fulfill({ status: 404, body: '' });
});

let failed = 0;

for (const testCase of CASES) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(testCase.url);
  if (testCase.waitMs) await page.waitForTimeout(testCase.waitMs);

  const result = await page.evaluate(async ({ refreshFromSelector }) => {
    const detector = await import('/__ext/content-scripts/product-detector.js');
    const extractor = await import('/__ext/utils/page-extractor.js');
    const product = await detector.detectProduct({ mode: 'auto' });

    let refresh = null;
    if (product) {
      // Simulate the background: fresh HTML, no layout, no JS
      const html = document.documentElement.outerHTML;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      refresh = extractor.extractPriceForRefresh(doc, {
        url: location.href,
        domain: location.hostname,
        locale: product.price.locale,
        expectedCurrency: product.price.currency
      }, {
        priceSelector: refreshFromSelector ? product.priceSelector : product.priceSelector,
        detectionMethod: product.detectionMethod
      });
    }
    return {
      product: product && {
        title: product.title,
        numeric: product.price.numeric,
        currency: product.price.currency,
        regularPrice: product.price.regularPrice || null,
        method: product.detectionMethod,
        selector: product.priceSelector || null
      },
      refresh
    };
  }, { refreshFromSelector: !!testCase.refreshFromSelector });

  const problems = [];
  const p = result.product;
  const e = testCase.expect;

  if (e === null) {
    if (p) problems.push(`expected no product, got ${p.numeric} ${p.currency} (${p.method})`);
  } else if (!p) {
    problems.push('no product detected');
  } else {
    if (Math.abs(p.numeric - e.numeric) > 0.001) problems.push(`price ${p.numeric} != ${e.numeric} (via ${p.method})`);
    if (p.currency !== e.currency) problems.push(`currency ${p.currency} != ${e.currency}`);
    if (e.title && p.title !== e.title) problems.push(`title "${p.title}" != "${e.title}"`);
    if (e.method && p.method !== e.method) problems.push(`method ${p.method} != ${e.method}`);
    if (e.regularPrice && Math.abs((p.regularPrice || 0) - e.regularPrice) > 0.001) problems.push(`regularPrice ${p.regularPrice} != ${e.regularPrice}`);
    if (!testCase.waitMs) {
      if (!result.refresh?.success) problems.push(`background refresh failed: ${result.refresh?.error}`);
      else if (Math.abs(result.refresh.price - e.numeric) > 0.001) problems.push(`background refresh read ${result.refresh.price} (${result.refresh.detectionMethod})`);
    }
  }
  if (errors.length) problems.push(`page errors: ${errors.join('; ')}`);

  if (problems.length) {
    failed++;
    console.log(`✗ ${testCase.name}\n    ${problems.join('\n    ')}`);
  } else {
    const detail = p ? `${p.numeric} ${p.currency} via ${p.method}${result.refresh ? `, refresh via ${result.refresh.detectionMethod}` : ''}` : 'skipped as expected';
    console.log(`✓ ${testCase.name}  (${detail})`);
  }
  await page.close();
}

await browser.close();
console.log(`\n${CASES.length - failed}/${CASES.length} fixture tests passed`);
process.exit(failed ? 1 : 0);
