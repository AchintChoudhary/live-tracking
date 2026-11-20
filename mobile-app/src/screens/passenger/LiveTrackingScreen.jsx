import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { LiveBadge } from '../../components/LiveBadge';
import { MapContainer } from '../../components/MapContainer';
import {
  BusIcon,
  ClockIcon,
  NavigationIcon,
  RadioTowerIcon,
  ChevronRightIcon,
} from '../../components/Icons';
import { socketService } from '../../services/socket';
import { routeApi, passengerApi } from '../../services/api';

export const LiveTrackingScreen = ({ route: navRoute, navigation }) => {
  const {
    selectedRoute: initialRoute,
    routeNumber,
    initialVehicle,
    passengerLocation,
    boardingStop,
    destinationStop,
  } = navRoute.params || {};

  const [activeRoute, setActiveRoute] = useState(initialRoute || null);
  const [activeVehicles, setActiveVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(initialVehicle || null);
  const [selectedStop, setSelectedStop] = useState(boardingStop || null);
  const [liveLocation, setLiveLocation] = useState(
    initialVehicle?.currentLocation || initialVehicle?.latestLocation || null
  );
  const [etaDisplay, setEtaDisplay] = useState('ETA unavailable');
  const [distanceDisplay, setDistanceDisplay] = useState('Unavailable');
  const [lastUpdateText, setLastUpdateText] = useState('No GPS update yet');
  const [loading, setLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [tripLiveStatus, setTripLiveStatus] = useState('Status unavailable');
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Load configured routes and current active trips.
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [routesRes, vehiclesRes] = await Promise.all([
        routeApi.getAllRoutes(),
        passengerApi.getActiveVehicles(),
      ]);

      let chosenRoute = activeRoute || initialVehicle?.route || initialRoute || null;
      if (routesRes.data?.data) {
        if (!chosenRoute && routeNumber) {
          chosenRoute = routesRes.data.data.find((r) => r.routeNumber === routeNumber) || null;
        }
      }

      if (vehiclesRes.data?.data) {
        setActiveVehicles(vehiclesRes.data.data);
        const routeVehicles = vehiclesRes.data.data.filter(
          (v) => !chosenRoute || v.route?._id === chosenRoute?._id || v.route?.routeNumber === chosenRoute?.routeNumber
        );
        const chosenVehicle = routeVehicles.find(
          (item) => String(item.tripId) === String(initialVehicle?.tripId)
        ) || routeVehicles[0] || null;
        setSelectedVehicle(chosenVehicle);
        setLiveLocation(chosenVehicle?.latestLocation || chosenVehicle?.currentLocation || null);
        if (chosenVehicle) {
          chosenRoute = chosenRoute || chosenVehicle.route || null;
          setTripLiveStatus(chosenVehicle.status || chosenVehicle.liveStatus || 'Status unavailable');
          const location = chosenVehicle.latestLocation || chosenVehicle.currentLocation;
          if (location?.timestamp) setLastUpdateText(new Date(location.timestamp).toLocaleTimeString());
        }
      }
      setActiveRoute(chosenRoute);
    } catch (err) {
      console.log('Error loading initial tracking data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe only to trips shown on this map.
  useEffect(() => {
    let active = true;
    const relevantTrips = activeVehicles.filter((vehicle) =>
      !activeRoute || vehicle.route?._id === activeRoute._id ||
      vehicle.route?.routeNumber === activeRoute.routeNumber
    );
    const tripIds = relevantTrips.map((vehicle) => String(vehicle.tripId));
    const unsubscribeLocation = socketService.onVehicleLocation((data) => {
      if (!active || !tripIds.includes(String(data?.tripId))) return;
      const location = {
        tripId: data.tripId,
        vehicleId: data.vehicleId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading,
        accuracy: data.accuracy,
        timestamp: data.timestamp,
      };
      setActiveVehicles((current) => current.map((vehicle) =>
        String(vehicle.tripId) === String(data.tripId)
          ? { ...vehicle, latestLocation: location }
          : vehicle
      ));
      if (String(data.tripId) === String(selectedVehicle?.tripId)) {
        setLiveLocation(location);
        setLastUpdateText(new Date(data.timestamp).toLocaleTimeString());
      }
    });
    const unsubscribeStatus = socketService.onTripStatus((data) => {
      if (active && String(data?.tripId) === String(selectedVehicle?.tripId)) {
        setTripLiveStatus(data.liveStatus || data.status || 'Status unavailable');
      }
    });
    const unsubscribeCompleted = socketService.onTripCompleted((data) => {
      if (!active || !tripIds.includes(String(data?.tripId))) return;
      setActiveVehicles((current) => current.filter(
        (vehicle) => String(vehicle.tripId) !== String(data.tripId)
      ));
      if (String(data.tripId) === String(selectedVehicle?.tripId)) {
        setEtaDisplay('Trip completed');
        setTripLiveStatus('Trip completed');
      }
    });
    const unsubscribeConnect = socketService.on('connect', () => setIsSocketConnected(true));
    const unsubscribeDisconnect = socketService.on('disconnect', () => setIsSocketConnected(false));

    socketService.connect()
      .then((socket) => {
        if (!active) return;
        setIsSocketConnected(!!socket?.connected);
        tripIds.forEach((tripId) => {
          socketService.subscribeTrip(tripId, (response) => {
            if (!active || !response?.hasCachedLocation || !response.lastLocation) return;
            const location = response.lastLocation;
            setActiveVehicles((current) => current.map((vehicle) =>
              String(vehicle.tripId) === tripId
                ? { ...vehicle, latestLocation: location }
                : vehicle
            ));
            if (tripId === String(selectedVehicle?.tripId)) {
              setLiveLocation(location);
              setLastUpdateText(new Date(location.timestamp).toLocaleTimeString());
            }
          });
        });
      })
      .catch((error) => console.warn('Live map connection failed:', error.message));

    return () => {
      active = false;
      unsubscribeLocation();
      unsubscribeStatus();
      unsubscribeCompleted();
      unsubscribeConnect();
      unsubscribeDisconnect();
      tripIds.forEach((tripId) => socketService.unsubscribeTrip(tripId));
    };
  }, [activeRoute?._id, activeVehicles.map((vehicle) => vehicle.tripId).join('|'), selectedVehicle?.tripId]);

  // Driving ETA and road distance are provided by the configured routing service.
  useEffect(() => {
    let active = true;
    const refreshEta = async () => {
      const tripId = selectedVehicle?.tripId;
      if (!tripId || !selectedStop?._id) {
        setEtaDisplay('ETA unavailable');
        setDistanceDisplay('Unavailable');
        return;
      }
      try {
        const response = await passengerApi.getTripEta(
          tripId,
          selectedStop._id,
          destinationStop?._id
        );
        if (!active) return;
        const eta = response.data?.data;
        if (eta?.etaMinutes == null) {
          setEtaDisplay((eta?.etaStatus || 'ETA unavailable').replace(/-/g, ' '));
          setDistanceDisplay('Unavailable');
          return;
        }
        setEtaDisplay(`${eta.etaMinutes} min`);
        setDistanceDisplay(
          eta.distanceMeters == null ? 'Unavailable' : `${(eta.distanceMeters / 1000).toFixed(1)} km road`
        );
      } catch (error) {
        if (!active) return;
        setEtaDisplay('ETA unavailable');
        setDistanceDisplay('Unavailable');
        if (error.response?.status !== 409 && error.response?.status !== 404) {
          console.warn('Driving ETA unavailable:', error.message);
        }
      }
    };

    refreshEta();
    const timer = setInterval(refreshEta, 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedVehicle?.tripId, selectedStop?._id, destinationStop?._id]);

  // Prepare vehicle markers for MapContainer
  const mapVehicles = activeVehicles
    .filter((v) => v.latestLocation && (!activeRoute || v.route?._id === activeRoute._id || v.route?.routeNumber === activeRoute.routeNumber))
    .map((v) => ({
      tripId: v.tripId,
      vehicleId: v.vehicle?._id,
      vehicleNumber: v.vehicle?.vehicleNumber || 'Bus',
      latitude: v.tripId === liveLocation?.tripId ? liveLocation.latitude : v.latestLocation.latitude,
      longitude: v.tripId === liveLocation?.tripId ? liveLocation.longitude : v.latestLocation.longitude,
      speed: v.tripId === liveLocation?.tripId ? liveLocation.speed : v.latestLocation?.speed,
      heading: v.tripId === liveLocation?.tripId ? liveLocation.heading : v.latestLocation?.heading,
      accuracy: v.tripId === liveLocation?.tripId ? liveLocation.accuracy : v.latestLocation?.accuracy,
    }));

  const displayLocation =
    liveLocation ||
    (mapVehicles[0]
      ? {
          tripId: mapVehicles[0].tripId,
          vehicleId: mapVehicles[0].vehicleId,
          latitude: mapVehicles[0].latitude,
          longitude: mapVehicles[0].longitude,
          speed: mapVehicles[0].speed,
          heading: mapVehicles[0].heading,
          vehicleNumber: mapVehicles[0].vehicleNumber,
          timestamp: mapVehicles[0].timestamp,
        }
      : null);
  const locationTimestamp = displayLocation?.timestamp
    ? new Date(displayLocation.timestamp).getTime()
    : NaN;
  const gpsIsStale =
    !Number.isFinite(locationTimestamp) ||
    clockNow - locationTimestamp > 2 * 60 * 1000;
  const eligibleBoardingStops = (activeRoute?.stops || []).filter(
    (stop) => !destinationStop || stop.order < destinationStop.order
  );

  return (
    <View style={styles.container}>
      <Header
        title={activeRoute?.routeName || 'Live Transit Radar'}
        subtitle={`Route ${activeRoute?.routeNumber || 'Transit'} • ${mapVehicles.length} active ${mapVehicles.length === 1 ? 'bus' : 'buses'}`}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={<LiveBadge label={isSocketConnected ? 'RADAR LIVE' : 'CONNECTING'} size="sm" />}
      />

      {/* Main Map View */}
      <View style={styles.mapWrapper}>
        <MapContainer
          busLocation={displayLocation}
          userLocation={passengerLocation}
          vehicles={mapVehicles}
          routeCoordinates={activeRoute?.coordinates || []}
          routeCoordinatesVerified={activeRoute?.coordinatesVerified === true}
          stops={eligibleBoardingStops}
          startingPoint={activeRoute?.startingPoint}
          destination={activeRoute?.destination}
          selectedStop={selectedStop}
          destinationStop={destinationStop}
          onStopSelect={(stop) => {
            if (!destinationStop || stop.order < destinationStop.order) setSelectedStop(stop);
          }}
          selectedVehicleId={selectedVehicle?.tripId || selectedVehicle?.vehicle?._id}
          onVehicleSelect={(veh) => {
            const matched = activeVehicles.find((v) => v.tripId === veh.tripId || v.vehicle?._id === veh.vehicleId);
            if (matched) {
              setSelectedVehicle(matched);
              const location = matched.latestLocation || matched.currentLocation || null;
              setLiveLocation(location);
              if (location?.timestamp) setLastUpdateText(new Date(location.timestamp).toLocaleTimeString());
            }
          }}
          showCenterButton
          style={StyleSheet.absoluteFillObject}
        />

        {/* Live Radar Capsule */}
        <View style={styles.radarCapsule}>
          <RadioTowerIcon size={16} color={displayLocation && !gpsIsStale ? COLORS.success : COLORS.warning} />
          <Text style={styles.radarText}>
            {displayLocation
              ? `${gpsIsStale ? 'GPS stale' : 'Live GPS'} · ${lastUpdateText}`
              : 'No driver GPS update'}
          </Text>
        </View>

        {/* View Route Timeline Shortcut */}
        <TouchableOpacity
          style={styles.timelineFab}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('RouteUpdates', {
              tripId: selectedVehicle?.tripId,
              tripData: selectedVehicle,
              route: activeRoute,
              selectedStop,
              destinationStop,
              liveLocation,
            })
          }
        >
          <Text style={styles.timelineFabText}>Stop Timeline</Text>
          <ChevronRightIcon size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Stop & ETA Info Bottom Drawer */}
      <View style={[styles.drawer, SHADOWS.lg]}>
        <View style={styles.drawerHandle} />

        {/* Vehicle Selection Carousel / Information Card */}
        <View style={styles.busInfoRow}>
          <View style={styles.busBadgeBox}>
            <BusIcon size={24} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.liveTagRow}>
              <Text style={styles.vehicleNumberTag}>
                {selectedVehicle?.vehicle?.vehicleNumber || mapVehicles[0]?.vehicleNumber || 'Bus'}
              </Text>
              <LiveBadge label={selectedVehicle?.tripId ? 'TRACKING' : 'NO ACTIVE TRIP'} size="sm" />
            </View>
            <Text style={styles.terminalSubtext} numberOfLines={1}>
              {activeRoute
                ? `${activeRoute.startingPoint} → ${activeRoute.destination}`
                : 'No route selected'}
            </Text>
            <Text style={styles.terminalSubtext} numberOfLines={1}>
              Status: {tripLiveStatus}
            </Text>
          </View>
        </View>

        {/* Target Stop Details & ETA */}
        <View style={styles.stopInfoBox}>
          <View style={styles.stopInfoLeft}>
            <Text style={styles.stopLabel}>Target Stop:</Text>
            <Text style={styles.stopName} numberOfLines={1}>
              {selectedStop?.name || 'Select a route stop'}
            </Text>
          </View>

          <View style={styles.etaBox}>
            <Text style={styles.etaNumber}>{etaDisplay}</Text>
            <Text style={styles.etaLabel}>Est. Arrival</Text>
          </View>
        </View>

        {/* Distance & Telemetry Metrics */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <NavigationIcon size={18} color={COLORS.primary} />
            <Text style={styles.statLabel}>Distance to Stop</Text>
            <Text style={styles.statVal}>{distanceDisplay}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <ClockIcon size={18} color={COLORS.primary} />
            <Text style={styles.statLabel}>Last Telemetry</Text>
            <Text style={styles.statVal}>{lastUpdateText}</Text>
          </View>
        </View>

        {/* Bus Stop Selector Chips */}
        <Text style={styles.selectStopPrompt}>Select a boarding stop for driving ETA:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stopsScroll}
        >
          {eligibleBoardingStops.map((stop, index) => {
            const isSelected = selectedStop?.name === stop.name;
            return (
              <TouchableOpacity
                key={`stop-btn-${stop.name}-${index}`}
                style={[styles.stopChip, isSelected && styles.stopChipSelected]}
                onPress={() => setSelectedStop(stop)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.stopChipIndex, isSelected && styles.stopChipIndexSelected]}
                >
                  #{index + 1}
                </Text>
                <Text
                  style={[styles.stopChipName, isSelected && styles.stopChipNameSelected]}
                  numberOfLines={1}
                >
                  {stop.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  radarCapsule: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(23, 32, 51, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  radarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  timelineFab: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
  },
  timelineFabText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 4,
  },
  drawer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  busInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  busBadgeBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E8F1FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleNumberTag: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  terminalSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  stopInfoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  stopInfoLeft: {
    flex: 1,
    marginRight: 10,
  },
  stopLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stopName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  etaBox: {
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
    minWidth: 90,
  },
  etaNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#15803D',
  },
  etaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  statVal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F1F5F9',
    height: '80%',
    alignSelf: 'center',
  },
  selectStopPrompt: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  stopsScroll: {
    paddingBottom: 4,
  },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stopChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  stopChipIndex: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginRight: 6,
  },
  stopChipIndexSelected: {
    color: '#FFFFFF',
  },
  stopChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    maxWidth: 120,
  },
  stopChipNameSelected: {
    color: '#FFFFFF',
  },
});
