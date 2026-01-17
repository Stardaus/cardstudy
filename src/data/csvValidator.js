import { CSV_CONFIG } from '../config/constants.js';
import { ValidationError } from '../config/errors.js';

export class CsvValidator {
  /**
   * Validates headers and rows. Throws ValidationError on failure.
   * @param {Array<Object>} rows - Parsed result from PapaParse
   * @returns {boolean} true if valid
   * @throws {ValidationError} with details { type, rows: [] }
   */
  static validate(rows) {
    if (!rows || rows.length === 0) {
      throw new ValidationError('CSV is empty', { type: 'EMPTY_CSV' });
    }

    const headers = Object.keys(rows[0]);

    // Validate Headers
    const missingHeaders = CSV_CONFIG.REQUIRED_HEADERS.filter(
      (header) => !headers.includes(header)
    );
    if (missingHeaders.length > 0) {
      throw new ValidationError('Missing required CSV headers', {
        type: 'MISSING_HEADERS',
        details: missingHeaders,
      });
    }

    // Validate Required Fields in Rows
    const rowsWithMissingFields = [];
    rows.forEach((row, index) => {
      const missingFields = CSV_CONFIG.REQUIRED_FIELDS.filter(
        (field) => !row[field] || String(row[field]).trim() === ''
      );
      if (missingFields.length > 0) {
        rowsWithMissingFields.push({ rowIndex: index + 1, missingFields: missingFields });
      }
    });

    if (rowsWithMissingFields.length > 0) {
      throw new ValidationError('Some rows have missing required fields', {
        type: 'MISSING_FIELDS_IN_ROWS',
        details: rowsWithMissingFields,
      });
    }

    return true;
  }
}
