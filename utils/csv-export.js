/**
 * CSV export of tracked products, ready for Excel / Google Sheets / Numbers.
 *
 * Excel opens CSV using the system's list separator: in locales with a
 * decimal comma (Estonia, Germany, …) that is ";" and numbers need "," as
 * decimal mark. We follow the user's locale so the file opens correctly with
 * a double-click.
 */

export function csvFormatForLocale(locale) {
  let decimalComma = false;
  try {
    decimalComma = new Intl.NumberFormat(locale).format(1.5).includes(',');
  } catch (_) { /* default */ }
  return decimalComma ? { delimiter: ';', decimal: ',' } : { delimiter: ',', decimal: '.' };
}

function cell(value, delimiter) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Neutralise spreadsheet formula injection from page titles
  const isNumber = /^-?\d+([.,]\d+)?$/.test(s);
  const safe = !isNumber && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /["\n\r]/.test(safe) || safe.includes(delimiter) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function num(value, decimal) {
  if (typeof value !== 'number' || !isFinite(value)) return '';
  const s = (Math.round(value * 100) / 100).toFixed(2);
  return decimal === ',' ? s.replace('.', ',') : s;
}

function date(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function describeAlertPlain(alert) {
  switch (alert?.mode) {
    case 'any': return 'Any drop';
    case 'below': return `Below ${alert.targetPrice}`;
    case 'percent': return `Drop >= ${alert.percent}%`;
    case 'off': return 'Off';
    default: return 'Default';
  }
}

/**
 * @param {Object} products - map of productId -> product
 * @param {{delimiter?:string, decimal?:string}} format
 * @returns {string} CSV text with a UTF-8 BOM (so Excel keeps õ, ä, € intact)
 */
export function productsToCsv(products, format = { delimiter: ',', decimal: '.' }) {
  const { delimiter, decimal } = format;
  const header = [
    'Product', 'Variant', 'Store', 'URL', 'Current price', 'Currency', 'First tracked price',
    'Lowest price', 'Highest price', 'Change since tracking (%)', 'Availability', 'Alert',
    'Tracking since', 'Last checked', 'Status'
  ];

  const rows = Object.values(products || {})
    .filter(p => p && p.price)
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    .map(p => {
      const history = (p.priceHistory || []).map(h => h.price).filter(v => v > 0);
      const current = p.price.numeric;
      const first = history[0] ?? current;
      const change = first > 0 ? ((current - first) / first) * 100 : 0;
      return [
        p.title,
        p.variant?.label || '',
        (p.domain || '').replace(/^www\./, ''),
        p.url,
        num(current, decimal),
        p.price.currency,
        num(first, decimal),
        num(history.length ? Math.min(...history) : current, decimal),
        num(history.length ? Math.max(...history) : current, decimal),
        num(change, decimal),
        p.availability || '',
        describeAlertPlain(p.alert),
        date(p.tracking?.firstSeen),
        date(p.tracking?.lastChecked),
        p.tracking?.status || ''
      ];
    });

  const lines = [header, ...rows].map(row => row.map(v => cell(v, delimiter)).join(delimiter));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
