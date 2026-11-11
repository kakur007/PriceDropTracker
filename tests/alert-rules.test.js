// Run: node tests/alert-rules.test.js
import { shouldNotifyDrop, shouldNotifyBackInStock, normalizeAvailability, sanitizeAlert } from '../utils/alert-rules.js';

const settings = { notifications: { enabled: true, minDropPercentage: 10 } };
const p = alert => ({ productId: 'x', alert });
let failed = 0, total = 0;
const eq = (actual, expected, label) => {
  total++;
  if (actual !== expected) { failed++; console.log(`✗ ${label}: got ${actual}, expected ${expected}`); }
};

eq(shouldNotifyDrop(p(), 100, 95, settings).notify, false, 'default: 5% < global 10%');
eq(shouldNotifyDrop(p(), 100, 89, settings).notify, true, 'default: 11% >= global 10%');
eq(shouldNotifyDrop(p({ mode: 'any' }), 100, 99.5, settings).notify, true, 'any drop');
eq(shouldNotifyDrop(p({ mode: 'any' }), 100, 101, settings).notify, false, 'increase never notifies');
eq(shouldNotifyDrop(p({ mode: 'off' }), 100, 50, settings).notify, false, 'off');
eq(shouldNotifyDrop(p({ mode: 'below', targetPrice: 80 }), 100, 85, settings).notify, false, 'below: above target');
eq(shouldNotifyDrop(p({ mode: 'below', targetPrice: 80 }), 100, 80, settings).notify, true, 'below: exactly target');
eq(shouldNotifyDrop(p({ mode: 'percent', percent: 3 }), 100, 96, settings).notify, true, 'percent 3%');
eq(shouldNotifyDrop(p({ mode: 'any' }), 100, 50, { notifications: { enabled: false } }).notify, false, 'global off wins');
eq(shouldNotifyBackInStock(p(), settings), true, 'back in stock default on');
eq(shouldNotifyBackInStock(p({ mode: 'default', backInStock: false }), settings), false, 'back in stock disabled');
eq(shouldNotifyBackInStock(p({ mode: 'off' }), settings), false, 'off disables restock too');
eq(normalizeAvailability('https://schema.org/OutOfStock'), 'OutOfStock', 'schema OutOfStock');
eq(normalizeAvailability('http://schema.org/InStock'), 'InStock', 'schema InStock');
eq(normalizeAvailability('unavailable'), 'OutOfStock', 'unavailable is out');
eq(normalizeAvailability('PreOrder'), 'InStock', 'preorder counts as available');
eq(normalizeAvailability(''), null, 'empty');
eq(sanitizeAlert({ mode: 'below', targetPrice: '49.999' }).targetPrice, 50, 'target rounded');
let threw = false; try { sanitizeAlert({ mode: 'below', targetPrice: 0 }); } catch (_) { threw = true; }
eq(threw, true, 'invalid target rejected');
eq(sanitizeAlert({ mode: 'weird' }).mode, 'default', 'unknown mode -> default');

console.log(`Alert rules: ${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
