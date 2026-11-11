/**
 * Deal check - "Is this discount real?"
 *
 * Compares the current price with:
 *   - the "was" price the store shows (claimedRegular)
 *   - the lowest price of the last 30 days the store prints next to a
 *     discount (EU Omnibus directive, Art. 6a), when present (lowest30)
 *   - the user's own tracked price history for this product
 *
 * Pure function, shared by popup and on-page panel.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * Lowest tracked price in the 30 days before the latest reading.
 * Requires at least one earlier reading - the latest one is "now".
 */
export function historyLow30(history = [], now = Date.now()) {
  const entries = (history || []).filter(e => e && e.price > 0 && e.timestamp);
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const earlier = sorted.slice(0, -1).filter(e => now - e.timestamp <= 30 * DAY);
  if (earlier.length === 0) return null;
  const low = earlier.reduce((m, e) => (e.price < m.price ? e : m), earlier[0]);
  return { price: low.price, timestamp: low.timestamp, days: Math.max(1, Math.round((now - sorted[0].timestamp) / DAY)) };
}

/**
 * @param {Object} input
 * @param {number} input.current
 * @param {number|null} [input.claimedRegular] - store's "was" price
 * @param {number|null} [input.lowest30] - store's "lowest price in 30 days"
 * @param {Array} [input.history] - tracked [{price, timestamp}]
 * @param {(n:number)=>string} [input.format]
 * @returns {null|{status:'inflated'|'genuine'|'notLowest'|'lowest'|'unverified',
 *                 tone:'good'|'warn'|'neutral', headline:string, detail:string,
 *                 claimedPct:number|null, realPct:number|null, reference:number|null}}
 */
export function evaluateDeal({ current, claimedRegular = null, lowest30 = null, history = [], format = n => n.toFixed(2), now = Date.now() }) {
  if (!(current > 0)) return null;

  const hist = historyLow30(history, now);
  const refs = [];
  if (lowest30 > 0) refs.push({ price: lowest30, source: 'store' });
  if (hist) refs.push({ price: hist.price, source: 'history', timestamp: hist.timestamp });
  const ref = refs.length ? refs.reduce((m, r) => (r.price < m.price ? r : m)) : null;

  const claim = claimedRegular > current * 1.01 && claimedRegular < current * 20 ? claimedRegular : null;
  const claimedPct = claim ? (claim - current) / claim : null;
  const pct = n => `${Math.round(n * 100)}%`;
  const when = ref?.timestamp
    ? new Date(ref.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;
  const refLabel = ref?.source === 'history'
    ? `the ${format(ref.price)} we saw on ${when}`
    : ref ? `the lowest price of the last 30 days (${format(ref.price)})` : '';

  // Current price is above a recent low - the "deal" isn't the best price
  if (ref && current > ref.price * 1.005) {
    return {
      status: 'notLowest',
      tone: 'warn',
      headline: claim ? 'Discount looks inflated' : 'Was cheaper recently',
      detail: ref.source === 'history'
        ? (claim
          ? `Shown as −${pct(claimedPct)}, but we saw it at ${format(ref.price)} on ${when}.`
          : `We saw it at ${format(ref.price)} on ${when}.`)
        : (claim
          ? `Shown as −${pct(claimedPct)}, but it cost ${format(ref.price)} in the last 30 days.`
          : `It cost ${format(ref.price)} in the last 30 days.`),
      claimedPct, realPct: 0, reference: ref.price
    };
  }

  if (claim && ref) {
    const realPct = Math.max(0, (ref.price - current) / ref.price);
    if (claimedPct - realPct >= 0.10 && claimedPct >= 0.05) {
      return {
        status: 'inflated',
        tone: 'warn',
        headline: 'Discount looks inflated',
        detail: realPct >= 0.01
          ? `Shown as −${pct(claimedPct)}, but only −${pct(realPct)} compared to ${refLabel}.`
          : `Shown as −${pct(claimedPct)}, but it's the same as ${refLabel}.`,
        claimedPct, realPct, reference: ref.price
      };
    }
    return {
      status: 'genuine',
      tone: 'good',
      headline: 'Real discount',
      detail: `−${pct(realPct || claimedPct)} compared to ${refLabel}.`,
      claimedPct, realPct, reference: ref.price
    };
  }

  if (claim) {
    return {
      status: 'unverified',
      tone: 'neutral',
      headline: `Store says −${pct(claimedPct)}`,
      detail: `Was ${format(claim)}, according to the store. Track it to see if the discount is real.`,
      claimedPct, realPct: null, reference: null
    };
  }

  // No discount shown: only interesting if this is the lowest we know of,
  // and only when we actually have a window to compare with
  if (ref && current < ref.price * 0.995 && (ref.source === 'store' || (hist && hist.days >= 7))) {
    return {
      status: 'lowest',
      tone: 'good',
      headline: 'Lowest price in 30 days',
      detail: `Cheaper than ${refLabel}.`,
      claimedPct: null, realPct: (ref.price - current) / ref.price, reference: ref.price
    };
  }

  return null;
}
