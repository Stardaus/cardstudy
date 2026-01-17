import { Queue } from '../../domain/queue.js';
import { SrsSystem } from '../../domain/srsSystem.js';
import { ProgressRepo } from '../../repositories/progressRepo.js';
import { FlashcardComponent } from '../components/flashcard.js';
import { Toast } from '../components/toast.js';
import { $, createElement } from '../../utils/dom.js';

export class StudyScreen {
  constructor() {
    this.queue = [];
    this.currentIndex = 0;
    this.currentCardComponent = null;
    this.studyArea = null;
    this.profileId = 'default'; // Hardcoded for V1, can be made dynamic later
  }

  async render(container) {
    container.innerHTML = `
      <section class="study-screen">
        <h1>Study Session</h1>
        <div class="study-controls">
          <button id="flip-card-button" class="btn btn-primary">Flip Card</button>
          <div class="grade-buttons">
            <button id="dont-know-button" class="btn btn-danger">Don't Know</button>
            <button id="know-button" class="btn btn-success">Know</button>
          </div>
        </div>
        <div id="flashcard-area" class="flashcard-area">
          <div id="empty-queue-message" class="empty-queue-message hidden">
            <p>All caught up! No cards due right now. Come back later or sync new cards.</p>
            <button id="go-home-button" class="btn btn-secondary">Go to Home</button>
          </div>
        </div>
        <button id="back-to-home-from-study" class="btn btn-secondary">Back to Home</button>
      </section>
    `;

    this.studyArea = $('#flashcard-area', container);
    this.flipButton = $('#flip-card-button', container);
    this.dontKnowButton = $('#dont-know-button', container);
    this.knowButton = $('#know-button', container);
    this.emptyQueueMessage = $('#empty-queue-message', container);
    this.goHomeButton = $('#go-home-button', container);
    this.backToHomeButton = $('#back-to-home-from-study', container);


    this._bindEvents();
    await this._loadQueueAndRenderCard();
  }

  _bindEvents() {
    this.flipButton?.addEventListener('click', this.handleFlip.bind(this));
    this.dontKnowButton?.addEventListener('click', () => this.handleGrade('dont_know'));
    this.knowButton?.addEventListener('click', () => this.handleGrade('know'));
    this.goHomeButton?.addEventListener('click', () => window.location.hash = 'home');
    this.backToHomeButton?.addEventListener('click', () => window.location.hash = 'home');

  }

  async _loadQueueAndRenderCard() {
    try {
      this.queue = await Queue.build(this.profileId);
      if (this.queue.length === 0) {
        this._renderEmptyState();
      } else {
        this._renderCurrentCard();
      }
    } catch (error) {
      console.error('Failed to load study queue:', error);
      Toast.show('Error loading study queue.', 'error');
      this._renderEmptyState();
    }
  }

  _renderEmptyState() {
    if (this.currentCardComponent) {
      this.currentCardComponent.remove();
      this.currentCardComponent = null;
    }
    this._toggleControls(false);
    this.emptyQueueMessage.classList.remove('hidden');
  }

  _renderCurrentCard() {
    this.emptyQueueMessage.classList.add('hidden');
    this._toggleControls(true);

    const cardData = this.queue[this.currentIndex];
    if (cardData) {
      if (this.currentCardComponent) {
        this.currentCardComponent.update(cardData);
      } else {
        this.currentCardComponent = new FlashcardComponent(this.studyArea, cardData);
      }
    } else {
      this._renderEmptyState(); // Should not happen if queue is properly managed
    }
  }

  _toggleControls(enable) {
    if (this.flipButton) this.flipButton.disabled = !enable;
    if (this.dontKnowButton) this.dontKnowButton.disabled = !enable;
    if (this.knowButton) this.knowButton.disabled = !enable;
  }

  handleFlip() {
    if (!this.queue || this.queue.length === 0 || !this.currentCardComponent) {
      console.warn('Flip requested with empty queue or no current card.');
      return; // GUARD
    }
    this.currentCardComponent.flip();
  }

  async handleGrade(grade) {
    if (!this.queue || this.queue.length === 0 || !this.queue[this.currentIndex]) {
      console.warn('Grade requested with empty queue or invalid current card.');
      return; // GUARD
    }

    const currentItem = this.queue[this.currentIndex];
    const updatedProgress = SrsSystem.updateProgress(currentItem.progress, grade);

    try {
      await ProgressRepo.saveResult(updatedProgress);
      Toast.show(`Card graded: ${grade}. Next due: ${new Date(updatedProgress.dueAt).toLocaleDateString()}`, 'info', 2000);

      // Move to next card
      this.currentIndex++;
      if (this.currentIndex < this.queue.length) {
        this._renderCurrentCard();
      } else {
        // Session ended, reload queue to get newly due cards (if any) or show empty state
        Toast.show('Session complete! Reloading queue...', 'info');
        this.currentIndex = 0;
        await this._loadQueueAndRenderCard();
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
      Toast.show('Error saving progress.', 'error');
    }
  }
}
