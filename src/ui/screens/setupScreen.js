import { $ } from '../../utils/dom.js';

export class SetupScreen {
  constructor() {}

  async render(container) {
    container.innerHTML = `
      <section class="setup-screen">
        <h1>PWA Setup Guide</h1>
        <p>Follow these steps to install Flashcard PWA on your device for offline access.</p>

        <div class="card">
          <h2>For iOS Users (Safari):</h2>
          <ol>
            <li>Tap the "Share" button <span class="icon">&#x21B3;</span> at the bottom of the screen.</li>
            <li>Scroll down and select "Add to Home Screen".</li>
            <li>Tap "Add" in the top right corner.</li>
          </ol>
          <p>The Flashcard PWA icon will appear on your home screen.</p>
        </div>

        <div class="card">
          <h2>For Android Users (Chrome):</h2>
          <ol>
            <li>Tap the "Menu" button <span class="icon">&#x22EE;</span> (three dots) in the top right corner.</li>
            <li>Select "Install app" or "Add to Home screen".</li>
            <li>Tap "Install".</li>
          </ol>
          <p>The Flashcard PWA icon will appear on your home screen.</p>
        </div>

        <button id="back-to-home" class="btn btn-secondary">Back to Home</button>
      </section>
    `;

    $('#back-to-home', container)?.addEventListener('click', () => {
      window.location.hash = 'home';
    });
  }
}
