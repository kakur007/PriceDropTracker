// Privacy Policy Page Script
// Only loads theme setting (no form dependencies)

chrome.storage.local.get(['theme'], (result) => {
  const theme = result.theme || 'light';
  document.body.setAttribute('data-theme', theme);
});
