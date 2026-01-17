export class CsvFetcher {
  /**
   * Fetches CSV data from a given URL.
   * @param {string} url - The URL to fetch the CSV from.
   * @returns {Promise<string>} - A promise that resolves with the CSV text.
   * @throws {Error} if the fetch operation fails.
   */
  static async fetchCsv(url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Error fetching CSV:', error);
      throw new Error(`Failed to fetch CSV from ${url}: ${error.message}`);
    }
  }
}
