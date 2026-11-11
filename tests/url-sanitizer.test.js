// Run: node tests/url-sanitizer.test.js
import { sanitizeProductUrl } from '../utils/url-sanitizer.js';

const cases = [
  ['https://shop.com/product/vase/?add-to-cart=77', 'https://shop.com/product/vase/'],
  ['https://shop.com/product/vase/?add-to-cart=77&quantity=2&utm_source=x#reviews', 'https://shop.com/product/vase/'],
  ['https://shop.com/p/1?action=add&_wpnonce=abc', 'https://shop.com/p/1'],
  ['https://www.ebay.com/itm/123456?_trkparms=abc&hash=item1', 'https://www.ebay.com/itm/123456'],
  ['https://shop.ee/index.php?route=checkout/cart/add&product_id=5', null],
  ['https://shop.ee/index.php?route=product/product&product_id=5', 'https://shop.ee/index.php?route=product/product&product_id=5'],
  ['https://store.com/cart', null],
  ['https://m.com/checkout/cart/add/product/12/', null],
  ['https://s.myshopify.com/products/x?variant=123', 'https://s.myshopify.com/products/x?variant=123'],
  ['https://amazon.com/dp/B0X?ref=sr_1&tag=aff-20&th=1', 'https://amazon.com/dp/B0X?th=1'],
  ['javascript:alert(1)', null]
];

let failed = 0;
for (const [input, expected] of cases) {
  const actual = sanitizeProductUrl(input);
  if (actual !== expected) {
    failed++;
    console.log(`✗ ${input}\n    got ${actual}, expected ${expected}`);
  }
}
console.log(`URL sanitizer: ${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
