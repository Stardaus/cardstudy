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

    // Get headers from the first row
    // Note: csvParser should ensure these are lowercase, but we verify here.
    const headers = Object.keys(rows[0]);

    // Ensure we compare against lowercase config headers for robustness
    const requiredHeaders = CSV_CONFIG.REQUIRED_HEADERS.map(h => h.toLowerCase());

    // Validate Headers
    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.includes(header)
    );

    if (missingHeaders.length > 0) {
      // Enhanced Debugging: Log exactly what we have vs what we need
      console.group('CSV Validation Failed');
      console.warn('Received Headers:', headers);
      console.warn('Expected Headers:', requiredHeaders);
      console.warn('Missing:', missingHeaders);
      console.groupEnd();

      throw new ValidationError(`Missing required CSV headers: ${missingHeaders.join(', ')}`, {
        type: 'MISSING_HEADERS',
        details: missingHeaders,
      });
    }

    // Validate Required Fields in Rows
    const rowsWithMissingFields = [];
    const requiredFields = CSV_CONFIG.REQUIRED_FIELDS.map(f => f.toLowerCase());

    rows.forEach((row, index) => {
      const missingFields = requiredFields.filter(
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