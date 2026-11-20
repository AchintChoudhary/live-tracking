import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Header } from '../../components/Header';
import { MapContainer } from '../../components/MapContainer';
import { COLORS, SHADOWS } from '../../utils/theme';
import { locationService } from '../../services/locationService';
import { passengerApi, routeApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { calculateDistanceKm } from '../../utils/distance';

const STOP_RADIUS_OPTIONS = [0.5, 1, 2, 5];

export const PassengerBusSearchScreen = ({ navigation, route: navRoute }) => {
  const [routes, setRoutes] = useState([]);
  const [passengerLocation, setPassengerLocation] = useState(navRoute.params?.passengerLocation || null);
  const [locationLabel, setLocationLabel] = useState('Locating you…');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [manualOriginStop, setManualOriginStop] = useState(null);
  const [destinationStop, setDestinationStop] = useState(null);
  const [boardingStopId, setBoardingStopId] = useState(null);
  const [radiusKm, setRadiusKm] = useState(1);
  const [buses, setBuses] = useState([]);
  const [nearestStops, setNearestStops] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const latestBusesRef = useRef([]);

  const origin = passengerLocation || manualOriginStop;
  const selectedBus = buses.find((bus) => String(bus.tripId) === String(selectedTripId)) || buses[0];
  const destinationChoices = useMemo(
    () =>
      routes.flatMap((route) =>
        (route.stops || []).map((stop) => ({
          ...stop,
          routeId: route._id,
          routeName: route.routeName,
          routeNumber: route.routeNumber,
        }))
      ),
    [routes]
  );
  const manualBoardingChoices = useMemo(() => {
    if (!destinationStop) return [];
    return routes.flatMap((route) => {
      if (String(route._id) !== String(destinationStop.routeId)) return [];
      const sortedStops = [...(route.stops || [])].sort((a, b) => a.order - b.order);
      const destinationIndex = sortedStops.findIndex(
        (stop) => String(stop._id) === String(destinationStop._id)
      );
      return sortedStops.slice(0, Math.max(destinationIndex, 0)).map((stop) => ({
        ...stop,
        routeId: route._id,
        routeName: route.routeName,
        distanceKm: origin
          ? calculateDistanceKm(origin.latitude, origin.longitude, stop.latitude, stop.longitude)
          : null,
      }));
    });
  }, [destinationStop, routes, origin]);

  useEffect(() => {
    routeApi.getAllRoutes()
      .then((response) => setRoutes(response.data?.data || []))
      .catch((error) => {
        console.warn('Route stops are unavailable:', error.message);
        setLocationError('Route stops are unavailable. Check your connection and refresh.');
      });
    if (passengerLocation) {
      setLocationLabel('Current location detected');
      updateAddress(passengerLocation);
    } else {
      refreshPassengerLocation();
    }
  }, []);

  useEffect(() => {
    latestBusesRef.current = buses;
  }, [buses]);

  useEffect(() => {
    if (!buses.length) return undefined;
    let active = true;
    const tripIds = buses.map((bus) => String(bus.tripId));
    const locationListener = socketService.onVehicleLocation((event) => {
      if (!active || !tripIds.includes(String(event?.tripId))) return;
      setSocketConnected(true);
      setBuses((current) =>
        current.map((bus) =>
          String(bus.tripId) === String(event.tripId)
            ? {
                ...bus,
                currentLocation: {
                  latitude: event.latitude,
                  longitude: event.longitude,
                  speed: event.speed,
                  heading: event.heading,
                  timestamp: event.timestamp,
                },
                locationUpdatedAt: event.timestamp,
                locationStatus: 'current',
              }
            : bus
        )
      );
    });
    const statusListener = socketService.onTripStatus((event) => {
      if (!active || !tripIds.includes(String(event?.tripId))) return;
      setBuses((current) =>
        current.map((bus) =>
          String(bus.tripId) === String(event.tripId)
            ? { ...bus, status: event.liveStatus || event.status || bus.status }
            : bus
        )
      );
    });
    const completedListener = socketService.onTripCompleted((event) => {
      if (!active || !tripIds.includes(String(event?.tripId))) return;
      setBuses((current) => current.filter((bus) => String(bus.tripId) !== String(event.tripId)));
    });
    const connectedListener = socketService.on('connect', () => setSocketConnected(true));
    const disconnectedListener = socketService.on('disconnect', () => setSocketConnected(false));

    socketService.connect()
      .then((socket) => {
        if (!active) return;
        setSocketConnected(!!socket?.connected);
        tripIds.forEach((tripId) => {
          socketService.subscribeTrip(tripId, (ack) => {
            if (ack?.hasCachedLocation && ack.lastLocation) {
              setBuses((current) =>
                current.map((bus) =>
                  String(bus.tripId) === tripId
                    ? { ...bus, currentLocation: ack.lastLocation }
                    : bus
                )
              );
            }
          });
        });
      })
      .catch((error) => console.warn('Live bus connection failed:', error.message));

    return () => {
      active = false;
      locationListener();
      statusListener();
      completedListener();
      connectedListener();
      disconnectedListener();
      tripIds.forEach((tripId) => socketService.unsubscribeTrip(tripId));
    };
  }, [buses.map((bus) => bus.tripId).join('|')]);

  useEffect(() => {
    if (!buses.length) return undefined;
    const timer = setInterval(async () => {
      const currentBuses = latestBusesRef.current;
      const updates = await Promise.all(
        currentBuses.map(async (bus) => {
          try {
            const response = await passengerApi.getTripEta(
              bus.tripId,
              bus.boardingStop._id,
              bus.destinationStop?._id
            );
            return { tripId: bus.tripId, eta: response.data?.data };
          } catch (error) {
            console.warn(`ETA refresh failed for trip ${bus.tripId}:`, error.message);
            return null;
          }
        })
      );
      setBuses((current) =>
        current.map((bus) => {
          const update = updates.find((item) => String(item?.tripId) === String(bus.tripId));
          return update?.eta ? { ...bus, ...update.eta } : bus;
        }).sort((a, b) => {
          if (a.etaMinutes == null) return b.etaMinutes == null ? 0 : 1;
          if (b.etaMinutes == null) return -1;
          return a.etaMinutes - b.etaMinutes;
        })
      );
    }, 45000);
    return () => clearInterval(timer);
  }, [buses.length]);

  const updateAddress = async (location) => {
    try {
      const response = await passengerApi.reverseGeocode(location.latitude, location.longitude);
      if (response.data?.data?.address) setLocationLabel(response.data.data.address);
    } catch (error) {
      setLocationLabel(
        `Near ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      );
      if (error.response?.status !== 503 && error.response?.status !== 404) {
        console.warn('Reverse geocoding unavailable:', error.message);
      }
    }
  };

  const refreshPassengerLocation = async () => {
    setLocationLoading(true);
    setLocationError('');
    try {
      const permitted = await locationService.requestLocationPermissions();
      if (!permitted) {
        setLocationError('Location permission was denied. Choose a stop below as your starting point.');
        setLocationLabel('Location permission denied');
        return;
      }
      const location = await locationService.getCurrentPosition();
      setPassengerLocation(location);
      setManualOriginStop(null);
      setLocationLabel(`Near ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
      updateAddress(location);
    } catch (error) {
      setLocationError('GPS is unavailable. Choose a nearby bus stop as your starting point.');
      setLocationLabel('Current location unavailable');
    } finally {
      setLocationLoading(false);
    }
  };

  const searchBuses = async (selectedBoardingStopId = boardingStopId) => {
    if (!origin) {
      setLocationError('Choose a starting location before searching.');
      return;
    }
    if (!destinationStop) {
      setLocationError('Select a destination stop.');
      return;
    }

    setSearching(true);
    setLocationError('');
    setSearched(true);
    try {
      const response = await passengerApi.searchBuses({
        passengerLat: origin.latitude,
        passengerLng: origin.longitude,
        destinationStopId: destinationStop._id,
        boardingStopId: selectedBoardingStopId || undefined,
        radiusKm,
      });
      const resultBuses = response.data?.data || [];
      setBuses(resultBuses);
      setNearestStops(response.data?.nearestBoardingStops || []);
      setSelectedTripId(resultBuses[0]?.tripId || null);
    } catch (error) {
      setBuses([]);
      setNearestStops([]);
      setLocationError(
        error.response?.data?.message || 'Bus search failed. Check your connection and try again.'
      );
    } finally {
      setSearching(false);
    }
  };

  const mapVehicles = buses
    .filter((bus) => bus.currentLocation)
    .map((bus) => ({
      tripId: bus.tripId,
      vehicleId: bus.vehicle?._id,
      busName: bus.busName,
      vehicleNumber: bus.vehicle?.vehicleNumber || bus.busName,
      etaMinutes: bus.etaMinutes,
      latitude: bus.currentLocation.latitude,
      longitude: bus.currentLocation.longitude,
      speed: bus.currentLocation.speed || 0,
      heading: bus.currentLocation.heading || 0,
      timestamp: bus.currentLocation.timestamp,
    }));

  const openLiveTracking = (bus) => {
    if (!bus) return;
    navigation.navigate('LiveTracking', {
      selectedRoute: bus.route,
      initialVehicle: bus,
      passengerLocation: origin,
      boardingStop: bus.boardingStop,
      destinationStop: bus.destinationStop,
    });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Find Active Buses"
        subtitle="Choose your origin and destination"
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.locationCard, SHADOWS.sm]}>
          <Text style={styles.fieldLabel}>FROM</Text>
          <Text style={styles.locationValue} numberOfLines={2}>
            {manualOriginStop
              ? `${manualOriginStop.name} (selected stop)`
              : locationLabel}
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={refreshPassengerLocation} disabled={locationLoading}>
            {locationLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
            <Text style={styles.secondaryButtonText}>Use My Current Location</Text>
          </TouchableOpacity>
          {!passengerLocation && (
            <>
              <Text style={styles.helperText}>Or select a bus stop as your starting location:</Text>
              <View style={styles.chipRow}>
                {destinationChoices.slice(0, 12).map((stop) => (
                  <TouchableOpacity
                    key={`origin-${stop.routeId}-${stop._id}`}
                    style={[
                      styles.chip,
                      manualOriginStop?._id === stop._id && styles.chipActive,
                    ]}
                    onPress={() => setManualOriginStop(stop)}
                  >
                    <Text style={[styles.chipText, manualOriginStop?._id === stop._id && styles.chipTextActive]}>
                      {stop.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={[styles.locationCard, SHADOWS.sm]}>
          <Text style={styles.fieldLabel}>TO — SELECT DESTINATION STOP</Text>
          <View style={styles.chipRow}>
            {destinationChoices.map((stop) => (
              <TouchableOpacity
                key={`destination-${stop.routeId}-${stop._id}`}
                style={[
                  styles.chip,
                  destinationStop?._id === stop._id && styles.chipActive,
                ]}
                onPress={() => {
                  setDestinationStop(stop);
                  setBoardingStopId(null);
                }}
              >
                <Text style={[styles.chipText, destinationStop?._id === stop._id && styles.chipTextActive]}>
                  {stop.name} · {stop.routeNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.fieldLabel, styles.radiusLabel]}>NEARBY BOARDING RADIUS</Text>
          <View style={styles.chipRow}>
            {STOP_RADIUS_OPTIONS.map((radius) => (
              <TouchableOpacity
                key={`radius-${radius}`}
                style={[styles.radiusChip, radiusKm === radius && styles.chipActive]}
                onPress={() => setRadiusKm(radius)}
              >
                <Text style={[styles.chipText, radiusKm === radius && styles.chipTextActive]}>
                  {radius} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {destinationStop && manualBoardingChoices.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, styles.radiusLabel]}>OPTIONAL: CHOOSE BOARDING STOP</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !boardingStopId && styles.chipActive]}
                  onPress={() => setBoardingStopId(null)}
                >
                  <Text style={[styles.chipText, !boardingStopId && styles.chipTextActive]}>Any nearby stop</Text>
                </TouchableOpacity>
                {manualBoardingChoices.map((stop) => (
                  <TouchableOpacity
                    key={`boarding-${stop.routeId}-${stop._id}`}
                    style={[styles.chip, boardingStopId === stop._id && styles.chipActive]}
                    onPress={() => setBoardingStopId(stop._id)}
                  >
                    <Text style={[styles.chipText, boardingStopId === stop._id && styles.chipTextActive]}>
                      {stop.name}{stop.distanceKm == null ? '' : ` · ${stop.distanceKm.toFixed(1)} km`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <TouchableOpacity
            style={[styles.searchButton, searching && styles.disabledButton]}
            onPress={() => searchBuses()}
            disabled={searching}
          >
            {searching ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.searchButtonText}>FIND ACTIVE BUSES</Text>}
          </TouchableOpacity>
          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
        </View>

        {origin && (buses.length > 0 || !searched) && (
          <View style={styles.mapCard}>
            <View style={styles.mapTitleRow}>
              <Text style={styles.sectionTitle}>{searched ? 'Matching buses' : 'Your location'}</Text>
              <Text style={styles.connectionLabel}>{socketConnected ? 'LIVE' : 'Connecting'}</Text>
            </View>
            <MapContainer
              userLocation={origin}
              vehicles={mapVehicles}
              selectedVehicleId={selectedTripId}
              onVehicleSelect={(vehicle) => {
                const bus = buses.find((item) => String(item.tripId) === String(vehicle.tripId));
                setSelectedTripId(vehicle.tripId);
                openLiveTracking(bus);
              }}
              routeCoordinates={selectedBus?.route?.coordinates || []}
              routeCoordinatesVerified={selectedBus?.route?.coordinatesVerified === true}
              stops={selectedBus?.route?.stops || []}
              startingPoint={selectedBus?.route?.startingPoint}
              destination={selectedBus?.route?.destination}
              selectedStop={selectedBus?.boardingStop || destinationStop}
              destinationStop={selectedBus?.destinationStop || destinationStop}
              showCenterButton
              style={styles.map}
            />
            {locationLabel ? <Text style={styles.mapCaption}>Passenger: {locationLabel}</Text> : null}
          </View>
        )}

        {searched && nearestStops.length > 0 && buses.length === 0 && (
          <View style={styles.nearestCard}>
            <Text style={styles.sectionTitle}>No matching active bus found</Text>
            <Text style={styles.helperText}>Closest eligible boarding stops are listed below:</Text>
            {nearestStops.map((stop) => (
              <TouchableOpacity
                key={`nearest-${stop.routeId}-${stop._id}`}
                style={styles.nearestRow}
                onPress={() => {
                  setBoardingStopId(stop._id);
                  searchBuses(stop._id);
                }}
              >
                <Text style={styles.nearestName}>{stop.name} · {stop.routeNumber}</Text>
                <Text style={styles.nearestDistance}>{stop.distanceKm.toFixed(2)} km · Use stop</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {searched && buses.length === 0 && nearestStops.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.sectionTitle}>No active buses available for your selected route.</Text>
            <Text style={styles.helperText}>Try another destination or refresh when a trip is active.</Text>
          </View>
        )}

        {buses.map((bus) => (
          <TouchableOpacity
            key={String(bus.tripId)}
            style={[styles.busCard, SHADOWS.sm, String(selectedTripId) === String(bus.tripId) && styles.busCardSelected]}
            onPress={() => setSelectedTripId(bus.tripId)}
            activeOpacity={0.85}
          >
            <View style={styles.busHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.busName}>{bus.busName}</Text>
                <Text style={styles.busRegistration}>{bus.vehicle?.vehicleNumber || 'Registration unavailable'} · {bus.route?.routeNumber}</Text>
              </View>
              <Text style={styles.eta}>{bus.etaMinutes == null ? 'ETA —' : `${bus.etaMinutes} min`}</Text>
            </View>
            <Text style={styles.routeText}>{bus.startingPoint} → {bus.destination}</Text>
            <Text style={styles.infoText}>Board: {bus.boardingStop?.name} · {bus.passengerDistanceMeters} m away</Text>
            <Text style={styles.infoText}>Destination: {bus.destinationStop?.name}</Text>
            <Text style={styles.infoText}>
              Current bus position: {bus.currentLocation
                ? `${bus.currentLocation.latitude.toFixed(5)}, ${bus.currentLocation.longitude.toFixed(5)}`
                : 'GPS unavailable'}
            </Text>
            <Text style={styles.infoText}>Bus status: {bus.status || 'Unavailable'}</Text>
            <Text style={styles.infoText}>
              GPS: {bus.locationStatus === 'stale'
                ? 'Stale; waiting for a fresh driver update'
                : bus.locationStatus === 'current'
                  ? 'Live'
                  : 'Unavailable'}
            </Text>
            <Text style={styles.infoText}>
              Arrival ETA: {bus.etaMinutes == null ? (bus.etaStatus || 'Unavailable').split('-').join(' ') : bus.estimatedArrivalTime ? new Date(bus.estimatedArrivalTime).toLocaleTimeString() : `${bus.etaMinutes} min`}
            </Text>
            {bus.dwellEstimateNote ? <Text style={styles.infoText}>{bus.dwellEstimateNote}</Text> : null}
            <Text style={styles.infoText}>
              Travel after boarding: {bus.travelTimeToDestinationMinutes == null ? 'Unavailable' : `~${bus.travelTimeToDestinationMinutes} min`}
            </Text>
            <Text style={styles.infoText}>
              Last GPS: {bus.locationUpdatedAt ? new Date(bus.locationUpdatedAt).toLocaleTimeString() : 'Unavailable'}
            </Text>
            <TouchableOpacity
              style={styles.trackButton}
              onPress={() => openLiveTracking(bus)}
            >
              <Text style={styles.trackButtonText}>TRACK LIVE</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 36 },
  locationCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.cardBorder },
  fieldLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8 },
  locationValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  secondaryButton: { minHeight: 40, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  secondaryButtonText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  helperText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  radiusLabel: { marginTop: 8 },
  radiusChip: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  searchButton: { minHeight: 48, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  disabledButton: { opacity: 0.65 },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: '600', marginTop: 10 },
  mapCard: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: COLORS.cardBorder },
  mapTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
  connectionLabel: { color: COLORS.success, fontSize: 11, fontWeight: '900' },
  map: { height: 260 },
  mapCaption: { fontSize: 11, color: COLORS.textSecondary, padding: 10 },
  nearestCard: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  nearestRow: { borderTopWidth: 1, borderColor: '#FED7AA', paddingVertical: 10 },
  nearestName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  nearestDistance: { color: COLORS.primary, fontSize: 12, marginTop: 2, fontWeight: '700' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginBottom: 14, alignItems: 'center' },
  busCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, marginBottom: 12, borderWidth: 1.5, borderColor: COLORS.cardBorder },
  busCardSelected: { borderColor: COLORS.primary },
  busHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  busName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '900' },
  busRegistration: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  eta: { color: COLORS.success, fontSize: 16, fontWeight: '900', marginLeft: 8 },
  routeText: { color: COLORS.primary, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  infoText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  trackButton: { height: 40, backgroundColor: '#E8F1FD', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  trackButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: '900' },
});
