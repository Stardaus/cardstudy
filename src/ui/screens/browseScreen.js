import { CardRepo } from '../../repositories/cardRepo.js';
import { createElement } from '../../utils/dom.js';

export class BrowseScreen {
  constructor() {
    this.cards = [];
  }

  async render(container) {
    container.innerHTML = `
      <section class="browse-screen">
        <h1>Browse Cards</h1>
        <p>A list of all your active flashcards.</p>
        <div id="card-list" class="card-list"></div>
        <button id="back-to-home-from-browse" class="btn btn-secondary">Back to Home</button>
      </section>
    `;

    this.cardListContainer = container.querySelector('#card-list');
    container.querySelector('#back-to-home-from-browse')?.addEventListener('click', () => {
      window.location.hash = 'home';
    });
    await this._loadAndDisplayCards();
  }

  async _loadAndDisplayCards() {
    try {
      this.cards = await CardRepo.getAllActive();
      console.log(`BrowseScreen: Found ${this.cards.length} active cards.`); // Logging
      this.cardListContainer.innerHTML = ''; // Clear previous content

      if (this.cards.length === 0) {
        this.cardListContainer.appendChild(createElement('p', {}, ['No cards found. Sync some cards from the Home screen!']));
        return;
      }

      this.cards.forEach(card => {
        const cardElement = createElement('div', { class: 'browse-card card' }, [
          createElement('h3', {}, [`ID: ${card.id}`]),
          createElement('p', {}, [`Subject: ${card.subject}`]),
          createElement('p', {}, [`Topic: ${card.topic || 'N/A'}`]),
          createElement('p', {}, [`Question: ${card.question}`]),
          createElement('p', {}, [`Answer: ${card.answer}`]),
          createElement('p', {}, [`Notes: ${card.notes || 'N/A'}`]),
        ]);
        this.cardListContainer.appendChild(cardElement);
      });
    } catch (error) {
      console.error('Failed to load cards for browsing:', error);
      this.cardListContainer.innerHTML = '<p class="error-message">Error loading cards.</p>';
    }
  }
}
