const { calculateDistanceKm } = require('../utils/distanceCalculator');

const cache = new Map();
const CACHE_TTL_MS = 45000;
const MIN_REFRESH_INTERVAL_MS = 30000;
const SIGNIFICANT_MOVE_KM = 0.2;
const previewCache = new Map();

const getSelectedProvider = () => {
  const provider = (process.env.ROUTING_PROVIDER || 'auto').toLowerCase();
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY;
  const osrmBaseUrl = process.env.OSRM_ROUTING_BASE_URL;
  return provider === 'auto' ? (apiKey ? 'google' : osrmBaseUrl ? 'osrm' : 'none') : provider;
};

const hasRoutingProviderConfigured = () => {
  const selectedProvider = getSelectedProvider();
  if (selectedProvider === 'google') {
    return !!(process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY);
  }
  if (selectedProvider === 'osrm') return !!process.env.OSRM_ROUTING_BASE_URL;
  return false;
};

const parseDurationSeconds = (duration) => {
  if (typeof duration !== 'string') return null;
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : null;
};

const point = (coordinate) => ({
  location: {
    latLng: {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    },
  },
});

const decodePolyline = (encoded) => {
  const coordinates = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const readDelta = () => {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };

    latitude += readDelta();
    longitude += readDelta();
    coordinates.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return coordinates;
};

const getRoutePreview = async (stops = []) => {
  if (!Array.isArray(stops) || stops.length < 2) return null;
  const selectedProvider = getSelectedProvider();
  if (!hasRoutingProviderConfigured()) return null;

  const cacheKey = `${selectedProvider}:${JSON.stringify(
    stops.map(({ latitude, longitude }) => [latitude, longitude])
  )}`;
  const cached = previewCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5 * 60 * 1000) return cached.result;

  let result;
  if (selectedProvider === 'google') {
    const apiKey = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY;
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: point(stops[0]),
        destination: point(stops[stops.length - 1]),
        intermediates: stops.slice(1, -1).map(point),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
        computeAlternativeRoutes: false,
        units: 'METRIC',
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Google Routes returned HTTP ${response.status}`);
    const data = await response.json();
    const route = data.routes?.[0];
    const durationSeconds = parseDurationSeconds(route?.duration);
    const coordinates = route?.polyline?.encodedPolyline
      ? decodePolyline(route.polyline.encodedPolyline)
      : [];
    if (durationSeconds == null || !Number.isFinite(route?.distanceMeters) || coordinates.length < 2) {
      return null;
    }
    result = { coordinates, durationSeconds, distanceMeters: route.distanceMeters };
  } else if (selectedProvider === 'osrm') {
    const base = new URL(process.env.OSRM_ROUTING_BASE_URL);
    if (base.hostname.toLowerCase() === 'router.project-osrm.org') {
      throw new Error('The public OSRM demo server cannot be configured for production routing');
    }
    const routePoints = stops
      .map(({ latitude, longitude }) => `${longitude},${latitude}`)
      .join(';');
    const url = new URL(`${base.toString().replace(/\/+$/, '')}/route/v1/driving/${routePoints}`);
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('steps', 'false');
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Configured OSRM returned HTTP ${response.status}`);
    const data = await response.json();
    const route = data.code === 'Ok' ? data.routes?.[0] : null;
    const coordinates = route?.geometry?.coordinates?.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    })) || [];
    if (!Number.isFinite(route?.duration) || !Number.isFinite(route?.distance) || coordinates.length < 2) {
      return null;
    }
    result = { coordinates, durationSeconds: route.duration, distanceMeters: route.distance };
  } else {
    return null;
  }

  previewCache.set(cacheKey, { result, createdAt: Date.now() });
  if (previewCache.size > 200) {
    for (const [key, entry] of previewCache) {
      if (Date.now() - entry.createdAt > 5 * 60 * 1000) previewCache.delete(key);
    }
  }
  return result;
};

const computeRoute = async (origin, destination, intermediates = []) => {
  const provider = (process.env.ROUTING_PROVIDER || 'auto').toLowerCase();
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY;
  const osrmBaseUrl = process.env.OSRM_ROUTING_BASE_URL;
  const selectedProvider = getSelectedProvider();

  if (selectedProvider === 'none') return null;
  if (selectedProvider === 'google' && !apiKey) return null;
  if (selectedProvider === 'osrm') {
    if (!osrmBaseUrl) return null;
    const base = new URL(osrmBaseUrl);
    if (base.hostname.toLowerCase() === 'router.project-osrm.org') {
      throw new Error('The public OSRM demo server cannot be configured for production routing');
    }
    const routePoints = [origin, ...intermediates, destination]
      .map(({ latitude, longitude }) => `${longitude},${latitude}`)
      .join(';');
    const url = new URL(`${base.toString().replace(/\/+$/, '')}/route/v1/driving/${routePoints}`);
    url.searchParams.set('overview', 'false');
    url.searchParams.set('steps', 'false');
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.error(`[OSRM] Request failed with HTTP ${response.status}`);
      return null;
    }
    const data = await response.json();
    const route = data.code === 'Ok' ? data.routes?.[0] : null;
    if (!Number.isFinite(route?.duration) || !Number.isFinite(route?.distance)) return null;
    return { durationSeconds: route.duration, distanceMeters: route.distance };
  }
  if (selectedProvider !== 'google') {
    throw new Error(`Unsupported ROUTING_PROVIDER "${provider}"`);
  }

  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: point(origin),
      destination: point(destination),
      intermediates: intermediates.map(point),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes: false,
      units: 'METRIC',
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    console.error(`[Routes API] Request failed with HTTP ${response.status}`);
    return null;
  }

  const data = await response.json();
  const route = data.routes?.[0];
  const durationSeconds = parseDurationSeconds(route?.duration);
  if (durationSeconds == null || !Number.isFinite(route.distanceMeters)) return null;

  return {
    durationSeconds,
    distanceMeters: route.distanceMeters,
  };
};

const estimateTripLeg = async ({
  cacheKey,
  origin,
  destination,
  intermediates,
  dwellSeconds = 0,
}) => {
  const now = Date.now();
  if (cache.size > 1000) {
    for (const [key, entry] of cache) {
      if (now - entry.calculatedAt > CACHE_TTL_MS) cache.delete(key);
    }
  }
  const previous = cache.get(cacheKey);
  const movedKm = previous?.origin
    ? calculateDistanceKm(
        previous.origin.latitude,
        previous.origin.longitude,
        origin.latitude,
        origin.longitude
      )
    : Infinity;

  if (
    previous &&
    now - previous.calculatedAt < CACHE_TTL_MS &&
    (now - previous.calculatedAt < MIN_REFRESH_INTERVAL_MS || movedKm < SIGNIFICANT_MOVE_KM)
  ) {
    return previous.result;
  }

  let result;
  try {
    result = await computeRoute(origin, destination, intermediates);
  } catch (error) {
    console.error(`[Routing] ETA calculation failed: ${error.message}`);
    result = null;
  }
  const enrichedResult = result
    ? {
        durationSeconds: result.durationSeconds + dwellSeconds,
        distanceMeters: result.distanceMeters,
        calculatedAt: new Date(now).toISOString(),
        dwellIncludedSeconds: dwellSeconds,
      }
    : null;
  cache.set(cacheKey, { result: enrichedResult, origin, calculatedAt: now });
  return enrichedResult;
};

const clearRouteCache = () => {
  cache.clear();
  previewCache.clear();
};

module.exports = {
  estimateTripLeg,
  getRoutePreview,
  hasRoutingProviderConfigured,
  clearRouteCache,
  decodePolyline,
  parseDurationSeconds,
};
