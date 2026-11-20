import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { RouteIcon, BusIcon, ClockIcon, NavigationIcon } from '../../components/Icons';
import { driverApi } from '../../services/api';

export const DriverHistoryScreen = ({ navigation }) => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrips = async () => {
    try {
      const res = await driverApi.getTrips();
      if (res.data?.data) {
        setTrips(res.data.data);
      }
    } catch (err) {
      console.log('Error fetching driver trips:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const renderTripItem = ({ item }) => {
    const isCompleted = item.status === 'completed';
    return (
      <View style={[styles.tripCard, SHADOWS.sm]}>
        <View style={styles.cardHeader}>
          <View style={styles.routeCol}>
            <Text style={styles.routeNumber}>{item.routeId?.routeNumber || 'R-101'}</Text>
            <Text style={styles.routeName} numberOfLines={1}>
              {item.routeId?.routeName || 'Transit Route'}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isCompleted ? COLORS.successLight : '#FEE2E2' },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: isCompleted ? COLORS.success : COLORS.danger },
              ]}
            >
              {item.status?.toUpperCase() || 'COMPLETED'}
            </Text>
          </View>
        </View>

        <View style={styles.vehicleRow}>
          <BusIcon size={16} color={COLORS.textSecondary} />
          <Text style={styles.vehicleText}>
            Vehicle: {item.vehicleId?.vehicleNumber || 'BUS-01'} ({item.vehicleId?.vehicleType || 'Standard Transit'})
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Start Time</Text>
            <Text style={styles.metaValue}>
              {item.startTime ? new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:30 AM'}
            </Text>
          </View>

          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>End Time</Text>
            <Text style={styles.metaValue}>
              {item.endTime ? new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:15 AM'}
            </Text>
          </View>

          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Distance</Text>
            <Text style={styles.metaValue}>
              {item.distance ? `${item.distance.toFixed(1)} km` : '12.4 km'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="My Trip History"
        subtitle="Completed driver shifts & telemetry"
        showBack
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Fetching shift history...</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item._id || Math.random().toString()}
          renderItem={renderTripItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchTrips();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No Trips Logged Yet</Text>
              <Text style={styles.emptySubtitle}>
                Completed trips will appear here with complete timestamps, route numbers, and distance logs.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: 20,
    paddingBottom: 30,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  routeCol: {
    flex: 1,
    marginRight: 8,
  },
  routeNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  metaGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
