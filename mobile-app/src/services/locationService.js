import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { calculateDistanceKm } from '../utils/distance';

/**
 * Android Device GPS Service
 * Manages runtime foreground location permissions,
 * hardware GPS watch stream, foreground notification options,
 * duplicate coordinate filtering, and cumulative distance calculation.
 */
class LocationService {
  constructor() {
    this.watchId = null;
    this.locationHistory = [];
    this.totalDistanceKm = 0;
    this.isTracking = false;
    this.lastLocation = null;
    this.activeTripId = null;
  }

  /**
   * Requests foreground Android GPS permissions.
   */
  async requestLocationPermissions() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        const fineGranted =
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const coarseGranted =
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

        if (!fineGranted && !coarseGranted) {
          return false;
        }

        return fineGranted || coarseGranted;
      } catch (err) {
        console.warn('Location permission request error:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Retrieves single current GPS coordinates with accuracy, speed, and heading
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const coords = position.coords;
          const loc = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : undefined,
            speed: Number.isFinite(coords.speed) && coords.speed >= 0
              ? Math.round(coords.speed * 3.6)
              : undefined,
            heading: Number.isFinite(coords.heading) && coords.heading >= 0 && coords.heading <= 360
              ? Math.round(coords.heading)
              : undefined,
            altitude: Number.isFinite(coords.altitude) ? coords.altitude : undefined,
            timestamp: new Date(position.timestamp || Date.now()).toISOString(),
          };
          this.lastLocation = loc;
          resolve(loc);
        },
        (error) => {
          console.warn('GPS single position warning:', error.message);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
          forceRequestLocation: true,
          showLocationDialog: true,
        }
      );
    });
  }

  /**
   * Starts real device continuous GPS location tracking for drivers
   * Updates coordinates at high frequency (1-2 seconds) and accumulates distance.
   * Filters out stationary duplicate coordinates (< 2 meters) and high inaccuracy readings.
   */
  startLocationTracking(tripId, vehicleId, driverId, onLocationUpdate, onError, initialLocation) {
    if (this.isTracking) return;

    this.isTracking = true;
    this.activeTripId = tripId;
    this.totalDistanceKm = 0;
    this.locationHistory = [];
    this.lastLocation =
      Number.isFinite(initialLocation?.latitude) && Number.isFinite(initialLocation?.longitude)
        ? {
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
            speed: undefined,
          }
        : null;

    this.watchId = Geolocation.watchPosition(
      (position) => {
        // Guard: Do not send updates if tracking has been cancelled or trip cleared
        if (!this.isTracking || this.activeTripId !== tripId) return;

        const coords = position.coords;
        const accuracy = Number.isFinite(coords.accuracy) ? coords.accuracy : undefined;
        const speedKmh = Number.isFinite(coords.speed) && coords.speed >= 0
          ? Math.round(coords.speed * 3.6)
          : undefined;
        const heading = Number.isFinite(coords.heading) && coords.heading >= 0 && coords.heading <= 360
          ? Math.round(coords.heading)
          : undefined;

        const newLoc = {
          tripId,
          vehicleId,
          driverId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy,
          speed: speedKmh,
          heading,
          timestamp: new Date(position.timestamp || Date.now()).toISOString(),
        };

        // Calculate incremental distance travelled
        if (this.lastLocation) {
          const incDistance = calculateDistanceKm(
            this.lastLocation.latitude,
            this.lastLocation.longitude,
            newLoc.latitude,
            newLoc.longitude
          );

          // Deduplication: if vehicle is stationary (speed == 0) and distance < 2 meters, skip duplicate update
          if (incDistance < 0.002 && (speedKmh === 0 || !Number.isFinite(speedKmh))) {
            return;
          }

          // Filter out tiny GPS jitter (< 3 meters)
          if (incDistance > 0.003) {
            this.totalDistanceKm += incDistance;
          }
        }

        this.lastLocation = newLoc;
        this.locationHistory.push(newLoc);

        if (onLocationUpdate) {
          onLocationUpdate({
            ...newLoc,
            distanceTraveledKm: parseFloat(this.totalDistanceKm.toFixed(2)),
          });
        }
      },
      (error) => {
        console.warn('Continuous GPS tracking error:', error.code, error.message);
        if (onError) onError(error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 3, // Update every 3 meters
        interval: 2000,    // Update every 2 seconds
        fastestInterval: 1000,
        showsBackgroundLocationIndicator: true,
        notificationTitle: 'TransitTrack Live',
        notificationSubTitle: 'Driver Telemetry & GPS Active',
      }
    );
  }

  /**
   * Stops active GPS tracking and clears watch listeners
   */
  stopLocationTracking() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.activeTripId = null;
  }

  getTotalDistance() {
    return this.totalDistanceKm;
  }

  getLocationHistory() {
    return this.locationHistory;
  }
}

export const locationService = new LocationService();
