import { CsvFetcher } from './csvFetcher.js';
import { CsvParser } from './csvParser.js';
import { CsvValidator } from './csvValidator.js';
import { Hashing } from '../domain/hashing.js';
import { CardRepo } from '../repositories/cardRepo.js';
import { ProgressRepo } from '../repositories/progressRepo.js';
import { MetaRepo } from '../repositories/metaRepo.js';

export class SyncEngine {
  /**
   * Orchestrates the full sync process.
   * 1. Fetch & Parse CSV
   * 2. Hash & Validate
   * 3. Diff & Semantic Reset
   * 4. DB Write
   * @param {string} csvUrl
   * @returns {Promise<{ added: number, updated: number, archived: number }>}
   */
  static async performSync(csvUrl) {
    let added = 0;
    let updated = 0;
    let archived = 0;

    // 1. Fetch & Parse CSV
    const csvText = await CsvFetcher.fetchCsv(csvUrl);
    const parsedRows = await CsvParser.parse(csvText);

    // 2. Validate
    CsvValidator.validate(parsedRows); // Throws ValidationError if invalid

    // Hash entire CSV
    const newCsvHash = await Hashing.computeRowHash({ csvText }); // Using full csvText for overall hash
    const currentSyncMeta = await MetaRepo.get();

    if (currentSyncMeta && currentSyncMeta.csvHash === newCsvHash) {
      console.log('CSV content unchanged. No sync needed.');
      return { added, updated, archived };
    }

    const newCards = [];
    const existingCardIds = (await CardRepo.getAllActive()).map(card => card.id);
    const processedCardIds = new Set();

    // Loop through rows:
    for (const row of parsedRows) {
      const cardId = row.id;
      processedCardIds.add(cardId);

      const newSourceRowHash = await Hashing.computeRowHash(row);
      const newCoreHash = await Hashing.computeCoreHash(row.question, row.answer);
      const newContextHash = await Hashing.computeContextHash(row.notes);

      const existingCard = await CardRepo.getById(cardId);

      if (!existingCard) {
        // If New ID -> Insert.
        newCards.push({
          ...row,
          status: 'active',
          sourceRowHash: newSourceRowHash,
          coreHash: newCoreHash,
          contextHash: newContextHash,
          updatedAt: Date.now(),
        });
        added++;
      } else if (existingCard.sourceRowHash !== newSourceRowHash) {
        // If Existing ID + Hash Change -> Run Semantic Reset Logic, then Update.
        const resetAction = SyncEngine._determineResetAction(existingCard, {
          newCoreHash,
          newContextHash,
        });

        if (resetAction === 'RESET_ALL') {
          // Reset both QA and Cloze variants
          // Assuming a default profileId for now, will need to be passed down later
          const profileId = 'default';
          await ProgressRepo.resetProgress(profileId, cardId, 'qa');
          await ProgressRepo.resetProgress(profileId, cardId, 'cloze');
        } else if (resetAction === 'RESET_CLOZE') {
          // Reset only Cloze variant
          const profileId = 'default';
          await ProgressRepo.resetProgress(profileId, cardId, 'cloze');
        }
        // If resetAction is 'NONE', no progress reset is needed

        newCards.push({
          ...row,
          status: 'active',
          sourceRowHash: newSourceRowHash,
          coreHash: newCoreHash,
          contextHash: newContextHash,
          updatedAt: Date.now(),
        });
        updated++;
      } else {
        // No change in sourceRowHash, so no update needed for the card itself,
        // and no progress reset.
        newCards.push({ ...existingCard, updatedAt: Date.now() }); // Keep existing but update timestamp
      }
    }

    // Identify cards to archive (missing IDs)
    const cardsToArchive = existingCardIds.filter(id => !processedCardIds.has(id));
    for (const cardId of cardsToArchive) {
      const card = await CardRepo.getById(cardId);
      if (card && card.status === 'active') {
        await CardRepo.upsert({ ...card, status: 'archived', updatedAt: Date.now() });
        archived++;
        // TODO: Clean up progress for archived cards if desired. For now, just mark card as archived.
        // The PRD mentions "Scan for "Zombie Cloze" progress (where Card no longer has {{...}}) and mark as archived/deleted."
        // This implies explicit progress cleanup. For V1, we might just leave the progress linked to an archived card.
        // Or, we could fetch all progress for this card and mark them as archived/deleted.
      }
    }

    // Perform bulk upsert for all new and updated cards
    await CardRepo.bulkUpsert(newCards);

    // Update sync meta
    await MetaRepo.save({ csvHash: newCsvHash, lastSyncAt: Date.now() });

    return { added, updated, archived };
  }

  /**
   * Internal logic to compare hashes and determine reset level.
   * @private
   * @param {Object} oldCard - The existing card record from the DB.
   * @param {{newCoreHash: string, newContextHash: string}} newCardHashes - New hashes for the card.
   * @returns {'NONE' | 'RESET_ALL' | 'RESET_CLOZE'}
   */
  static _determineResetAction(oldCard, { newCoreHash, newContextHash }) {
    if (oldCard.coreHash !== newCoreHash) {
      return 'RESET_ALL';
    } else if (oldCard.contextHash !== newContextHash) {
      return 'RESET_CLOZE';
    }
    return 'NONE';
  }
}
