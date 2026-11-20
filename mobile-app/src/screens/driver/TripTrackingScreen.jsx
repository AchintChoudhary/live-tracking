import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  BackHandler,
  Modal,
} from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { LiveBadge } from '../../components/LiveBadge';
import { MapContainer } from '../../components/MapContainer';
import { CustomButton } from '../../components/CustomButton';
import {
  SpeedIcon,
  ClockIcon,
  NavigationIcon,
  RadioTowerIcon,
  PinIcon,
  CheckCircleIcon,
} from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { locationService } from '../../services/locationService';
import { socketService } from '../../services/socket';
import { driverApi, locationApi } from '../../services/api';

export const TripTrackingScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { tripId, tripData, route: assignedRoute, vehicle } = route.params || {};

  const driverId = user?._id || user?.id || 'driver';
  const vehicleId = vehicle?._id || vehicle?.id;
  const routeId = assignedRoute?._id || assignedRoute?.id;

  const [currentLocation, setCurrentLocation] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [isGpsActive, setIsGpsActive] = useState(true);
  const [gpsError, setGpsError] = useState(null);
  const [ending, setEnding] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [currentTripStatus, setCurrentTripStatus] = useState('On Route');
  const [isSimulating, setIsSimulating] = useState(false);

  const durationTimerRef = useRef(null);
  const simulationIntervalRef = useRef(null);
  const simulationStepRef = useRef(0);

  // Prevent accidental hardware back button on Android during active trip
  useEffect(() => {
    const backAction = () => {
      Alert.alert('Trip in Progress', 'Do you want to end this trip or continue driving?', [
        { text: 'Keep Driving', style: 'cancel' },
        { text: 'End Trip', style: 'destructive', onPress: handleEndTrip },
      ]);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [distanceKm, durationSeconds]);

  // Duration Timer
  useEffect(() => {
    durationTimerRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  // Bearing calculation between two geographic coordinates
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    return Math.round((brng + 360) % 360);
  };

  // Connect GPS & Socket.IO telemetry
  useEffect(() => {
    // 1. Connect Socket.IO & register trip start
    socketService.connect().then(() => {
      socketService.driverJoin(driverId);
      socketService.startTrip({
        tripId,
        vehicleId,
        routeId,
      });
      socketService.subscribeTrip(tripId);
    });

    // 2. Start hardware GPS tracking initially
    startHardwareGps();

    return () => {
      stopAllTracking();
      socketService.unsubscribeTrip(tripId);
    };
  }, [tripId, vehicleId, driverId, routeId]);

  const startHardwareGps = () => {
    locationService.startLocationTracking(
      tripId,
      vehicleId,
      driverId,
      (location) => {
        setCurrentLocation(location);
        setCurrentSpeed(location.speed || 0);
        setIsGpsActive(true);
        setGpsError(null);

        // Transmit live GPS coordinates via Socket.IO
        socketService.sendLocationUpdate(
          {
            tripId,
            vehicleId,
            driverId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy || 10,
            speed: location.speed || 0,
            heading: location.heading || 0,
            timestamp: location.timestamp,
          },
          () => {}
        );

        // Update local distance calculation
        const dist = locationService.getTotalDistance();
        setDistanceKm(dist);
      },
      (error) => {
        setIsGpsActive(false);
        setGpsError(error?.message || 'GPS Signal Lost');
      }
    );
  };

  const stopAllTracking = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    locationService.stopLocationTracking();
  };

  // Demo Simulation Mode: smoothly interpolates bus movement along route waypoints
  const toggleSimulation = () => {
    if (isSimulating) {
      // Deactivate simulation -> revert to real hardware GPS
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      setIsSimulating(false);
      startHardwareGps();
    } else {
      // Activate simulation -> pause hardware GPS
      locationService.stopLocationTracking();
      setIsSimulating(true);
      setIsGpsActive(true);
      setGpsError(null);
      startSimulation();
    }
  };

  const startSimulation = () => {
    const rawCoords = assignedRoute?.coordinates || [];
    if (!rawCoords || rawCoords.length < 2) {
      Alert.alert('Simulation Notice', 'Route coordinates unavailable for simulation.');
      setIsSimulating(false);
      startHardwareGps();
      return;
    }

    // Interpolate points between coordinates for ultra-smooth presentation movement
    const waypoints = [];
    for (let i = 0; i < rawCoords.length - 1; i++) {
      const p1 = rawCoords[i];
      const p2 = rawCoords[i + 1];
      const subdivisions = 4;
      for (let s = 0; s < subdivisions; s++) {
        const frac = s / subdivisions;
        waypoints.push({
          latitude: p1.latitude + (p2.latitude - p1.latitude) * frac,
          longitude: p1.longitude + (p2.longitude - p1.longitude) * frac,
        });
      }
    }
    waypoints.push(rawCoords[rawCoords.length - 1]);

    simulationIntervalRef.current = setInterval(() => {
      let nextIdx = simulationStepRef.current + 1;
      if (nextIdx >= waypoints.length) {
        nextIdx = 0; // seamlessly loop for presentation
      }
      simulationStepRef.current = nextIdx;

      const currPoint = waypoints[nextIdx];
      const prevPoint = waypoints[nextIdx === 0 ? waypoints.length - 1 : nextIdx - 1];
      const heading = calculateBearing(
        prevPoint.latitude,
        prevPoint.longitude,
        currPoint.latitude,
        currPoint.longitude
      );

      const simSpeed = 32; // 32 km/h
      const incDist = 0.035; // ~35 meters per 2s tick
      setDistanceKm((prev) => parseFloat((prev + incDist).toFixed(2)));
      setCurrentSpeed(simSpeed);

      const simLocation = {
        latitude: currPoint.latitude,
        longitude: currPoint.longitude,
        accuracy: 4,
        speed: simSpeed,
        heading,
        timestamp: new Date().toISOString(),
      };

      setCurrentLocation(simLocation);

      // Transmit live coordinates over Socket.IO to passenger map radar
      socketService.sendLocationUpdate({
        tripId,
        vehicleId,
        driverId,
        latitude: simLocation.latitude,
        longitude: simLocation.longitude,
        accuracy: 4,
        speed: simSpeed,
        heading,
        timestamp: simLocation.timestamp,
      });
    }, 2000);
  };

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const remSecs = secs % 60;
    if (hrs > 0) {
      return `${hrs}h ${remMins}m ${remSecs}s`;
    }
    return `${remMins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  const handleUpdateStatus = async (statusLabel) => {
    setCurrentTripStatus(statusLabel);
    setStatusModalVisible(false);

    try {
      socketService.sendTripStatus({
        tripId,
        status: statusLabel,
        timestamp: new Date().toISOString(),
      });

      await driverApi.updateTripStatus({
        tripId,
        status: statusLabel,
      });
    } catch (e) {
      console.log('Status update error:', e);
    }
  };

  const handleEndTrip = () => {
    Alert.alert('Confirm End Trip', 'Are you sure you want to finish this trip and release vehicle tracking?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish Trip',
        style: 'destructive',
        onPress: executeEndTrip,
      },
    ]);
  };

  const executeEndTrip = async () => {
    setEnding(true);
    try {
      // 1. Stop location tracking and simulation immediately
      stopAllTracking();

      // 2. Send socket event
      socketService.sendTripEnd({
        tripId,
        vehicleId,
      });

      // 3. Update backend database
      await driverApi.endTrip({
        tripId,
        endLocation: {
          name: assignedRoute?.destination || 'Destination Depot',
          latitude: currentLocation?.latitude || assignedRoute?.coordinates?.[assignedRoute.coordinates.length - 1]?.latitude || 37.7749,
          longitude: currentLocation?.longitude || assignedRoute?.coordinates?.[assignedRoute.coordinates.length - 1]?.longitude || -122.4194,
        },
        distance: distanceKm,
        duration: durationSeconds,
      });

      // 4. Navigate to Trip Completed screen
      navigation.replace('EndTrip', {
        tripDetails: {
          tripId,
          routeName: assignedRoute?.routeName || 'Transit Route',
          routeNumber: assignedRoute?.routeNumber || 'R-1',
          vehicleNumber: vehicle?.vehicleNumber || 'Transit Bus',
          duration: formatDuration(durationSeconds),
          distance: `${distanceKm.toFixed(2)} km`,
          endTime: new Date().toLocaleTimeString(),
        },
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to complete trip in server.');
    } finally {
      setEnding(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <Header
        title={assignedRoute?.routeName || 'Active Trip'}
        subtitle={`Bus #${vehicle?.vehicleNumber || 'Transit Bus'} • ${currentTripStatus}`}
        rightAction={<LiveBadge label="TRANSMITTING" size="sm" />}
      />

      {/* Interactive Map View */}
      <View style={styles.mapWrapper}>
        <MapContainer
          busLocation={currentLocation}
          routeCoordinates={assignedRoute?.coordinates || []}
          stops={assignedRoute?.stops || []}
          startingPoint={assignedRoute?.startingPoint}
          destination={assignedRoute?.destination}
          showCoordinates
          showCenterButton
          style={StyleSheet.absoluteFillObject}
        />

        {/* GPS Indicator Overlay */}
        <View style={styles.gpsIndicatorOverlay}>
          <RadioTowerIcon size={16} color={isSimulating ? COLORS.success : isGpsActive ? COLORS.success : COLORS.danger} />
          <Text style={styles.gpsIndicatorText}>
            {isSimulating ? 'Demo GPS: 32 km/h' : isGpsActive ? `GPS Lock (±${Math.round(currentLocation?.accuracy || 8)}m)` : gpsError || 'Acquiring GPS Signal...'}
          </Text>
        </View>

        {/* Presentation Simulation Mode Toggle */}
        <TouchableOpacity
          style={[styles.simFab, isSimulating && styles.simFabActive]}
          activeOpacity={0.85}
          onPress={toggleSimulation}
        >
          <Text style={[styles.simFabText, isSimulating && styles.simFabTextActive]}>
            {isSimulating ? '⚡ SIMULATING' : '▶ DEMO: SIMULATE BUS'}
          </Text>
        </TouchableOpacity>

        {/* Change Trip Status Button */}
        <TouchableOpacity
          style={styles.statusFab}
          activeOpacity={0.85}
          onPress={() => setStatusModalVisible(true)}
        >
          <Text style={styles.statusFabText}>Report Status</Text>
        </TouchableOpacity>
      </View>

      {/* Live Telemetry Panel */}
      <View style={[styles.telemetryPanel, SHADOWS.lg]}>
        <View style={styles.routeHeaderRow}>
          <View style={styles.routeInfoCol}>
            <Text style={styles.routeNumberTag}>{assignedRoute?.routeNumber || 'ROUTE'}</Text>
            <Text style={styles.destText} numberOfLines={1}>
              Heading towards: {assignedRoute?.destination || 'Terminal'}
            </Text>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE GPS</Text>
          </View>
        </View>

        {/* Metrics Bar */}
        <View style={styles.metricsBar}>
          <View style={styles.metricItem}>
            <ClockIcon size={20} color={COLORS.primary} />
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{formatDuration(durationSeconds)}</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <NavigationIcon size={20} color={COLORS.primary} />
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>{distanceKm.toFixed(2)} km</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <SpeedIcon size={20} color={COLORS.primary} />
            <Text style={styles.metricLabel}>Speed</Text>
            <Text style={styles.metricValue}>{Math.round(currentSpeed)} km/h</Text>
          </View>
        </View>

        {/* End Trip Button */}
        <CustomButton
          title="End Trip & Stop Telemetry"
          variant="danger"
          size="lg"
          loading={ending}
          onPress={handleEndTrip}
          style={styles.endBtn}
        />
      </View>

      {/* Quick Status Selection Modal */}
      <Modal visible={statusModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, SHADOWS.lg]}>
            <Text style={styles.modalTitle}>Update Live Trip Status</Text>
            <Text style={styles.modalSubtitle}>Passengers on this route will receive this status immediately:</Text>

            {['On Route (Normal Schedule)', 'At Designated Stop', 'Moderate Delay (+5m)', 'Severe Congestion Delay', 'Approaching Destination'].map((st) => (
              <TouchableOpacity
                key={st}
                style={styles.modalOption}
                onPress={() => handleUpdateStatus(st)}
              >
                <Text style={styles.modalOptionText}>{st}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setStatusModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  gpsIndicatorOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(23, 32, 51, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  gpsIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  simFab: {
    position: 'absolute',
    top: 50,
    left: 14,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    elevation: 4,
  },
  simFabActive: {
    backgroundColor: COLORS.success,
    borderColor: '#86EFAC',
  },
  simFabText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  simFabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  statusFab: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusFabText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  telemetryPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  routeNumberTag: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  destText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  livePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  metricsBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    height: '80%',
    alignSelf: 'center',
  },
  endBtn: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalCloseBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});
