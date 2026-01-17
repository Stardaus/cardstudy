import { openDB } from '../data/db.js';
import { DB_CONFIG } from '../config/constants.js';

export class ProgressRepo {
  /**
   * Resets progress for a specific variant.
   * Sets box=0, dueAt=now, lapses=0.
   * @param {string} profileId
   * @param {string} rowId
   * @param {'qa' | 'cloze'} variantType
   * @returns {Promise<void>}
   */
  static async resetProgress(profileId, rowId, variantType) {
    const db = await openDB();
    const pk = `${profileId}|${rowId}::${variantType}`;
    let progress = await db.get(DB_CONFIG.STORES.PROGRESS, pk);

    const now = Date.now();
    if (!progress) {
      progress = {
        pk,
        profileId,
        rowId,
        variantType,
        box: 0,
        dueAt: now,
        lastReviewedAt: now,
        lapses: 0, // Add lapses for SRS system
      };
    } else {
      progress.box = 0;
      progress.dueAt = now;
      progress.lastReviewedAt = now;
      progress.lapses = 0; // Reset lapses on full reset
    }
    await db.put(DB_CONFIG.STORES.PROGRESS, progress);
  }

  /**
   * Uses 'by_profile_due' index to find due items.
   * @param {string} profileId
   * @param {number} timestamp - The current timestamp to compare against dueAt.
   * @returns {Promise<Array<Object>>} - An array of progress records that are due.
   */
  static async getDueItems(profileId, timestamp) {
    const db = await openDB();
    const transaction = db.transaction(DB_CONFIG.STORES.PROGRESS, 'readonly');
    const index = transaction.store.index('by_profile_due');

    // Query for items where profileId matches and dueAt is less than or equal to the timestamp
    const dueItems = await index.getAll(IDBKeyRange.upperBound([profileId, timestamp]));

    // Filter to ensure only the specified profileId
    return dueItems.filter(item => item.profileId === profileId);
  }

  /**
   * Saves or updates a progress record.
   * @param {Object} progressRecord - The progress record to save.
   * @returns {Promise<void>}
   */
  static async saveResult(progressRecord) {
    const db = await openDB();
    await db.put(DB_CONFIG.STORES.PROGRESS, progressRecord);
  }

  /**
   * Retrieves all progress records for a given rowId.
   * @param {string} rowId - The rowId to query progress for.
   * @returns {Promise<Array<Object>>} - An array of progress records.
   */
  static async getProgressByRowId(rowId) {
    const db = await openDB();
    const transaction = db.transaction(DB_CONFIG.STORES.PROGRESS, 'readonly');
    const index = transaction.store.index('by_row');
    return index.getAll(rowId);
  }

  /**
   * Deletes a progress record by its primary key.
   * @param {string} pk - The primary key of the progress record to delete.
   * @returns {Promise<void>}
   */
  static async deleteProgress(pk) {
    const db = await openDB();
    await db.delete(DB_CONFIG.STORES.PROGRESS, pk);
  }
}
