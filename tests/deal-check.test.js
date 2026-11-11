// Run: node tests/deal-check.test.js
import { evaluateDeal, historyLow30 } from '../utils/deal-check.js';

const DAY = 86400000;
const now = Date.UTC(2026, 10, 11);
const fmt = n => `€${n.toFixed(2)}`;
let failed = 0, total = 0;
const eq = (actual, expected, label) => {
  total++;
  if (actual !== expected) { failed++; console.log(`✗ ${label}: got ${actual}, expected ${expected}`); }
};
const status = input => evaluateDeal({ format: fmt, now, ...input })?.status ?? null;

// Store claims -50% from 199, but its own 30-day lowest was 104
eq(status({ current: 99, claimedRegular: 199, lowest30: 104 }), 'inflated', 'inflated vs store 30-day low');
eq(evaluateDeal({ current: 99, claimedRegular: 199, lowest30: 104, format: fmt, now }).detail,
  'Shown as −50%, but only −5% compared to the lowest price of the last 30 days (€104.00).', 'inflated wording');
// Real discount: lowest30 equals the old price
eq(status({ current: 99, claimedRegular: 199, lowest30: 199 }), 'genuine', 'genuine discount');
// "Discount" but it was cheaper recently
eq(status({ current: 120, claimedRegular: 199, lowest30: 100 }), 'notLowest', 'above recent low');
// Claim without any reference
eq(status({ current: 80, claimedRegular: 100 }), 'unverified', 'unverified claim');
// Our own history reveals the fake: tracked at 60 two weeks ago
const history = [{ price: 60, timestamp: now - 14 * DAY }, { price: 100, timestamp: now - 3 * DAY }, { price: 80, timestamp: now }];
eq(status({ current: 80, claimedRegular: 160, history }), 'notLowest', 'history shows it was cheaper');
// History low and lowest-in-30 without claim
const h2 = [{ price: 100, timestamp: now - 20 * DAY }, { price: 90, timestamp: now }];
eq(status({ current: 90, history: h2 }), 'lowest', 'lowest in tracked history');
// Too little history: no verdict without a claim
eq(status({ current: 90, history: [{ price: 100, timestamp: now - 2 * DAY }, { price: 90, timestamp: now }] }), null, 'short history, no claim');
// Nothing to say
eq(status({ current: 50 }), null, 'no signals');
// Nonsense claim (20x) ignored
eq(status({ current: 5, claimedRegular: 500 }), null, 'absurd was-price ignored');
// historyLow30 ignores the latest reading and entries older than 30 days
eq(historyLow30([{ price: 10, timestamp: now - 40 * DAY }, { price: 50, timestamp: now - 5 * DAY }, { price: 40, timestamp: now }], now).price, 50, 'history window');

console.log(`Deal check: ${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
