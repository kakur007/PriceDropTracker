/**
 * Toast Notification Utility
 * Provides non-intrusive user feedback messages
 */

let toastContainer = null;

/**
 * Initialize toast container
 */
function initToastContainer() {
  if (toastContainer) return;

  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.setAttribute('aria-live', 'polite');
  toastContainer.setAttribute('aria-atomic', 'true');

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }

    .toast {
      min-width: 250px;
      max-width: 400px;
      padding: 14px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }

    .toast-success {
      background: #16a34a;
      color: white;
    }

    .toast-error {
      background: #dc2626;
      color: white;
    }

    .toast-warning {
      background: #f59e0b;
      color: white;
    }

    .toast-info {
      background: #2563eb;
      color: white;
    }

    .toast-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
    }

    .toast-close {
      background: none;
      border: none;
      color: inherit;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      margin-left: 8px;
      opacity: 0.8;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }

    .toast-close:hover {
      opacity: 1;
    }

    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast.fade-out {
      animation: fadeOut 0.3s ease forwards;
    }

    @keyframes fadeOut {
      to {
        opacity: 0;
        transform: translateX(20px);
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(toastContainer);
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds (0 for no auto-dismiss)
 * @returns {HTMLElement} The toast element
 */
export function showToast(message, type = 'info', duration = 3000) {
  initToastContainer();

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  // Create icon span
  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = icons[type] || icons.info;

  // Create message span
  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message; // textContent auto-escapes

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Close notification');
  closeBtn.textContent = '×';

  // Append all elements
  toast.appendChild(iconSpan);
  toast.appendChild(messageSpan);
  toast.appendChild(closeBtn);

  // Close button handler
  closeBtn.addEventListener('click', () => {
    dismissToast(toast);
  });

  toastContainer.appendChild(toast);

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }

  return toast;
}

/**
 * Dismiss a toast notification
 * @param {HTMLElement} toast - The toast element to dismiss
 */
function dismissToast(toast) {
  toast.classList.add('fade-out');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

/**
 * Show a success toast
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds
 */
export function showSuccess(message, duration = 3000) {
  return showToast(message, 'success', duration);
}

/**
 * Show an error toast
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds (0 for no auto-dismiss)
 */
export function showError(message, duration = 5000) {
  return showToast(message, 'error', duration);
}

/**
 * Show a warning toast
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds
 */
export function showWarning(message, duration = 4000) {
  return showToast(message, 'warning', duration);
}

/**
 * Show an info toast
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds
 */
export function showInfo(message, duration = 3000) {
  return showToast(message, 'info', duration);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Clear all toasts
 */
export function clearAllToasts() {
  if (toastContainer) {
    toastContainer.innerHTML = '';
  }
}
