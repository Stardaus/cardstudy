import { $ } from '../../utils/dom.js';

export class SettingsScreen {
  constructor() {}

  async render(container) {
    container.innerHTML = `
      <section class="settings-screen">
        <h1>Settings</h1>
        <p>Configure your Flashcard PWA experience.</p>

        <div class="card">
          <h2>General Settings</h2>
          <div class="setting-item">
            <label for="profile-id">Profile ID (Future Feature):</label>
            <input type="text" id="profile-id" value="default" disabled>
            <p class="help-text">Currently, only a 'default' profile is supported.</p>
          </div>
        </div>

        <div class="card">
          <h2>Study Preferences (Future Feature)</h2>
          <p>More settings will be available here soon!</p>
          <ul>
            <li>Toggle Q/A Only / Cloze Only / Mixed mode.</li>
            <li>Adjust SRS intervals.</li>
          </ul>
        </div>

        <button id="back-to-home" class="btn btn-secondary">Back to Home</button>
      </section>
    `;

    $('#back-to-home', container)?.addEventListener('click', () => {
      window.location.hash = 'home';
    });
  }
}
