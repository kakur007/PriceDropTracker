import browser from '../utils/browser-polyfill.js';

document.addEventListener('DOMContentLoaded', () => {
  const getStartedBtn = document.getElementById('getStartedBtn');
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      // Open a popular shopping site to get the user started
      browser.tabs.create({ url: 'https://www.amazon.com' });
      // Close the welcome tab
      window.close();
    });
  }
});
