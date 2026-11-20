import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { LiveBadge } from '../../components/LiveBadge';
import { MapContainer } from '../../components/MapContainer';
import {
  BusIcon,
  PinIcon,
  ClockIcon,
  NavigationIcon,
  RadioTowerIcon,
  ChevronRightIcon,
  UserIcon,
} from '../../components/Icons';
import { socketService } from '../../services/socket';
import { routeApi, passengerApi } from '../../services/api';
import { calculateDistanceKm, calculateETA } from '../../utils/distance';

export const LiveTrackingScreen = ({ route: navRoute, navigation }) => {
  const { selectedRoute: initialRoute, routeNumber } = navRoute.params || {};

  const [routes, setRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(initialRoute || null);
  const [activeVehicles, setActiveVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const [etaDisplay, setEtaDisplay] = useState('Calculating...');
  const [distanceDisplay, setDistanceDisplay] = useState('Calculating...');
  const [lastUpdateText, setLastUpdateText] = useState('Connecting...');
  const [loading, setLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [tripLiveStatus, setTripLiveStatus] = useState('On Schedule');

  const activeTripSubscribedRef = useRef(null);

  // 1. Load routes & active vehicles on mount
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

      let chosenRoute = activeRoute;
      if (routesRes.data?.data) {
        setRoutes(routesRes.data.data);
        if (!chosenRoute && routesRes.data.data.length > 0) {
          const match = routeNumber
            ? routesRes.data.data.find((r) => r.routeNumber === routeNumber)
            : routesRes.data.data[0];
          chosenRoute = match || routesRes.data.data[0];
          setActiveRoute(chosenRoute);
        }
      }

      if (chosenRoute?.stops && chosenRoute.stops.length > 0) {
        setSelectedStop(chosenRoute.stops[0]);
      }

      if (vehiclesRes.data?.data) {
        setActiveVehicles(vehiclesRes.data.data);
        // Find vehicle matching this route
        const routeVehicles = vehiclesRes.data.data.filter(
          (v) => v.route?._id === chosenRoute?._id || v.route?.routeNumber === chosenRoute?.routeNumber
        );
        if (routeVehicles.length > 0) {
          setSelectedVehicle(routeVehicles[0]);
          if (routeVehicles[0].latestLocation) {
            setLiveLocation(routeVehicles[0].latestLocation);
          }
        }
      }
    } catch (err) {
      console.log('Error loading initial tracking data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Manage Socket.IO Subscription to selected vehicle/trip
  useEffect(() => {
    let unsubscribeLocation = null;
    let unsubscribeStatus = null;
    let unsubscribeStarted = null;
    let unsubscribeCompleted = null;

    socketService.connect().then(() => {
      setIsSocketConnected(true);
      socketService.passengerJoin('guest_passenger');

      // Subscribe to trip if active
      const targetTripId = selectedVehicle?.tripId;
      if (targetTripId) {
        if (activeTripSubscribedRef.current && activeTripSubscribedRef.current !== targetTripId) {
          socketService.unsubscribeTrip(activeTripSubscribedRef.current);
        }
        activeTripSubscribedRef.current = targetTripId;
        socketService.subscribeTrip(targetTripId, (res) => {
          if (res?.hasCachedLocation && res.lastLocation) {
            setLiveLocation(res.lastLocation);
            setLastUpdateText('Just now');
          }
        });
      }

      // Listen for dynamically initiated trips on this route
      unsubscribeStarted = socketService.onTripStarted((data) => {
        if (data && (!activeRoute || data.routeId === activeRoute._id || data.routeId === activeRoute.id)) {
          loadData();
          socketService.subscribeTrip(data.tripId);
        }
      });

      // Listen for real-time driver trip status reports
      unsubscribeStatus = socketService.onTripStatus((data) => {
        if (data && (!selectedVehicle || data.tripId === selectedVehicle?.tripId)) {
          const statusText = data.liveStatus || data.status;
          if (statusText) {
            setTripLiveStatus(statusText);
          }
        }
      });

      // Listen for vehicle location updates
      unsubscribeLocation = socketService.onVehicleLocation((data) => {
        if (data && (!selectedVehicle || data.vehicleId === selectedVehicle.vehicle?._id || data.tripId === selectedVehicle.tripId)) {
          setLiveLocation({
            tripId: data.tripId,
            vehicleId: data.vehicleId,
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed || 0,
            heading: data.heading || 0,
            accuracy: data.accuracy || 10,
            timestamp: data.timestamp,
          });

          // Compute friendly elapsed update string
          setLastUpdateText('Just now');
        }
      });

      // Listen for trip completed
      unsubscribeCompleted = socketService.onTripCompleted((data) => {
        if (data.tripId === selectedVehicle?.tripId) {
          Alert.alert('Trip Concluded', 'The driver has completed this route. Telemetry has stopped.');
          setEtaDisplay('Trip Completed');
          setTripLiveStatus('Concluded');
        }
      });
    });

    return () => {
      if (unsubscribeLocation) unsubscribeLocation();
      if (unsubscribeStarted) unsubscribeStarted();
      if (unsubscribeStatus) unsubscribeStatus();
      if (unsubscribeCompleted) unsubscribeCompleted();
      if (activeTripSubscribedRef.current) {
        socketService.unsubscribeTrip(activeTripSubscribedRef.current);
      }
    };
  }, [selectedVehicle?.tripId, activeRoute?._id]);

  // 3. Compute ETA and remaining distance
  useEffect(() => {
    if (liveLocation && selectedStop) {
      const dist = calculateDistanceKm(
        liveLocation.latitude,
        liveLocation.longitude,
        selectedStop.latitude,
        selectedStop.longitude
      );

      if (dist >= 0) {
        setDistanceDisplay(`${dist.toFixed(2)} km`);

        // ETA calculation with speed check
        if (liveLocation.speed > 3) {
          const etaMins = calculateETA(dist, liveLocation.speed);
          setEtaDisplay(`${etaMins} mins`);
        } else if (dist < 0.05) {
          setEtaDisplay('Arrived at Stop');
        } else {
          // Average transit urban speed
          const etaMins = calculateETA(dist, 25);
          setEtaDisplay(`~${etaMins} mins`);
        }
      } else {
        setDistanceDisplay('Distance unavailable');
        setEtaDisplay('ETA unavailable');
      }
    } else if (selectedStop && activeRoute?.coordinates?.[0]) {
      // Vehicle hasn't reported location yet
      setDistanceDisplay('Awaiting GPS...');
      setEtaDisplay('ETA unavailable');
    } else {
      setDistanceDisplay('Distance unavailable');
      setEtaDisplay('ETA unavailable');
    }
  }, [liveLocation, selectedStop, activeRoute]);

  // Prepare vehicle markers for MapContainer
  const mapVehicles = activeVehicles
    .filter((v) => !activeRoute || v.route?._id === activeRoute._id || v.route?.routeNumber === activeRoute.routeNumber)
    .map((v) => ({
      tripId: v.tripId,
      vehicleId: v.vehicle?._id,
      vehicleNumber: v.vehicle?.vehicleNumber || 'BUS',
      latitude: v.tripId === liveLocation?.tripId ? liveLocation.latitude : v.latestLocation?.latitude || activeRoute?.coordinates?.[0]?.latitude || 37.7749,
      longitude: v.tripId === liveLocation?.tripId ? liveLocation.longitude : v.latestLocation?.longitude || activeRoute?.coordinates?.[0]?.longitude || -122.4194,
      speed: v.tripId === liveLocation?.tripId ? liveLocation.speed : v.latestLocation?.speed || 0,
      heading: v.tripId === liveLocation?.tripId ? liveLocation.heading : v.latestLocation?.heading || 0,
      accuracy: v.tripId === liveLocation?.tripId ? liveLocation.accuracy : 10,
    }));

  const fallbackLocation =
    liveLocation ||
    (mapVehicles[0]
      ? {
          latitude: mapVehicles[0].latitude,
          longitude: mapVehicles[0].longitude,
          speed: mapVehicles[0].speed,
          vehicleNumber: mapVehicles[0].vehicleNumber,
        }
      : activeRoute?.coordinates?.[0]
      ? {
          latitude: activeRoute.coordinates[0].latitude,
          longitude: activeRoute.coordinates[0].longitude,
          speed: 0,
          vehicleNumber: 'BUS-01',
        }
      : null);

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
          busLocation={fallbackLocation}
          vehicles={mapVehicles}
          routeCoordinates={activeRoute?.coordinates || []}
          stops={activeRoute?.stops || []}
          startingPoint={activeRoute?.startingPoint}
          destination={activeRoute?.destination}
          selectedStop={selectedStop}
          onStopSelect={(stop) => setSelectedStop(stop)}
          selectedVehicleId={selectedVehicle?.tripId || selectedVehicle?.vehicle?._id}
          onVehicleSelect={(veh) => {
            const matched = activeVehicles.find((v) => v.tripId === veh.tripId || v.vehicle?._id === veh.vehicleId);
            if (matched) setSelectedVehicle(matched);
          }}
          showCenterButton
          style={StyleSheet.absoluteFillObject}
        />

        {/* Live Radar Capsule */}
        <View style={styles.radarCapsule}>
          <RadioTowerIcon size={16} color={liveLocation ? COLORS.success : COLORS.warning} />
          <Text style={styles.radarText}>
            {liveLocation ? `Live GPS Stream (${lastUpdateText})` : 'Awaiting Driver Telemetry'}
          </Text>
        </View>

        {/* View Route Timeline Shortcut */}
        <TouchableOpacity
          style={styles.timelineFab}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('RouteUpdates', {
              route: activeRoute,
              selectedStop,
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
                {selectedVehicle?.vehicle?.vehicleNumber || mapVehicles[0]?.vehicleNumber || 'Transit Bus'}
              </Text>
              <LiveBadge label="TRACKING" size="sm" />
            </View>
            <Text style={styles.terminalSubtext} numberOfLines={1}>
              {activeRoute?.startingPoint || 'Origin'} ➔ {activeRoute?.destination || 'Destination'}
            </Text>
          </View>
        </View>

        {/* Target Stop Details & ETA */}
        <View style={styles.stopInfoBox}>
          <View style={styles.stopInfoLeft}>
            <Text style={styles.stopLabel}>Target Stop:</Text>
            <Text style={styles.stopName} numberOfLines={1}>
              {selectedStop?.name || 'Central Transit Station'}
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
        <Text style={styles.selectStopPrompt}>Select Target Stop for Live Countdown:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stopsScroll}
        >
          {activeRoute?.stops?.map((stop, index) => {
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
