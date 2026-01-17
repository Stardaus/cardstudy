/**
 * Custom error class for validation-specific errors.
 */
export class ValidationError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Object} [context={}] - Additional context about the error.
   */
  constructor(message, context = {}) {
    super(message);
    this.name = 'ValidationError';
    this.context = context;
  }
}