/**
 * Theme helper shared by extension pages (popup has its own copy of the
 * same logic). Preference is stored as 'system' | 'light' | 'dark'.
 */
import browser from './browser-polyfill.js';

const media = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

export function resolveTheme(pref) {
  if (pref === 'dark' || pref === 'light') return pref;
  return media?.matches ? 'dark' : 'light';
}

export function applyTheme(pref = 'system') {
  document.body.dataset.pref = pref;
  document.body.dataset.theme = resolveTheme(pref);
}

export async function getThemePreference() {
  try {
    return (await browser.storage.local.get('theme')).theme || 'system';
  } catch (_) {
    return 'system';
  }
}

export async function setThemePreference(pref) {
  applyTheme(pref);
  try {
    await browser.storage.local.set({ theme: pref });
  } catch (_) { /* ignore */ }
}

/** Apply stored theme now and keep following system / other pages. */
export async function initTheme() {
  applyTheme(await getThemePreference());
  media?.addEventListener('change', () => applyTheme(document.body.dataset.pref));
  browser?.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes.theme) applyTheme(changes.theme.newValue || 'system');
  });
}
