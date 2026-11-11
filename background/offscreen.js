import browser from '../utils/browser-polyfill.js';
import { extractPriceForRefresh } from '../utils/page-extractor.js';
import { debug, debugError } from '../utils/debug.js';

/**
 * Offscreen Document - DOM parsing for the Chrome service worker
 *
 * Service workers have no DOMParser, so the worker sends fetched HTML here.
 * Extraction logic is shared with the content script and Firefox background
 * via utils/page-extractor.js.
 */

function parseHTMLForPrice(html, contextData = {}, hints = {}) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return extractPriceForRefresh(doc, contextData, hints);
  } catch (error) {
    debugError('[offscreen]', 'Error parsing HTML:', error);
    return { success: false, error: error.message };
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PARSE_HTML') {
    sendResponse(parseHTMLForPrice(message.html, message.contextData || {}, message.hints || {}));
    return true;
  }
  return false;
});

debug('[offscreen]', 'Offscreen document ready');
