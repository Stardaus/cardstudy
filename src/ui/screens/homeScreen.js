import { $, createElement } from '../../utils/dom.js';
import { SyncEngine } from '../../data/syncEngine.js';
import { Toast } from '../components/toast.js';

export class HomeScreen {
  constructor() {
    this.csvUrlInput = null;
    this.syncButton = null;
    this.studyButton = null;
  }

  async render(container) {
    container.innerHTML = `
      <section class="home-screen">
        <h1>Welcome to Flashcard PWA!</h1>
        <p>Your personal, offline-first flashcard companion.</p>

        <div class="card setup-section">
          <h2>Setup & Sync</h2>
          <p>Provide a Google Sheet CSV URL to load your flashcards.</p>
          <div class="input-group">
            <label for="csv-url">CSV URL:</label>
            <input type="text" id="csv-url" placeholder="e.g., https://docs.google.com/spreadsheets/d/.../export?format=csv">
          </div>
          <button id="sync-button" class="btn btn-primary">Sync Cards</button>
          <p class="help-text">
            Need a template? Get one <a href="https://docs.google.com/spreadsheets/d/1BsdR4QeC4Q0J4P8P2P0P2P0P2P0P2P0P2P0P2P0P2P0P2P0P2P0P2P0P2P0/edit?usp=sharing" target="_blank" rel="noopener noreferrer">here</a>.
          </p>
        </div>

        <div class="card study-section">
          <h2>Ready to Study?</h2>
          <button id="study-button" class="btn btn-secondary">Start Study Session</button>
        </div>
      </section>
    `;

    this.csvUrlInput = $('#csv-url', container);
    this.syncButton = $('#sync-button', container);
    this.studyButton = $('#study-button', container);

    this._bindEvents();
  }

  _bindEvents() {
    if (this.syncButton) {
      this.syncButton.addEventListener('click', this._handleSync.bind(this));
    }
    if (this.studyButton) {
      this.studyButton.addEventListener('click', () => window.location.hash = 'study');
    }
  }

  async _handleSync() {
    const csvUrl = this.csvUrlInput ? this.csvUrlInput.value.trim() : '';
    if (!csvUrl) {
      Toast.show('Please enter a valid CSV URL.', 'error');
      return;
    }

    this.syncButton.disabled = true;
    this.syncButton.textContent = 'Syncing...';
    Toast.show('Starting sync...', 'info');

    try {
      const result = await SyncEngine.performSync(csvUrl);
      Toast.show(`Sync Complete! Added: ${result.added}, Updated: ${result.updated}, Archived: ${result.archived}`, 'success');
    } catch (error) {
      console.error('Sync failed:', error);
      Toast.show(`Sync failed: ${error.message}`, 'error');
    } finally {
      this.syncButton.disabled = false;
      this.syncButton.textContent = 'Sync Cards';
    }
  }
}
