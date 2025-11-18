import browser from '../utils/browser-polyfill.js';

// Privacy Policy Page Script
// Only loads theme setting (no form dependencies)

browser.storage.local.get(['theme'], (result) => {
  const theme = result.theme || 'light';
  document.body.setAttribute('data-theme', theme);
});
