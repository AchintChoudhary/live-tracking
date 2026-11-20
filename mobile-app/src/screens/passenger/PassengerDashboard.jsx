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
import { CustomInput } from '../../components/CustomInput';
import {
  SearchIcon,
  BusIcon,
  RouteIcon,
  HeartIcon,
  HistoryIcon,
  ChevronRightIcon,
  PinIcon,
  RadioTowerIcon,
  UserIcon,
} from '../../components/Icons';
import { LiveBadge } from '../../components/LiveBadge';
import { useAuth } from '../../context/AuthContext';
import { passengerApi } from '../../services/api';

export const PassengerDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeVehicles, setActiveVehicles] = useState([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState([
    { id: '1', number: 'R-101', name: 'North-South Metro Express' },
    { id: '2', number: 'R-202', name: 'Uptown Circular Line' },
  ]);

  const fetchActiveVehicles = async () => {
    setLoading(true);
    try {
      const res = await passengerApi.getActiveVehicles();
      if (res.data?.data) {
        setActiveVehicles(res.data.data);
      }
    } catch (err) {
      console.log('Error fetching active vehicles:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveVehicles();
    const unsubscribe = navigation.addListener('focus', fetchActiveVehicles);
    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Header
        title={`Hello, ${user?.name?.split(' ')[0] || 'Passenger'} 👋`}
        subtitle="Where are you travelling today?"
        hasNotification
        onNotificationPress={() =>
          Alert.alert('Transit Alert', 'All main lines operating smoothly. Normal service.')
        }
        rightAction={
          <TouchableOpacity
            style={styles.profileAvatarBtn}
            onPress={() => navigation.navigate('PassengerProfile')}
          >
            <UserIcon size={20} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchActiveVehicles} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Route Input */}
        <View style={styles.searchSection}>
          <CustomInput
            placeholder="Search route, stop, or bus number..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<SearchIcon size={20} color={COLORS.textSecondary} />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* Live Tracking Card (Highlight) */}
        <TouchableOpacity
          style={[styles.highlightCard, SHADOWS.md]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('LiveTracking')}
        >
          <View style={styles.highlightHeader}>
            <View style={styles.highlightBadge}>
              <RadioTowerIcon size={16} color="#FFFFFF" />
              <Text style={styles.highlightBadgeText}>REAL-TIME RADAR</Text>
            </View>
            <LiveBadge label="ACTIVE" size="sm" />
          </View>
          <Text style={styles.highlightTitle}>Live Bus Tracking</Text>
          <Text style={styles.highlightDesc}>
            View live moving buses, stop estimates and real-time GPS locations on Google Maps.
          </Text>
          <View style={styles.highlightFooter}>
            <Text style={styles.highlightLink}>Open Map Radar</Text>
            <ChevronRightIcon size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* 4 Feature Cards Grid */}
        <Text style={styles.sectionTitle}>Transit Services</Text>
        <View style={styles.gridRow}>
          {/* Routes Card */}
          <TouchableOpacity
            style={[styles.serviceCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Routes')}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#E8F1FD' }]}>
              <RouteIcon size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.serviceTitle}>Bus Routes</Text>
            <Text style={styles.serviceDesc}>Browse all lines, schedules & stops</Text>
          </TouchableOpacity>

          {/* Live Tracking / Map Card */}
          <TouchableOpacity
            style={[styles.serviceCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('LiveTracking')}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#DCFCE7' }]}>
              <BusIcon size={24} color={COLORS.success} />
            </View>
            <Text style={styles.serviceTitle}>Live Vehicles</Text>
            <Text style={styles.serviceDesc}>{activeVehicles.length || 2} buses on route</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridRow}>
          {/* Favorites Card */}
          <TouchableOpacity
            style={[styles.serviceCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Routes', { filter: 'favorites' })}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#FEE2E2' }]}>
              <HeartIcon size={24} color={COLORS.danger} filled />
            </View>
            <Text style={styles.serviceTitle}>Favorites</Text>
            <Text style={styles.serviceDesc}>Saved lines & quick access</Text>
          </TouchableOpacity>

          {/* Trip History / Updates Card */}
          <TouchableOpacity
            style={[styles.serviceCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('RouteUpdates')}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#FEF3C7' }]}>
              <HistoryIcon size={24} color={COLORS.warning} />
            </View>
            <Text style={styles.serviceTitle}>Timeline Updates</Text>
            <Text style={styles.serviceDesc}>Arrival countdowns & stop logs</Text>
          </TouchableOpacity>
        </View>

        {/* Favorite Corridors Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Favorite Corridors</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Routes')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {favoriteRoutes.map((route) => (
          <TouchableOpacity
            key={route.id}
            style={[styles.favRow, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('LiveTracking', { routeNumber: route.number })}
          >
            <View style={styles.favBadge}>
              <Text style={styles.favBadgeText}>{route.number}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.favName}>{route.name}</Text>
              <Text style={styles.favStatus}>Live tracking available</Text>
            </View>
            <ChevronRightIcon size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ))}
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
  profileAvatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E8F1FD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginLeft: 10,
  },
  searchSection: {
    marginBottom: 16,
  },
  highlightCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  highlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  highlightBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  highlightTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  highlightDesc: {
    fontSize: 13,
    color: '#E0F2FE',
    marginTop: 6,
    lineHeight: 18,
  },
  highlightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  highlightLink: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginHorizontal: 4,
  },
  cardIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  serviceDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 10,
  },
  favBadge: {
    backgroundColor: '#E8F1FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  favBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  favName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  favStatus: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
    marginTop: 2,
  },
});
