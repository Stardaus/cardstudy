import { createElement } from '../../utils/dom.js';

export class ProgressBar {
  /**
   * Creates a new ProgressBar instance.
   * @param {HTMLElement} parentElement - The DOM element to append the progress bar to.
   * @param {number} [initialValue=0] - The initial progress value (0-100).
   */
  constructor(parentElement, initialValue = 0) {
    this.parentElement = parentElement;
    this.value = initialValue;
    this.element = this._createProgressBarElement();
    this.parentElement.appendChild(this.element);
    this.update(initialValue);
  }

  _createProgressBarElement() {
    const progressBarContainer = createElement('div', { class: 'progress-bar-container' });
    this.progressBarFill = createElement('div', { class: 'progress-bar-fill' });
    progressBarContainer.appendChild(this.progressBarFill);
    return progressBarContainer;
  }

  /**
   * Updates the progress bar's value.
   * @param {number} newValue - The new progress value (0-100).
   */
  update(newValue) {
    this.value = Math.max(0, Math.min(100, newValue)); // Clamp value between 0 and 100
    this.progressBarFill.style.width = `${this.value}%`;
  }

  /**
   * Removes the progress bar from the DOM.
   */
  remove() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
