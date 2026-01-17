export class CsvParser {
  /**
   * Parses CSV text using PapaParse.
   * @param {string} csvText - The CSV data as a string.
   * @returns {Promise<Array<Object>>} - A promise that resolves with an array of parsed objects.
   */
  static async parse(csvText) {
    return new Promise((resolve, reject) => {
      PapaParse.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length) {
            reject(new Error('CSV parsing errors: ' + JSON.stringify(results.errors)));
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
