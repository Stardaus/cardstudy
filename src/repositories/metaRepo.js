import { openDB } from '../data/db.js';
import { DB_CONFIG } from '../config/constants.js';

const META_KEY = 'main'; // The fixed key for the single sync_meta record

export class MetaRepo {
  /**
   * Saves the sync metadata.
   * @param {Object} syncMeta - The sync metadata object to save.
   * @returns {Promise<void>}
   */
  static async save(syncMeta) {
    const db = await openDB();
    await db.put(DB_CONFIG.STORES.META, { ...syncMeta, key: META_KEY });
  }

  /**
   * Retrieves the sync metadata.
   * @returns {Promise<Object|undefined>} - The sync metadata object if found, otherwise undefined.
   */
  static async get() {
    const db = await openDB();
    return db.get(DB_CONFIG.STORES.META, META_KEY);
  }
}
