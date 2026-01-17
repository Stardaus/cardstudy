export class Hashing {
  /**
   * Normalizes a string by trimming whitespace and collapsing multiple spaces.
   * Case-sensitive for V1.
   * @param {string} text
   * @returns {string}
   */
  static _normalize(text) {
    return String(text || '').trim().replace(/\s+/g, ' ');
  }

  /**
   * Computes a SHA-256 hash of the given string.
   * @param {string} text
   * @returns {Promise<string>} - The hexadecimal representation of the hash.
   */
  static async _sha256(text) {
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hexHash;
  }

  /**
   * Creates a standardized hash for content comparison based on Question and Answer.
   * @param {string} question
   * @param {string} answer
   * @returns {Promise<string>}
   */
  static async computeCoreHash(question, answer) {
    const normalizedQuestion = Hashing._normalize(question);
    const normalizedAnswer = Hashing._normalize(answer);
    return Hashing._sha256(normalizedQuestion + normalizedAnswer);
  }

  /**
   * Creates a standardized hash for content comparison based on Notes.
   * @param {string} notes
   * @returns {Promise<string>}
   */
  static async computeContextHash(notes) {
    const normalizedNotes = Hashing._normalize(notes);
    return Hashing._sha256(normalizedNotes);
  }

  /**
   * Creates a standardized hash for the full row object.
   * The order of properties matters for hashing.
   * @param {Object} fullRowObj
   * @returns {Promise<string>}
   */
  static async computeRowHash(fullRowObj) {
    // Sort keys to ensure consistent hashing regardless of object property order
    const sortedKeys = Object.keys(fullRowObj).sort();
    const stringifiedRow = sortedKeys.map(key => `${key}:${Hashing._normalize(fullRowObj[key])}`).join('|');
    return Hashing._sha256(stringifiedRow);
  }
}
