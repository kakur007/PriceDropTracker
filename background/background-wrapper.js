/**
 * Background Service Worker Wrapper
 *
 * With manifest "type": "module", this file can use static ES6 imports.
 * This works in both Chrome MV3 and modern Firefox MV3.
 */

import { debug } from '../utils/debug.js';

debug('[Service Worker]', 'Starting background script...');

// Static import - works with type: "module" in manifest
import './service-worker.js';

debug('[Service Worker]', 'Module loaded successfully');
