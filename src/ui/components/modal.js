import { $, createElement } from '../../utils/dom.js';

export class Modal {
  constructor(id = 'app-modal') {
    this.id = id;
    this.modalElement = $(`#${this.id}`);
    if (!this.modalElement) {
      this._createModalElement();
    }
    this._bindEvents();
  }

  _createModalElement() {
    this.modalElement = createElement('div', { id: this.id, class: 'modal' }, [
      createElement('div', { class: 'modal-content' }, [
        createElement('span', { class: 'close-button' }, ['&times;']),
        createElement('div', { class: 'modal-body' }),
      ]),
    ]);
    document.body.appendChild(this.modalElement);
  }

  _bindEvents() {
    const closeButton = $('.close-button', this.modalElement);
    if (closeButton) {
      closeButton.addEventListener('click', this.hide.bind(this));
    }
    this.modalElement.addEventListener('click', (event) => {
      if (event.target === this.modalElement) {
        this.hide();
      }
    });
  }

  /**
   * Displays the modal with the given content.
   * @param {HTMLElement|string} content - The content to display inside the modal body.
   * @param {string} [title=''] - Optional title for the modal.
   */
  show(content, title = '') {
    const modalBody = $('.modal-body', this.modalElement);
    const modalTitle = $('.modal-title', this.modalElement); // Assuming a title element might exist

    if (modalBody) {
      modalBody.innerHTML = ''; // Clear previous content
      if (typeof content === 'string') {
        modalBody.innerHTML = content;
      } else {
        modalBody.appendChild(content);
      }
    }

    // If there's a title element, set it
    if (modalTitle) {
      modalTitle.textContent = title;
    }

    this.modalElement.style.display = 'block';
  }

  /**
   * Hides the modal.
   */
  hide() {
    this.modalElement.style.display = 'none';
  }
}
