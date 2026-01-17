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
