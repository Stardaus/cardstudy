Flashcard PWA – Technical Design Document (TDD)

Version: 1.3 (Final)
Reference PRD: Flashcard PWA PRD v1.3
Target Audience: Engineering Team

1. System Architecture Overview

1.1 Architectural Pattern

The application follows a Modular Monolith architecture on the client-side, using ES Modules. It strictly separates concerns into three layers:

Data Layer: Handles raw storage (IndexedDB), CSV fetching, and parsing.

Domain Layer: Pure business logic (SRS algorithm, Card generation, Semantic hashing, Diffing).

UI Layer: View logic, routing, and user interaction.

Constraint: The Service Worker is treated as a platform infrastructure component (caching), NOT a business logic layer.

2. Project File Structure

The project shall adhere to the following directory structure. All source code resides in /src.

/ (root)
├── index.html                  # App Shell entry point
├── manifest.webmanifest        # PWA Metadata
├── service-worker.js           # Asset caching & offline shell
├── styles/
│   ├── main.css                # Global variables & reset
│   ├── components.css          # Component-specific styles
│   └── utilities.css           # Helper classes (hidden, rtl, etc.)
└── src/
    ├── main.js                 # Bootstrapper (Init DB, Register SW, Mount App)
    ├── app.js                  # Global State Container & Router
    │
    ├── config/
    │   ├── constants.js        # DB Names, SRS intervals, Headers
    │   └── errors.js           # Custom Error classes (ValidationError)
    │
    ├── data/                   # LAYER: Raw Data Handling
    │   ├── csvFetcher.js       # Network fetch logic
    │   ├── csvParser.js        # PapaParse wrapper
    │   ├── csvValidator.js     # Schema validation logic
    │   ├── db.js               # IndexedDB connection & schema (idb library)
    │   └── syncEngine.js       # The "Brain" of the sync process
    │
    ├── domain/                 # LAYER: Business Logic
    │   ├── cardFactory.js      # QA/Cloze variant generation
    │   ├── hashing.js          # SHA-256 & Normalization logic
    │   ├── srsSystem.js        # Leitner algorithm implementation
    │   └── queue.js            # Study queue construction logic
    │
    ├── repositories/           # LAYER: Database Access Objects (DAOs)
    │   ├── cardRepo.js         # CRUD for 'cards' store
    │   ├── progressRepo.js     # CRUD for 'progress' store
    │   └── metaRepo.js         # CRUD for 'sync_meta' store
    │
    ├── ui/                     # LAYER: User Interface
    │   ├── router.js           # Simple hash-based router
    │   ├── screens/
    │   │   ├── homeScreen.js
    │   │   ├── setupScreen.js
    │   │   ├── studyScreen.js
    │   │   ├── browseScreen.js
    │   │   └── settingsScreen.js
    │   └── components/
    │       ├── flashcard.js
    │       ├── progressBar.js
    │       ├── modal.js
    │       └── toast.js
    │
    └── utils/
        ├── dom.js              # Helper for element creation ($)
        └── time.js             # Epoch helpers


3. Class & Method Specifications

This section defines the exact API surface for core modules.

3.1 Configuration Module

src/config/constants.js

export const DB_CONFIG = {
  NAME: 'flashcard_pwa',
  VERSION: 1,
  STORES: {
    CARDS: 'cards',
    PROGRESS: 'progress',
    META: 'sync_meta'
  }
};

export const CSV_CONFIG = {
  REQUIRED_HEADERS: ['id', 'subject', 'topic', 'question', 'answer', 'notes'],
  REQUIRED_FIELDS: ['id', 'subject', 'question', 'answer']
};

export const SRS_CONFIG = {
  INTERVALS: [10*60*1000, 24*3600*1000, 3*24*3600*1000, 7*24*3600*1000, 14*24*3600*1000, 30*24*3600*1000]
};


3.2 Data Layer

src/data/db.js

/**
 * Opens DB connection and handles migrations.
 * @returns {Promise<IDBDatabase>}
 */
export async function openDB() { ... }


src/data/csvValidator.js

export class CsvValidator {
  /**
   * Validates headers and rows. Throws ValidationError on failure.
   * @param {Array<Object>} rows - Parsed result from PapaParse
   * @returns {boolean} true if valid
   * @throws {ValidationError} with details { type, rows: [] }
   */
  static validate(rows) { ... }
}


src/data/syncEngine.js

import { CardRepo } from '../repositories/cardRepo.js';
import { ProgressRepo } from '../repositories/progressRepo.js';
import { Hashing } from '../domain/hashing.js';

export class SyncEngine {
  /**
   * Orchestrates the full sync process.
   * 1. Fetch & Parse
   * 2. Hash & Validate
   * 3. Diff & Semantic Reset
   * 4. DB Write
   * @param {string} csvUrl 
   * @returns {Promise<{ added: number, updated: number, archived: number }>}
   */
  static async performSync(csvUrl) { ... }

  /**
   * Internal logic to compare hashes and determine reset level.
   * @private
   */
  static _determineResetAction(oldCard, newCardHashes) {
    // Returns: 'NONE' | 'RESET_ALL' | 'RESET_CLOZE'
  }
}


3.3 Domain Layer

src/domain/hashing.js

export class Hashing {
  /**
   * Creates a standardized hash for content comparison.
   * Normalization: trim, collapse spaces.
   */
  static async computeCoreHash(question, answer) { ... }
  
  static async computeContextHash(notes) { ... }
  
  static async computeRowHash(fullRowObj) { ... }
}


src/domain/cardFactory.js

