/**
 * Geographical distance & ETA calculation utilities
 */

/**
 * Calculates great-circle distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in kilometers
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Computes estimated time of arrival (ETA) in integer minutes
 * @param {number} distanceKm Distance in kilometers
 * @param {number} speedKmh Average speed in km/h (defaults to 25 km/h for urban transit)
 * @returns {number} ETA in minutes
 */
export const calculateETA = (distanceKm, speedKmh = 25) => {
  if (!distanceKm || distanceKm <= 0) return 1;
  const speed = speedKmh > 5 ? speedKmh : 25;
  const hours = distanceKm / speed;
  const minutes = Math.round(hours * 60);
  return Math.max(1, minutes);
};

/**
 * Formats seconds into human-readable duration
 * @param {number} seconds 
 * @returns {string} e.g. "24m 10s"
 */
export const formatDurationSeconds = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const remSecs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${remMins}m`;
  }
  return `${remMins}m ${remSecs}s`;
};
