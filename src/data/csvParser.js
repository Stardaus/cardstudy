// Use esm.sh to get a version of PapaParse that works with 'import'
import Papa from 'https://esm.sh/papaparse@5.4.1';

export class CsvParser {
  /**
   * Parses CSV text using PapaParse.
   * @param {string} csvText - The CSV data as a string.
   * @returns {Promise<Array<Object>>} - A promise that resolves with an array of parsed objects.
   */
  static async parse(csvText) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length) {
            // Check if errors are actual blocking errors or just warnings
            // PapaParse sometimes returns warnings in the errors array
            const criticalErrors = results.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes');

            if (criticalErrors.length > 0) {
              reject(new Error('CSV parsing errors: ' + JSON.stringify(criticalErrors)));
            } else {
              resolve(results.data);
            }
          } else {
            resolve(results.data);
          }
        },
        error: (err) => {
          reject(err);
        },
      });
    });
  }
}