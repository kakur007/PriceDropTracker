import browser from '../utils/browser-polyfill.js';

document.addEventListener('DOMContentLoaded', () => {
  const getStartedBtn = document.getElementById('getStartedBtn');
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      // Open GoGoNano website
      browser.tabs.create({ url: 'https://www.gogonano.com' });
      // Close the welcome tab
      window.close();
    });
  }
});
