// Run: node tests/csv-export.test.js
import { productsToCsv, csvFormatForLocale } from '../utils/csv-export.js';

const products = {
  a: {
    title: '=HYPERLINK("evil")', domain: 'www.pesu.ee', url: 'https://pesu.ee/p',
    variant: { label: '60 pesukorda' }, price: { numeric: 78.45, currency: 'EUR' },
    priceHistory: [{ price: 89 }, { price: 78.45 }], tracking: { firstSeen: 0 }, alert: { mode: 'below', targetPrice: 70 }
  },
  b: { title: 'Mug, "large"; blue', domain: 'shop.com', url: 'https://shop.com/m', price: { numeric: 10, currency: 'USD' }, priceHistory: [] }
};

let failed = 0;
const check = (ok, label) => { if (!ok) { failed++; console.log('✗', label); } };

const eu = productsToCsv(products, csvFormatForLocale('et-EE'));
check(eu.startsWith('﻿'), 'BOM present');
check(eu.includes(';78,45;EUR;89,00;'), 'EU decimals and separator');
check(eu.includes(';-11,85;'), 'negative numbers not quoted as text');
check(eu.includes(`"'=HYPERLINK(""evil"")"`), 'formula injection neutralised');
check(eu.includes('"Mug, ""large""; blue"'), 'quotes and separators escaped');

const us = productsToCsv(products, csvFormatForLocale('en-US'));
check(us.includes(',78.45,EUR,89.00,'), 'US decimals and separator');

console.log(`CSV export: ${failed ? 'FAILED' : '6/6 passed'}`);
process.exit(failed ? 1 : 0);
