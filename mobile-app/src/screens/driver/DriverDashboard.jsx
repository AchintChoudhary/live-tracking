import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { StatCard } from '../../components/StatCard';
import {
  BusIcon,
  NavigationIcon,
  RouteIcon,
  HistoryIcon,
  UserIcon,
  ChevronRightIcon,
  RadioTowerIcon,
  CheckCircleIcon,
} from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { driverApi } from '../../services/api';

export const DriverDashboard = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await driverApi.getDashboard();
      if (res.data?.success) {
        setDashboardData(res.data.data);
        setDashboardError('');
      } else {
        setDashboardError('Driver data is unavailable. Refresh to try again.');
      }
    } catch (err) {
      setDashboardError(err.response?.data?.message || 'Driver data is unavailable. Check your connection and refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const unsubscribe = navigation.addListener('focus', fetchDashboard);
    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Header
        title="Driver Dashboard"
        subtitle="Manage your buses and active trips"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboard} />}
        showsVerticalScrollIndicator={false}
      >
        {dashboardError ? <Text style={styles.dataError}>{dashboardError}</Text> : null}
        {/* Driver Profile Card */}
        <View style={[styles.profileCard, SHADOWS.sm]}>
          <View style={styles.avatarCircle}>
            <UserIcon size={30} color={COLORS.primary} />
          </View>
          <View style={styles.profileText}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.driverName}>{user?.name || 'Driver'}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusLabel}>
                {!dashboardData
                  ? loading ? 'Checking trip status…' : 'Trip status unavailable'
                  : dashboardData.activeTrip ? 'On Active Duty (Trip Running)' : 'Ready for Dispatch'}
              </Text>
            </View>
          </View>
        </View>

        {/* Active Trip Banner if currently running */}
        {dashboardData?.activeTrip && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.activeTripBanner, SHADOWS.md]}
            onPress={() =>
              navigation.navigate('TripTracking', {
                tripId: dashboardData.activeTrip._id,
                tripData: dashboardData.activeTrip,
                route: dashboardData.activeTrip.routeId,
                vehicle: dashboardData.activeTrip.vehicleId,
              })
            }
          >
            <View style={styles.bannerRow}>
              <View style={styles.bannerIconBox}>
                <RadioTowerIcon size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.bannerTag}>ACTIVE TRIP IN PROGRESS</Text>
                <Text style={styles.bannerRoute}>
                  {dashboardData.activeTrip.routeId?.routeName || 'Route unavailable'}
                </Text>
                <Text style={styles.bannerVehicle}>
                  Bus #{dashboardData.activeTrip.vehicleId?.vehicleNumber || 'Registration unavailable'}
                </Text>
              </View>
              <ChevronRightIcon size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Primary Action Cards Grid */}
        <Text style={styles.sectionHeader}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {/* Start Trip Card */}
          <TouchableOpacity
            style={[styles.actionCard, { borderColor: '#BFDBFE' }, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('StartTrip')}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#E8F1FD' }]}>
              <BusIcon size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.actionCardTitle}>Start New Trip</Text>
            <Text style={styles.actionCardDesc}>
              Select route, check vehicle, and begin live GPS transmission.
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterLink}>Launch Trip</Text>
              <ChevronRightIcon size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>

          {/* My Trips Card */}
          <TouchableOpacity
            style={[styles.actionCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DriverHistory')}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#F1F5F9' }]}>
              <HistoryIcon size={26} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.actionCardTitle}>My Trips</Text>
            <Text style={styles.actionCardDesc}>
              View completed shifts, logs, total kilometers and transit records.
            </Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.cardFooterLink, { color: COLORS.textSecondary }]}>View History</Text>
              <ChevronRightIcon size={16} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DriverVehicles')}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#F1F5F9' }]}>
              <BusIcon size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.actionCardTitle}>My Buses</Text>
            <Text style={styles.actionCardDesc}>View your registered buses and configured routes.</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.cardFooterLink, { color: COLORS.textSecondary }]}>View Fleet</Text>
              <ChevronRightIcon size={16} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AddBus')}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#DCFCE7' }]}>
              <RouteIcon size={26} color={COLORS.success} />
            </View>
            <Text style={styles.actionCardTitle}>Register a Bus</Text>
            <Text style={styles.actionCardDesc}>Add a bus and select its ordered route stops.</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterLink}>Add Bus</Text>
              <ChevronRightIcon size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Configured fleet summary */}
        <View style={styles.fullWidthCardWrapper}>
          <TouchableOpacity
            style={[styles.infoCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DriverVehicles')}
          >
            <View style={styles.infoCardContent}>
              <View style={[styles.cardIconBox, { backgroundColor: '#DCFCE7' }]}>
                <RouteIcon size={26} color={COLORS.success} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.infoCardTitle}>Your Registered Fleet</Text>
                <Text style={styles.infoCardDesc}>
                  {dashboardData ? `${dashboardData.assignedVehicles?.length ?? 0} registered bus${dashboardData.assignedVehicles?.length === 1 ? '' : 'es'}` : 'Fleet data unavailable'}
                </Text>
              </View>
              <ChevronRightIcon size={20} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Key Metrics / Profile Summary */}
        <Text style={styles.sectionHeader}>Completed Trip Stats</Text>
        <View style={styles.statsRow}>
          <StatCard
            icon={<CheckCircleIcon size={22} color={COLORS.success} />}
            label="Total Trips"
            value={dashboardData ? dashboardData.totalTrips : '—'}
            color={COLORS.success}
          />
          <StatCard
            icon={<NavigationIcon size={22} color={COLORS.primary} />}
            label="Distance"
            value={
              dashboardData?.totalDistance == null
                ? 'Unavailable'
                : `${Number(dashboardData.totalDistance).toFixed(1)} km`
            }
            color={COLORS.primary}
          />
        </View>

        {/* Logout / Switch */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to log out of the Driver portal?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: logout },
            ]);
          }}
        >
          <Text style={styles.logoutBtnText}>Sign Out from Driver Portal</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F1FD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    marginRight: 16,
  },
  profileText: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeTripBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTag: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bannerRoute: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  bannerVehicle: {
    color: '#E0F2FE',
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
    marginTop: 6,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginHorizontal: 4,
    justifyContent: 'space-between',
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  actionCardDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardFooterLink: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 4,
  },
  fullWidthCardWrapper: {
    marginBottom: 18,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  infoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  infoCardDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  logoutBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
  },
  logoutBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  dataError: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
});
