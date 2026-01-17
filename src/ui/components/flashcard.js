import { $, createElement } from '../../utils/dom.js';

export class FlashcardComponent {
  /**
   * Creates a new FlashcardComponent instance.
   * @param {HTMLElement} parentElement - The DOM element to append the flashcard to.
   * @param {Object} cardData - The data for the card variant to display.
   *   Expected format: { front: string, back: string, type: 'qa'|'cloze' }
   */
  constructor(parentElement, cardData) {
    this.parentElement = parentElement;
    this.cardData = cardData;
    this.isFlipped = false;
    this.element = this._createFlashcardElement();
    this.parentElement.appendChild(this.element);
    this._bindEvents();
  }

  _createFlashcardElement() {
    const cardContainer = createElement('div', { class: `flashcard-container ${this.cardData.type}` });
    const cardInner = createElement('div', { class: 'flashcard-inner' });

    this.cardFront = createElement('div', { class: 'flashcard-face flashcard-front' });
    this.cardFront.innerHTML = this.cardData.front;

    this.cardBack = createElement('div', { class: 'flashcard-face flashcard-back' });
    this.cardBack.innerHTML = this.cardData.back;

    cardInner.appendChild(this.cardFront);
    cardInner.appendChild(this.cardBack);
    cardContainer.appendChild(cardInner);

    return cardContainer;
  }

  _bindEvents() {
    this.element.addEventListener('click', this.flip.bind(this));
  }

  /**
   * Flips the card to show its other side.
   */
  flip() {
    this.isFlipped = !this.isFlipped;
    if (this.isFlipped) {
      this.element.classList.add('is-flipped');
    } else {
      this.element.classList.remove('is-flipped');
    }
  }

  /**
   * Updates the content of the flashcard.
   * @param {Object} newCardData - The new card data.
   */
  update(newCardData) {
    this.cardData = newCardData;
    this.cardFront.innerHTML = this.cardData.front;
    this.cardBack.innerHTML = this.cardData.back;
    this.element.classList.remove('is-flipped'); // Ensure it's unflipped on new card
    this.isFlipped = false;
    this.element.className = `flashcard-container ${this.cardData.type}`; // Update type class
  }

  /**
   * Removes the flashcard from the DOM.
   */
  remove() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
