/**
 * Distance, Speed & ETA utilities for backend telemetry
 */

/**
 * Calculates great-circle distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in kilometers
 */
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;

  const R = 6371; // Earth's radius in kilometers
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
 * Calculates estimated arrival time (ETA) in integer minutes
 * @param {number} distanceKm Distance in km
 * @param {number} speedKmh Average speed in km/h (minimum 20 km/h)
 * @returns {number} ETA in minutes
 */
const calculateETA = (distanceKm, speedKmh = 25) => {
  if (!distanceKm || distanceKm <= 0) return 1;
  const effectiveSpeed = speedKmh > 5 ? speedKmh : 25;
  const hours = distanceKm / effectiveSpeed;
  return Math.max(1, Math.round(hours * 60));
};

/**
 * Validates GPS latitude and longitude bounds
 */
const isValidCoordinates = (lat, lon) => {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
};

module.exports = {
  calculateDistanceKm,
  calculateETA,
  isValidCoordinates,
};
