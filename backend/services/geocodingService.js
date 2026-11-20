const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const getProvider = () => {
  const configured = process.env.GEOCODING_PROVIDER;
  if (configured) return configured.toLowerCase();
  if (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY) return 'google';
  if (process.env.NOMINATIM_BASE_URL) return 'nominatim';
  return 'none';
};

const getNominatimBaseUrl = () => {
  const value = process.env.NOMINATIM_BASE_URL;
  if (!value) return null;
  const url = new URL(value);
  if (url.hostname.toLowerCase() === 'nominatim.openstreetmap.org') {
    throw new Error('Public Nominatim is not supported for this vehicle-tracking application; configure a self-hosted instance');
  }
  return url.toString().replace(/\/+$/, '');
};

const getCached = (key) => {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
};

const setCached = (key, value) => {
  if (cache.size > 1000) {
    for (const [cacheKey, entry] of cache) {
      if (Date.now() - entry.createdAt > CACHE_TTL_MS) cache.delete(cacheKey);
    }
  }
  cache.set(key, { value, createdAt: Date.now() });
};

const searchWithGoogle = async (query) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Google Places returned HTTP ${response.status}`);
  const result = await response.json();
  return (result.places || []).map((place) => ({
    placeId: place.id,
    name: place.displayName?.text || place.formattedAddress,
    address: place.formattedAddress || '',
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
  })).filter((place) =>
    place.name &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude)
  );
};

const searchWithNominatim = async (query) => {
  const baseUrl = getNominatimBaseUrl();
  if (!baseUrl) return null;
  const url = new URL(`${baseUrl}/search`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('q', query);
  const response = await fetch(url, {
    headers: {
      'User-Agent': process.env.TRANSIT_GEOCODER_USER_AGENT || 'TransitTrackLive/1.0',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Configured Nominatim returned HTTP ${response.status}`);
  const results = await response.json();
  return results.map((place) => ({
    placeId: String(place.osm_type && place.osm_id ? `${place.osm_type}/${place.osm_id}` : place.place_id),
    name: place.name || place.display_name,
    address: place.display_name || '',
    latitude: Number(place.lat),
    longitude: Number(place.lon),
  })).filter((place) =>
    place.name &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude)
  );
};

const searchPlaces = async (query) => {
  const provider = getProvider();
  if (provider === 'none') return null;
  if (!['google', 'nominatim'].includes(provider)) {
    throw new Error(`Unsupported GEOCODING_PROVIDER "${provider}"`);
  }

  const cacheKey = `search:${provider}:${query.trim().toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  const results = provider === 'google'
    ? await searchWithGoogle(query)
    : await searchWithNominatim(query);
  if (results !== null) setCached(cacheKey, results);
  return results;
};

const reverseWithGoogle = async (latitude, longitude) => {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${latitude},${longitude}`);
  url.searchParams.set('key', apiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Google Geocoding returned HTTP ${response.status}`);
  const result = await response.json();
  if (result.status !== 'OK') return null;
  return result.results?.[0]?.formatted_address || null;
};

const reverseWithNominatim = async (latitude, longitude) => {
  const baseUrl = getNominatimBaseUrl();
  if (!baseUrl) return null;
  const url = new URL(`${baseUrl}/reverse`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  const response = await fetch(url, {
    headers: {
      'User-Agent': process.env.TRANSIT_GEOCODER_USER_AGENT || 'TransitTrackLive/1.0',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Configured Nominatim returned HTTP ${response.status}`);
  const result = await response.json();
  return result.display_name || null;
};

const reverseGeocode = async (latitude, longitude) => {
  const provider = getProvider();
  if (provider === 'none') return null;
  const key = `reverse:${provider}:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
  const cached = getCached(key);
  if (cached !== undefined) return cached;
  const address = provider === 'google'
    ? await reverseWithGoogle(latitude, longitude)
    : provider === 'nominatim'
      ? await reverseWithNominatim(latitude, longitude)
      : null;
  if (address) setCached(key, address);
  return address;
};

module.exports = {
  getProvider,
  searchPlaces,
  reverseGeocode,
};
