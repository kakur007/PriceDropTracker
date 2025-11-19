/**
 * Background Service Worker Wrapper
 *
 * With manifest "type": "module", this file can use static ES6 imports.
 * This works in both Chrome MV3 and modern Firefox MV3.
 */

console.log('[Service Worker] Starting background script...');

// Static import - works with type: "module" in manifest
import './service-worker.js';

console.log('[Service Worker] Module loaded successfully');
