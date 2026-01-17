import { ProgressRepo } from '../repositories/progressRepo.js';
import { CardRepo } from '../repositories/cardRepo.js';
import { CardFactory } from './cardFactory.js';

export class Queue {
  /**
   * Builds a shuffled, sibling-spaced study queue.
   * @param {string} profileId
   * @returns {Promise<Array<{variantId: string, type: 'qa'|'cloze', front: string, back: string, rowId: string, progress: Object}>>}
   */
  static async build(profileId) {
    const dueItems = await ProgressRepo.getDueItems(profileId, Date.now());

    // 1. Fetch & Hydrate
    let candidates = await Queue._hydrateItems(dueItems);

    // Filter out invalid variants (e.g., cloze progress but no cloze marker in card notes)
    candidates = candidates.filter(item => item !== null);

    // 2. Fisher-Yates Shuffle
    Queue._shuffle(candidates);

    // 3. Anti-Clustering (Sibling Spacing)
    Queue._applySiblingSpacing(candidates);

    return candidates;
  }

  /**
   * Hydrates progress items with full card data and generates variants.
   * @param {Array<Object>} dueItems - Array of progress records.
   * @returns {Promise<Array<Object|null>>}
   * @private
   */
  static async _hydrateItems(dueItems) {
    const uniqueRowIds = [...new Set(dueItems.map((item) => item.rowId))];
    const cards = await CardRepo.getByIds(uniqueRowIds);
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    return dueItems.map((progress) => {
      const card = cardMap.get(progress.rowId);
      if (!card) return null; // Card might have been deleted or archived

      const variants = CardFactory.createVariants(card);
      const matchingVariant = variants.find(
        (v) => v.variantId.endsWith(`::${progress.variantType}`)
      );

      // Validation: If progress exists but variant cannot be created (e.g., cloze marker removed)
      if (!matchingVariant) {
        // In a real app, you might want to archive this progress item
        console.warn(`Zombie progress for ${progress.pk}. Card variant no longer exists.`);
        return null;
      }

      return { ...matchingVariant, progress };
    });
  }

  /**
   * Shuffles an array in place using the Fisher-Yates algorithm.
   * @param {Array<any>} array - The array to shuffle.
   * @private
   */
  static _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Applies sibling spacing to prevent immediate repetition of card concepts.
   * @param {Array<Object>} candidates - The shuffled array of card instances.
   * @private
   */
  static _applySiblingSpacing(candidates) {
    // Complexity: O(N^2) worst case, O(N) average
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].rowId === candidates[i - 1].rowId) {
        // Find a swap partner that isn't the same rowId
        const swapIndex = candidates.findIndex(
          (c, idx) => idx > i && c.rowId !== candidates[i].rowId
        );
        if (swapIndex !== -1) {
          [candidates[i], candidates[swapIndex]] = [
            candidates[swapIndex],
            candidates[i],
          ];
        } else {
          // If no suitable swap partner found later in the array,
          // then we just have to accept the adjacent sibling.
          // This should be rare in a reasonably sized queue.
        }
      }
    }
  }
}
