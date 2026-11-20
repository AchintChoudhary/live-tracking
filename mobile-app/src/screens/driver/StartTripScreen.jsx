import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { CustomButton } from '../../components/CustomButton';
import {
  BusIcon,
  RouteIcon,
  PinIcon,
  ChevronRightIcon,
  CheckCircleIcon,
} from '../../components/Icons';
import { driverApi, vehicleApi } from '../../services/api';
import { locationService } from '../../services/locationService';

export const StartTripScreen = ({ navigation }) => {
  const [routes, setRoutes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const vehiclesRes = await vehicleApi.getMyVehicles();
      const assignedVehicles = vehiclesRes.data?.data || [];
      setVehicles(assignedVehicles);
      setRoutes(
        assignedVehicles
          .map((vehicle) => vehicle.assignedRoute)
          .filter((route, index, allRoutes) =>
            route && allRoutes.findIndex((item) => item?._id === route._id) === index
          )
      );
    } catch (err) {
      console.log('Error loading start trip options:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async () => {
    if (!selectedRoute) {
      Alert.alert('Route Missing', 'Please select a valid bus route.');
      return;
    }
    if (!selectedVehicle) {
      Alert.alert('Vehicle Missing', 'Please select an assigned transit vehicle.');
      return;
    }

    setStarting(true);
    try {
      // 1. Request GPS Android permissions
      const permGranted = await locationService.requestLocationPermissions();
      if (!permGranted) {
        Alert.alert(
          'Location Permission Required',
          'Android location permissions are required to stream live bus GPS coordinates to passengers.'
        );
        setStarting(false);
        return;
      }

      // Start only from a device GPS reading; route coordinates are not a substitute.
      let initialPos;
      try {
        initialPos = await locationService.getCurrentPosition();
      } catch (locationError) {
        Alert.alert('GPS Unavailable', locationError.message || 'Enable device location and try again.');
        return;
      }

      // 3. Call backend API to initiate the trip
      const res = await driverApi.startTrip({
        routeId: selectedRoute._id,
        vehicleId: selectedVehicle._id,
        startLocation: {
          name: 'Current device GPS',
          latitude: initialPos.latitude,
          longitude: initialPos.longitude,
        },
      });

      if (res.data?.success) {
        const trip = res.data.data;
        navigation.replace('TripTracking', {
          tripId: trip._id,
          tripData: trip,
          route: selectedRoute,
          vehicle: selectedVehicle,
        });
      } else {
        Alert.alert('Trip Start Failed', res.data?.message || 'Could not start trip.');
      }
    } catch (err) {
      Alert.alert(
        'Start Trip Error',
        err.response?.data?.message || 'Unable to start trip. Check backend connection.'
      );
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading assigned routes & fleet vehicles...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Start Trip"
        subtitle="Route & Vehicle Selection"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {vehicles.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No registered buses</Text>
            <Text style={styles.emptyText}>Register a bus and configure its ordered route stops before starting a trip.</Text>
            <TouchableOpacity style={styles.addBusButton} onPress={() => navigation.navigate('AddBus')}>
              <Text style={styles.addBusButtonText}>Register a Bus</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Section 1: Route Selection */}
        <View style={styles.sectionHeaderRow}>
          <RouteIcon size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>1. Select Bus Route</Text>
        </View>

        <View style={styles.optionsList}>
          {routes.map((route) => {
            const isSelected = selectedRoute?._id === route._id;
            return (
              <TouchableOpacity
                key={route._id}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  SHADOWS.sm,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedRoute(route);
                  const matchingVehicle = vehicles.find((vehicle) => vehicle.assignedRoute?._id === route._id);
                  if (matchingVehicle) setSelectedVehicle(matchingVehicle);
                }}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>{route.routeNumber}</Text>
                  </View>
                  <Text style={styles.routeName} numberOfLines={1}>
                    {route.routeName}
                  </Text>
                  {isSelected && (
                    <CheckCircleIcon size={22} color={COLORS.primary} />
                  )}
                </View>

                <View style={styles.routePoints}>
                  <View style={styles.pointRow}>
                    <View style={[styles.pointDot, { backgroundColor: COLORS.success }]} />
                    <Text style={styles.pointLabel}>From:</Text>
                    <Text style={styles.pointValue}>{route.startingPoint}</Text>
                  </View>
                  <View style={styles.pointLine} />
                  <View style={styles.pointRow}>
                    <View style={[styles.pointDot, { backgroundColor: COLORS.danger }]} />
                    <Text style={styles.pointLabel}>To:</Text>
                    <Text style={styles.pointValue}>{route.destination}</Text>
                  </View>
                </View>

                <View style={styles.routeMeta}>
                  <Text style={styles.metaText}>
                    Stops: {route.stops?.length || 0} designated stops
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section 2: Vehicle Selection */}
        <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
          <BusIcon size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>2. Select Assigned Vehicle</Text>
        </View>

        <View style={styles.optionsList}>
          {vehicles.map((v) => {
            const isSelected = selectedVehicle?._id === v._id;
            return (
              <TouchableOpacity
                key={v._id}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  SHADOWS.sm,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedVehicle(v);
                  setSelectedRoute(v.assignedRoute || null);
                }}
              >
                <View style={styles.optionHeader}>
                  <View style={[styles.routeBadge, { backgroundColor: '#F1F5F9' }]}>
                    <BusIcon size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.vehicleNumber}>{v.vehicleNumber}</Text>
                    <Text style={styles.vehicleType}>
                      {v.vehicleType} • Capacity: {v.capacity} passengers
                    </Text>
                  </View>
                  {isSelected && (
                    <CheckCircleIcon size={22} color={COLORS.primary} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Summary Details Box */}
        {selectedRoute && selectedVehicle && (
          <View style={[styles.summaryBox, SHADOWS.sm]}>
            <Text style={styles.summaryTitle}>Trip Summary Details</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Route Number:</Text>
              <Text style={styles.summaryVal}>{selectedRoute.routeNumber}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Assigned Bus:</Text>
              <Text style={styles.summaryVal}>{selectedVehicle.vehicleNumber}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Starting Origin:</Text>
              <Text style={styles.summaryVal}>{selectedRoute.startingPoint}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Destination:</Text>
              <Text style={styles.summaryVal}>{selectedRoute.destination}</Text>
            </View>
          </View>
        )}

        {/* Start Trip CTA */}
        <CustomButton
          title="Start Trip & Begin GPS Tracking"
          variant="primary"
          size="lg"
          loading={starting}
          onPress={handleStartTrip}
          style={styles.startBtn}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  optionsList: {
    marginBottom: 16,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    marginBottom: 10,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F8FAFF',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeBadge: {
    backgroundColor: '#E8F1FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10,
  },
  routeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  routeName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  routePoints: {
    marginTop: 12,
    paddingLeft: 6,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pointLine: {
    width: 2,
    height: 12,
    backgroundColor: '#CBD5E1',
    marginLeft: 3,
    marginVertical: 2,
  },
  pointLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 42,
  },
  pointValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  routeMeta: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  vehicleNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  vehicleType: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  startBtn: {
    width: '100%',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 18,
  },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 5 },
  addBusButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center', borderRadius: 9, backgroundColor: '#E8F1FD' },
  addBusButtonText: { color: COLORS.primary, fontWeight: '800' },
});
