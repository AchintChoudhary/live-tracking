# Real-Data Android Walkthrough

This project no longer creates demo users, buses, routes, trips, or GPS movement. Existing MongoDB records are not modified by the app startup or build.

## Configure and start the backend

1. Configure `MONGODB_URI`, a strong `JWT_SECRET`, and `PORT` in `backend/.env` (do not commit that file).
2. Start the server from the backend folder:

   ```powershell
   npm start
   ```

3. Check `http://127.0.0.1:5000/api/health`. The mobile app uses port 5000 by default; set `EXPO_PUBLIC_BACKEND_URL` if the server uses another address or port.

There is no seed command. Create accounts and records through the app or authenticated API. Do not delete existing database records to prepare a presentation.

## Provider configuration

- **Android map:** set `GOOGLE_MAPS_API_KEY` in `%USERPROFILE%\.gradle\gradle.properties` or the build environment. The Android app uses `react-native-maps`; without a valid SDK key the map base layer may be unavailable, but the app should still handle location/search errors without substituting a fake position.
- **Road ETA:** set `GOOGLE_ROUTES_API_KEY` (or a server-side `GOOGLE_MAPS_SERVER_API_KEY`) and enable the Routes API. Alternatively, set `ROUTING_PROVIDER=osrm` and `OSRM_ROUTING_BASE_URL` to a self-hosted OSRM instance. The public OSRM demo endpoint is rejected. Without a configured routing provider, ETA is returned as unavailable.
- **Place search/reverse geocoding:** set `GEOCODING_PROVIDER=google` with `GOOGLE_PLACES_API_KEY` (or server-side `GOOGLE_MAPS_SERVER_API_KEY`) and `GOOGLE_GEOCODING_API_KEY` as needed, or configure `GEOCODING_PROVIDER=nominatim` with a self-hosted `NOMINATIM_BASE_URL`. Public Nominatim is intentionally not used: its policy prohibits use for vehicle-tracking applications and disallows client autocomplete. The app searches only after an explicit user action; drivers can also enter known coordinates from a trusted source.
- **Tile/map fallback:** MapLibre React Native supports open vector tiles such as OpenFreeMap and requires a native rebuild plus the new architecture. This project currently has `newArchEnabled=false` and no verified Android native build environment, so that fallback is not enabled. Do not silently use the public OSM raster tile server as a production fallback; use a provider whose request identification, caching, attribution, and application terms are supported by the selected native map component.

OpenStreetMap service policies consulted:

- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)
- [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [MapLibre React Native setup](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
- [OpenFreeMap quick start](https://openfreemap.org/quick_start/)

## Driver-to-passenger workflow

1. Open the driver portal and create an account. Driver passwords need at least eight characters with uppercase, lowercase, a number, and a symbol.
2. Choose **Register a Bus**. Enter the real bus name, registration number, capacity, start and destination, and any intermediate stops in travel order.
3. Search for each place using the configured place provider or enter its actual coordinates from a trusted source. The app does not infer bus stops from a road route.
4. Choose **Start New Trip**. A current device GPS fix and foreground location permission are required; route coordinates are never used as a substitute.
5. Keep the driver app open while tracking. GPS locations are sent to the active trip through Socket.IO. End the trip to remove it from active passenger search.
6. Create or sign into a passenger account, grant foreground location permission (or select a starting stop manually), choose a destination stop, and search for active buses.
7. Track a matching bus. ETA appears only when the trip has a fresh GPS fix and a configured driving-route provider. Otherwise the app reports ETA unavailable.

## Verification

Run `npm test` from `backend` for the backend checks and `npx expo export --platform android` from `mobile-app` to verify the JavaScript bundle. A JavaScript export does not verify Android native compilation, Android Studio installation, physical GPS, Google credentials, MongoDB access, or end-to-end live tracking; validate those on the configured emulator/device.
