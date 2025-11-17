/**
 * Currency Parser Test Suite
 * Comprehensive tests for multi-currency price parsing
 * Run in browser console or with Node.js
 */

import { parsePrice } from '../utils/currency-parser.js';

const tests = [
  // ===== US FORMAT (10 tests) =====
  {
    name: "US Dollar - simple",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "USD", confidence: 0.75 },
    context: {}
  },
  {
    name: "US Dollar - with thousands",
    input: "$1,299.99",
    expected: { numeric: 1299.99, currency: "USD", confidence: 0.75 },
    context: {}
  },
  {
    name: "US Dollar - with prefix",
    input: "US$99.99",
    expected: { numeric: 99.99, currency: "USD", confidence: 0.85 },
    context: {}
  },
  {
    name: "US Dollar - ISO code after",
    input: "99.99 USD",
    expected: { numeric: 99.99, currency: "USD", confidence: 0.95 },
    context: {}
  },
  {
    name: "US Dollar - cents only",
    input: "$0.99",
    expected: { numeric: 0.99, currency: "USD", confidence: 0.75 },
    context: {}
  },
  {
    name: "US Dollar - large amount",
    input: "$9,999,999.99",
    expected: { numeric: 9999999.99, currency: "USD", confidence: 0.75 },
    context: {}
  },
  {
    name: "US Dollar - with Price: prefix",
    input: "Price: $99.99",
    expected: { numeric: 99.99, currency: "USD", confidence: 0.75 },
    context: {}
  },
  {
    name: "US Dollar - with context domain",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "USD", confidence: 0.85 },
    context: { domain: "amazon.com" }
  },
  {
    name: "US Dollar - whole number",
    input: "$99",
    expected: { numeric: 99, currency: "USD", confidence: 0.75 },
    context: {}
  },
  {
    name: "US Dollar - with Sale: prefix",
    input: "Sale: $49.99",
    expected: { numeric: 49.99, currency: "USD", confidence: 0.75 },
    context: {}
  },

  // ===== EUROPEAN FORMAT (10 tests) =====
  {
    name: "Euro - simple",
    input: "99,99 €",
    expected: { numeric: 99.99, currency: "EUR", confidence: 0.90 },
    context: {}
  },
  {
    name: "Euro - with thousands",
    input: "1.299,99 €",
    expected: { numeric: 1299.99, currency: "EUR", confidence: 0.90 },
    context: {}
  },
  {
    name: "Euro - symbol first",
    input: "€99,99",
    expected: { numeric: 99.99, currency: "EUR", confidence: 0.90 },
    context: {}
  },
  {
    name: "Euro - ISO code",
    input: "EUR 99,99",
    expected: { numeric: 99.99, currency: "EUR", confidence: 0.95 },
    context: {}
  },
  {
    name: "Euro - ISO code after",
    input: "99,99 EUR",
    expected: { numeric: 99.99, currency: "EUR", confidence: 0.95 },
    context: {}
  },
  {
    name: "Euro - German format",
    input: "1.299,99 €",
    expected: { numeric: 1299.99, currency: "EUR", confidence: 0.90 },
    context: { domain: "amazon.de", locale: "de-DE" }
  },
  {
    name: "Euro - French format with space",
    input: "1 299,99 €",
    expected: { numeric: 1299.99, currency: "EUR", confidence: 0.90 },
    context: { locale: "fr-FR" }
  },
  {
    name: "Euro - large amount",
    input: "9.999.999,99 €",
    expected: { numeric: 9999999.99, currency: "EUR", confidence: 0.90 },
    context: {}
  },
  {
    name: "Euro - cents only",
    input: "€0,99",
    expected: { numeric: 0.99, currency: "EUR", confidence: 0.90 },
    context: {}
  },
  {
    name: "Euro - whole number",
    input: "€99",
    expected: { numeric: 99, currency: "EUR", confidence: 0.90 },
    context: {}
  },

  // ===== UK FORMAT (5 tests) =====
  {
    name: "British Pound - simple",
    input: "£99.99",
    expected: { numeric: 99.99, currency: "GBP", confidence: 0.90 },
    context: {}
  },
  {
    name: "British Pound - with thousands",
    input: "£1,299.99",
    expected: { numeric: 1299.99, currency: "GBP", confidence: 0.90 },
    context: {}
  },
  {
    name: "British Pound - ISO code",
    input: "GBP 99.99",
    expected: { numeric: 99.99, currency: "GBP", confidence: 0.95 },
    context: {}
  },
  {
    name: "British Pound - with context",
    input: "£99.99",
    expected: { numeric: 99.99, currency: "GBP", confidence: 0.95 },
    context: { domain: "amazon.co.uk", locale: "en-GB" }
  },
  {
    name: "British Pound - large amount",
    input: "£9,999.99",
    expected: { numeric: 9999.99, currency: "GBP", confidence: 0.90 },
    context: {}
  },

  // ===== JAPANESE YEN (5 tests) =====
  {
    name: "Japanese Yen - simple",
    input: "¥9,999",
    expected: { numeric: 9999, currency: "JPY", confidence: 0.75 },
    context: { domain: "amazon.co.jp" }
  },
  {
    name: "Japanese Yen - large amount",
    input: "¥99,999",
    expected: { numeric: 99999, currency: "JPY", confidence: 0.75 },
    context: { locale: "ja-JP" }
  },
  {
    name: "Japanese Yen - ISO code",
    input: "JPY 9999",
    expected: { numeric: 9999, currency: "JPY", confidence: 0.95 },
    context: {}
  },
  {
    name: "Japanese Yen - very large",
    input: "¥1,000,000",
    expected: { numeric: 1000000, currency: "JPY", confidence: 0.75 },
    context: { domain: "amazon.co.jp" }
  },
  {
    name: "Japanese Yen - no separator",
    input: "¥9999",
    expected: { numeric: 9999, currency: "JPY", confidence: 0.75 },
    context: { locale: "ja-JP" }
  },

  // ===== NORDIC CURRENCIES (5 tests) =====
  {
    name: "Swedish Krona - simple",
    input: "99,99 kr",
    expected: { numeric: 99.99, currency: "SEK", confidence: 0.75 },
    context: { domain: "example.se" }
  },
  {
    name: "Swedish Krona - with space thousands",
    input: "1 299,99 kr",
    expected: { numeric: 1299.99, currency: "SEK", confidence: 0.75 },
    context: { locale: "sv-SE" }
  },
  {
    name: "Swedish Krona - ISO code",
    input: "SEK 99.99",
    expected: { numeric: 99.99, currency: "SEK", confidence: 0.95 },
    context: {}
  },
  {
    name: "Norwegian Krone - with context",
    input: "99,99 kr",
    expected: { numeric: 99.99, currency: "NOK", confidence: 0.80 },
    context: { domain: "example.no", locale: "nb-NO" }
  },
  {
    name: "Danish Krone - ISO format",
    input: "99.99 DKK",
    expected: { numeric: 99.99, currency: "DKK", confidence: 0.95 },
    context: {}
  },

  // ===== OTHER CURRENCIES (5 tests) =====
  {
    name: "Indian Rupee",
    input: "₹99.99",
    expected: { numeric: 99.99, currency: "INR", confidence: 0.90 },
    context: {}
  },
  {
    name: "Brazilian Real",
    input: "R$99,99",
    expected: { numeric: 99.99, currency: "BRL", confidence: 0.90 },
    context: {}
  },
  {
    name: "Russian Ruble",
    input: "99,99 ₽",
    expected: { numeric: 99.99, currency: "RUB", confidence: 0.90 },
    context: {}
  },
  {
    name: "Australian Dollar - with context",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "AUD", confidence: 0.85 },
    context: { domain: "amazon.com.au" }
  },
  {
    name: "Canadian Dollar - with context",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "CAD", confidence: 0.85 },
    context: { domain: "amazon.ca" }
  },

  // ===== AMBIGUOUS CASES (7 tests) =====
  {
    name: "Dollar - disambiguate to CAD",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "CAD", confidence: 0.80 },
    context: { domain: "amazon.ca" }
  },
  {
    name: "Dollar - disambiguate to AUD",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "AUD", confidence: 0.80 },
    context: { domain: "example.com.au" }
  },
  {
    name: "Yen - disambiguate to JPY",
    input: "¥9,999",
    expected: { numeric: 9999, currency: "JPY", confidence: 0.80 },
    context: { locale: "ja-JP" }
  },
  {
    name: "Yen - disambiguate to CNY",
    input: "¥99.99",
    expected: { numeric: 99.99, currency: "CNY", confidence: 0.80 },
    context: { locale: "zh-CN" }
  },
  {
    name: "Kr - disambiguate to SEK",
    input: "99.99 kr",
    expected: { numeric: 99.99, currency: "SEK", confidence: 0.75 },
    context: { domain: "example.se" }
  },
  {
    name: "Dollar - with expected currency",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "SGD", confidence: 0.80 },
    context: { expectedCurrency: "SGD" }
  },
  {
    name: "Hong Kong Dollar",
    input: "$99.99",
    expected: { numeric: 99.99, currency: "HKD", confidence: 0.80 },
    context: { domain: "example.com.hk" }
  },

  // ===== EDGE CASES (8 tests) =====
  {
    name: "FREE price",
    input: "FREE",
    expected: { numeric: 0, confidence: 0.5 },
    context: {}
  },
  {
    name: "Call for price - returns null",
    input: "Call for price",
    expected: null,
    context: {}
  },
  {
    name: "Price range - takes lowest",
    input: "€99.99 - €149.99",
    expected: { numeric: 99.99, currency: "EUR", confidence: 0.85 },
    context: {}
  },
  {
    name: "Empty string - returns null",
    input: "",
    expected: null,
    context: {}
  },
  {
    name: "Invalid text - returns null",
    input: "Invalid text abc",
    expected: null,
    context: {}
  },
  {
    name: "Zero price",
    input: "$0.00",
    expected: { numeric: 0, currency: "USD", confidence: 0.75 },
    context: {}
  },
  {
    name: "Price with Was: prefix",
    input: "Was: £149.99 Now: £99.99",
    expected: { numeric: 149.99, currency: "GBP", confidence: 0.85 },
    context: {}
  },
  {
    name: "Null input - returns null",
    input: null,
    expected: null,
    context: {}
  }
];

