import { openDB as idbOpenDB } from 'idb';
import { DB_CONFIG } from '../config/constants.js';

/**
 * Opens DB connection and handles migrations.
 * @returns {Promise<IDBDatabase>}
 */
export async function openDB() {
  return idbOpenDB(DB_CONFIG.NAME, DB_CONFIG.VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        // Version 1 schema creation
        const cardsStore = db.createObjectStore(DB_CONFIG.STORES.CARDS, { keyPath: 'id' });
        // No indexes needed on cards store for now, as direct ID lookup is sufficient

        const progressStore = db.createObjectStore(DB_CONFIG.STORES.PROGRESS, { keyPath: 'pk' });
        progressStore.createIndex('by_profile_due', ['profileId', 'dueAt']);
        progressStore.createIndex('by_row', 'rowId');

        db.createObjectStore(DB_CONFIG.STORES.META, { keyPath: 'key' });
      }
      // Future migrations would go here as new versions are introduced
    },
  });
}
