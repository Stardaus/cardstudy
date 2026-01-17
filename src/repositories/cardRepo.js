import { openDB } from '../data/db.js';
import { DB_CONFIG } from '../config/constants.js';

export class CardRepo {
  /**
   * Adds or updates a single card record in the 'cards' store.
   * @param {Object} card - The card object to upsert.
   * @returns {Promise<void>}
   */
  static async upsert(card) {
    const db = await openDB();
    await db.put(DB_CONFIG.STORES.CARDS, card);
  }

  /**
   * Adds or updates multiple card records in the 'cards' store in a single transaction.
   * @param {Array<Object>} cards - An array of card objects to upsert.
   * @returns {Promise<void>}
   */
  static async bulkUpsert(cards) {
    const db = await openDB();
    const tx = db.transaction(DB_CONFIG.STORES.CARDS, 'readwrite');
    await Promise.all(cards.map(card => tx.store.put(card)));
    await tx.done;
  }

  /**
   * Retrieves a card record by its ID.
   * @param {string} id - The ID of the card to retrieve.
   * @returns {Promise<Object|undefined>} - The card object if found, otherwise undefined.
   */
  static async getById(id) {
    const db = await openDB();
    return db.get(DB_CONFIG.STORES.CARDS, id);
  }

  /**
   * Retrieves all active card records.
   * @returns {Promise<Array<Object>>} - An array of active card objects.
   */
  static async getAllActive() {
    const db = await openDB();
    // Assuming 'status' field exists and 'active' is the desired state
    return (await db.getAll(DB_CONFIG.STORES.CARDS)).filter(card => card.status === 'active');
  }

  /**
   * Retrieves multiple card records by an array of IDs.
   * Used for Queue building.
   * @param {Array<string>} ids - An array of card IDs to retrieve.
   * @returns {Promise<Array<Object>>} - An array of card objects corresponding to the provided IDs.
   */
  static async getByIds(ids) {
    const db = await openDB();
    const tx = db.transaction(DB_CONFIG.STORES.CARDS, 'readonly');
    const cards = await Promise.all(ids.map(id => tx.store.get(id)));
    await tx.done;
    return cards.filter(Boolean); // Filter out any undefined results for non-existent IDs
  }
}