// Run tests
console.log("=================================");
console.log("Currency Parser Test Suite");
console.log("=================================\n");

let passed = 0;
let failed = 0;
const failures = [];

tests.forEach((test, index) => {
  const result = parsePrice(test.input, test.context);

  // Handle null expectations
  if (test.expected === null) {
    if (result === null) {
      passed++;
      console.log(`✅ ${index + 1}. ${test.name}`);
    } else {
      failed++;
      console.log(`❌ ${index + 1}. ${test.name}`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Expected: null`);
      console.log(`   Got:`, result);
      failures.push(test.name);
    }
    return;
  }

  // Check numeric value, currency, and confidence
  const numericMatch = result && Math.abs(result.numeric - test.expected.numeric) < 0.01;
  const currencyMatch = !test.expected.currency || (result && result.currency === test.expected.currency);
  const confidenceMatch = !test.expected.confidence || (result && result.confidence >= test.expected.confidence - 0.15);

  if (numericMatch && currencyMatch && confidenceMatch) {
    passed++;
    console.log(`✅ ${index + 1}. ${test.name}`);
  } else {
    failed++;
    console.log(`❌ ${index + 1}. ${test.name}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Context:`, test.context);
    console.log(`   Expected:`, test.expected);
    console.log(`   Got:`, result);

    if (!numericMatch) console.log(`   ⚠️  Numeric mismatch`);
    if (!currencyMatch) console.log(`   ⚠️  Currency mismatch`);
    if (!confidenceMatch) console.log(`   ⚠️  Confidence too low`);

    failures.push(test.name);
  }
});

console.log("\n=================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`Success rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
console.log("=================================");

if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(name => console.log(`  - ${name}`));
}

// Export for use in other modules
export { tests };
