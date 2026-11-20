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
} from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { locationService } from '../../services/locationService';
import { socketService } from '../../services/socket';
import { driverApi } from '../../services/api';

export const TripTrackingScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { tripId, tripData, route: assignedRoute, vehicle } = route.params || {};

  const driverId = user?._id || user?.id;
  const vehicleId = vehicle?._id || vehicle?.id;
  const routeId = assignedRoute?._id || assignedRoute?.id;

  const [currentLocation, setCurrentLocation] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(() => {
    const startTime = new Date(tripData?.startTime).getTime();
    return Number.isFinite(startTime) ? Math.max(0, Math.floor((Date.now() - startTime) / 1000)) : 0;
  });
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [ending, setEnding] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [currentTripStatus, setCurrentTripStatus] = useState(tripData?.liveStatus || 'Status unavailable');

  const durationTimerRef = useRef(null);

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
    }).catch((error) => {
      console.warn('Trip socket connection failed:', error.message);
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
        setCurrentSpeed(Number.isFinite(location.speed) ? location.speed : null);
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
            accuracy: location.accuracy,
            speed: location.speed,
            heading: location.heading,
            timestamp: location.timestamp,
          },
          (response) => {
            if (response?.success === false) {
              setGpsError(response.error || 'Server rejected the GPS update');
            }
          }
        );

        // Update local distance calculation
        const dist = locationService.getTotalDistance();
        setDistanceKm(dist);
      },
      (error) => {
        setIsGpsActive(false);
        setGpsError(error?.message || 'GPS Signal Lost');
      },
      tripData?.startLocation
    );
  };

  const stopAllTracking = () => {
    locationService.stopLocationTracking();
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
    try {
      await driverApi.updateTripStatus({
        tripId,
        status: statusLabel,
      });
      setCurrentTripStatus(statusLabel);
      setStatusModalVisible(false);
    } catch (error) {
      Alert.alert('Status Update Failed', error.response?.data?.message || 'Could not update the trip status.');
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
      // Stop device location tracking immediately.
      stopAllTracking();

      // REST persists the lifecycle change and broadcasts it to the trip room.
      await driverApi.endTrip({
        tripId,
        endLocation: currentLocation
          ? {
              name: 'Last device GPS',
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }
          : undefined,
        distance: locationService.getLocationHistory().length ? distanceKm : undefined,
        duration: durationSeconds,
      });

      // Navigate to the trip summary with measured trip values.
      navigation.replace('EndTrip', {
        tripDetails: {
          tripId,
          routeName: assignedRoute?.routeName,
          routeNumber: assignedRoute?.routeNumber,
          vehicleNumber: vehicle?.vehicleNumber,
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
        title={assignedRoute?.routeName || 'Route unavailable'}
        subtitle={`Bus #${vehicle?.vehicleNumber || 'Registration unavailable'} • ${currentTripStatus}`}
        rightAction={<LiveBadge label={isGpsActive ? 'GPS ACTIVE' : 'GPS OFF'} size="sm" />}
      />

      {/* Interactive Map View */}
      <View style={styles.mapWrapper}>
        <MapContainer
          busLocation={currentLocation}
          routeCoordinates={assignedRoute?.coordinates || []}
          routeCoordinatesVerified={assignedRoute?.coordinatesVerified === true}
          stops={assignedRoute?.stops || []}
          startingPoint={assignedRoute?.startingPoint}
          destination={assignedRoute?.destination}
          showCoordinates
          showCenterButton
          style={StyleSheet.absoluteFillObject}
        />

        {/* GPS Indicator Overlay */}
        <View style={styles.gpsIndicatorOverlay}>
          <RadioTowerIcon size={16} color={isGpsActive ? COLORS.success : COLORS.danger} />
          <Text style={styles.gpsIndicatorText}>
            {isGpsActive
              ? currentLocation?.accuracy
                ? `GPS lock (±${Math.round(currentLocation.accuracy)}m)`
                : 'GPS lock'
              : gpsError || 'Waiting for device GPS'}
          </Text>
        </View>

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
            <Text style={styles.routeNumberTag}>{assignedRoute?.routeNumber || 'Route unavailable'}</Text>
            <Text style={styles.destText} numberOfLines={1}>
              Heading towards: {assignedRoute?.destination || 'Destination unavailable'}
            </Text>
          </View>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>{isGpsActive ? 'GPS ACTIVE' : 'GPS OFF'}</Text>
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
            <Text style={styles.metricValue}>
              {currentSpeed == null ? 'Unavailable' : `${Math.round(currentSpeed)} km/h`}
            </Text>
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
