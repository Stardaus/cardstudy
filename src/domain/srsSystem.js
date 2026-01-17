import { SRS_CONFIG } from '../config/constants.js';

export class SrsSystem {
  /**
   * Updates a progress record based on the user's answer (know/don't know).
   * @param {Object} progressRecord - The current progress record.
   * @param {'know' | 'dont_know'} result - The user's answer.
   * @returns {Object} - The updated progress record.
   */
  static updateProgress(progressRecord, result) {
    const now = Date.now();
    let newBox = progressRecord.box;
    let newLapses = progressRecord.lapses || 0; // Initialize lapses if not present

    if (result === 'know') {
      newBox = Math.min(progressRecord.box + 1, SRS_CONFIG.INTERVALS.length - 1);
    } else { // 'dont_know'
      newBox = 0; // Reset to Box 0 as per PRD
      newLapses++;
    }

    const interval = SRS_CONFIG.INTERVALS[newBox];
    const newDueAt = now + interval;

    return {
      ...progressRecord,
      box: newBox,
      dueAt: newDueAt,
      lastReviewedAt: now,
      lapses: newLapses,
    };
  }
}
