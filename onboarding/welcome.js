import browser from '../utils/browser-polyfill.js';
import { initTheme } from '../utils/theme.js';

initTheme();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('getStartedBtn')?.addEventListener('click', () => {
    window.close();
  });

  document.getElementById('openSettingsBtn')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
});
