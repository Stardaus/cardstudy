/**
 * Returns the current timestamp in milliseconds since epoch.
 * @returns {number}
 */
export function now() {
  return Date.now();
}

/**
 * Converts a duration in days to milliseconds.
 * @param {number} days
 * @returns {number}
 */
export function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

/**
 * Converts a duration in hours to milliseconds.
 * @param {number} hours
 * @returns {number}
 */
export function hoursToMs(hours) {
  return hours * 60 * 60 * 1000;
}

/**
 * Converts a duration in minutes to milliseconds.
 * @param {number} minutes
 * @returns {number}
 */
export function minutesToMs(minutes) {
  return minutes * 60 * 1000;
}