export class CardFactory {
  /**
   * Converts a DB Card Record into renderable Variants.
   * @param {Object} cardRecord 
   * @returns {Array<{ variantId: string, type: 'qa'|'cloze', front: string, back: string }>}
   */
  static createVariants(cardRecord) {
    // 1. Always create QA
    // 2. Parse cardRecord.notes for {{...}} or [[...]]
    // 3. If match, create Cloze
    // 4. Return array
  }
}


src/domain/queue.js

export class Queue {
  /**
   * Builds a shuffled, sibling-spaced study queue.
   * @param {string} profileId
   * @returns {Promise<Array<CardInstance>>}
   */
  static async build(profileId) {
    const dueItems = await ProgressRepo.getDueItems(profileId, Date.now());
    
    // 1. Fetch & Hydrate
    let candidates = await this._hydrateItems(dueItems);
    
    // 2. Fisher-Yates Shuffle
    candidates = this._shuffle(candidates);

    // 3. Anti-Clustering (Sibling Spacing)
    // Complexity: O(N^2) worst case, O(N) average
    for (let i = 1; i < candidates.length; i++) {
        if (candidates[i].rowId === candidates[i-1].rowId) {
            // Find a swap partner that isn't the same rowId
            const swapIndex = candidates.findIndex((c, idx) => idx > i && c.rowId !== candidates[i].rowId);
            if (swapIndex !== -1) {
                [candidates[i], candidates[swapIndex]] = [candidates[swapIndex], candidates[i]];
            }
        }
    }
    
    return candidates;
  }
}


3.4 Repository Layer (IndexedDB Abstraction)

src/repositories/cardRepo.js

export class CardRepo {
  static async upsert(card) { ... }
  static async bulkUpsert(cards) { ... }
  static async getById(id) { ... }
  static async getAllActive() { ... }
  /**
   * Used for Queue building.
   * @param {Array<string>} ids 
   */
  static async getByIds(ids) { ... }
}


src/repositories/progressRepo.js

export class ProgressRepo {
  /**
   * Resets progress for a specific variant.
   * Sets box=0, dueAt=now.
   */
  static async resetProgress(profileId, variantId) { ... }

  /**
   * Uses 'by_profile_due' index to find due items.
   * @param {string} profileId 
   * @param {number} timestamp 
   */
  static async getDueItems(profileId, timestamp) { ... }

  static async saveResult(progressRecord) { ... }
}


3.5 UI Layer

src/ui/router.js

export class Router {
  constructor(routes) {
    this.routes = routes; // Map path -> ScreenClass
    window.addEventListener('hashchange', this._onHashChange.bind(this));
  }

  navigate(path) {
    // GUARD: Ensure target exists
    if (!this.routes[path]) {
        console.warn(`Route ${path} not found, redirecting home`);
        window.location.hash = 'home';
        return;
    }
    window.location.hash = path;
  }
}


src/ui/screens/studyScreen.js

import { Queue } from '../../domain/queue.js';
import { FlashcardComponent } from '../components/flashcard.js';

export class StudyScreen {
  constructor() {
    this.queue = [];
    this.currentIndex = 0;
  }

  async render(container) {
    // 1. Load Queue
    // 2. GUARD: If empty -> render EmptyState ("All caught up!")
    // 3. If items -> render FlashcardComponent
  }

  // EVENT HANDLER
  handleFlip() {
    // GUARD: Check if queue has items
    if (!this.queue || this.queue.length === 0) return;
    // ... proceed with flip logic
  }

  // EVENT HANDLER
  handleGrade(grade) {
    // GUARD: Check if queue has items AND current item is valid
    if (!this.queue || !this.queue[this.currentIndex]) return;
    
    // 1. Call SrsSystem
    // 2. Save ProgressRepo
    // 3. Show next card
    // 4. INSTANT RESET: Temporarily disable transition on flip back
  }
}


3.6 Error Handling Strategy (New)

Global UI Safety Rules:

Template Validation: The Router must check if the target <template id="view-X"> exists in the DOM before attempting to clone it. If missing, it should log an error and remain on the current view or redirect to a fallback.

State Guards: All interactive methods (clicks, keypresses) must check the validity of their target state (e.g., this.currentCard) before accessing properties. Accessing properties on undefined (e.g., card.variantId) is strictly forbidden.

Graceful Degredation: If the Study Queue is empty, the UI must explicitly render a "No Cards" view and disable study controls, rather than rendering a blank card or throwing errors.

4. Key Data Flows

4.1 Sync Flow (Detailed)

User clicks "Sync" in HomeScreen.

SyncEngine.performSync(url) is called.

CsvFetcher retrieves text (cache: 'no-store').

CsvParser returns JSON array.

CsvValidator confirms integrity (Headers, IDs).

Loop through rows:

Hashing computes sourceRowHash, coreHash, contextHash.

CardRepo.getById(id) fetches existing.

IF sourceRowHash differs:

SyncEngine compares coreHash vs existing.

IF changed -> ProgressRepo.resetProgress(id::qa) & (id::cloze).

SyncEngine compares contextHash vs existing.

IF changed -> ProgressRepo.resetProgress(id::cloze).

CardRepo.upsert(newCard).

SyncEngine returns report struct.

HomeScreen displays Toast "Sync Complete: X updated".

4.2 Queue Building Flow

StudyScreen mounts.

Calls Queue.build(profileId).

Queue calls ProgressRepo.getDueItems(profileId, Date.now()).

Returns list of { rowId, variantType }.

Queue extracts unique rowIds.

Queue calls CardRepo.getByIds([uniqueIds]).

Queue iterates Progress items:

Retrieves matching Card.

Calls CardFactory.createVariants(card).

Finds the specific variant (QA or Cloze) matching the progress.

Validation: If ::cloze progress exists but CardFactory returns no cloze variant (e.g. markers removed), SKIP this item.

Queue runs Shuffle and Sibling Spacing algorithm.

Returns array of CardInstance objects to UI.