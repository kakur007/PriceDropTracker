/**
 * Debounce Utility
 * Delays function execution until after a specified wait time has elapsed
 * since the last time it was invoked
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @returns {Function} The debounced function
 *
 * @example
 * const debouncedSave = debounce(saveSettings, 300);
 * input.addEventListener('change', debouncedSave);
 */
export function debounce(func, wait) {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Creates a debounced function with immediate execution option
 * If immediate is true, trigger the function on the leading edge, instead of the trailing
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @param {boolean} immediate - Whether to execute on the leading edge
 * @returns {Function} The debounced function
 */
export function debounceImmediate(func, wait, immediate = false) {
  let timeout;

  return function executedFunction(...args) {
    const callNow = immediate && !timeout;

    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
}
