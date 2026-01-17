import { $, createElement } from '../../utils/dom.js';

export class Toast {
  /**
   * Displays a toast notification.
   * @param {string} message - The message to display.
   * @param {'success'|'error'|'info'} [type='info'] - The type of toast.
   * @param {number} [duration=3000] - How long the toast should be visible in milliseconds.
   */
  static show(message, type = 'info', duration = 3000) {
    let toastContainer = $('#toast-container');
    if (!toastContainer) {
      toastContainer = createElement('div', { id: 'toast-container' });
      document.body.appendChild(toastContainer);
    }

    const toast = createElement('div', { class: `toast toast-${type}` }, [message]);
    toastContainer.appendChild(toast);

    // Force reflow to ensure CSS transition is applied
    toast.offsetWidth;

    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
  }
}
