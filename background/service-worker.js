// Price Drop Tracker - Background Service Worker
// This is a placeholder file created during Session 1
// Will be implemented in Session 6

console.log('Price Drop Tracker: Service worker initialized');

// Basic installation handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Price Drop Tracker: Extension installed/updated', details.reason);

  // Initialize default settings on first install
  if (details.reason === 'install') {
    console.log('First time installation - setting up defaults');
  }
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Price Drop Tracker: Browser started, service worker active');
});
