import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { COLORS, SHADOWS } from '../../utils/theme';
import { Header } from '../../components/Header';
import { CustomInput } from '../../components/CustomInput';
import {
  SearchIcon,
  BusIcon,
  RouteIcon,
  HistoryIcon,
  ChevronRightIcon,
  RadioTowerIcon,
  UserIcon,
} from '../../components/Icons';
import { LiveBadge } from '../../components/LiveBadge';
import { useAuth } from '../../context/AuthContext';
import { passengerApi } from '../../services/api';
import { locationService } from '../../services/locationService';

export const PassengerDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeVehicles, setActiveVehicles] = useState(null);
  const [passengerLocation, setPassengerLocation] = useState(null);

  const fetchActiveVehicles = async () => {
    setLoading(true);
    try {
      const res = await passengerApi.getActiveVehicles();
      if (res.data?.data) {
        setActiveVehicles(res.data.data);
      } else {
        setActiveVehicles(null);
      }
    } catch (err) {
      setActiveVehicles(null);
      console.warn('Active trip data unavailable:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveVehicles();
    const unsubscribe = navigation.addListener('focus', fetchActiveVehicles);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    let active = true;
    const detectLocation = async () => {
      try {
        const permitted = await locationService.requestLocationPermissions();
        if (!permitted) return;
        const location = await locationService.getCurrentPosition();
        if (!active) return;
        setPassengerLocation(location);
      } catch (error) {
        console.log('Passenger location unavailable:', error.message);
      }
    };
    detectLocation();
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title={`Hello, ${user?.name?.split(' ')[0] || 'Passenger'} 👋`}
        subtitle="Where are you travelling today?"
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
            onSubmitEditing={() => {
              if (searchQuery.trim()) {
                navigation.navigate('Routes', { searchQuery: searchQuery.trim() });
              }
            }}
            returnKeyType="search"
            icon={
              <TouchableOpacity
                onPress={() => {
                  if (searchQuery.trim()) {
                    navigation.navigate('Routes', { searchQuery: searchQuery.trim() });
                  }
                }}
              >
                <SearchIcon size={20} color={COLORS.primary} />
              </TouchableOpacity>
            }
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* Live Tracking Card (Highlight) */}
        <TouchableOpacity
          style={[styles.findBusCard, SHADOWS.sm]}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('PassengerBusSearch', { passengerLocation })}
        >
          <View style={styles.findBusHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.findBusTitle}>Find Buses to Your Destination</Text>
              <Text style={styles.findBusSubtitle}>
                {passengerLocation
                  ? `Using your location · ${passengerLocation.latitude.toFixed(3)}, ${passengerLocation.longitude.toFixed(3)}`
                  : 'Detect your location or choose a starting stop'}
              </Text>
            </View>
            <ChevronRightIcon size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.findBusAction}>SEARCH ACTIVE BUSES</Text>
        </TouchableOpacity>

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
            <LiveBadge label="LIVE MAP" size="sm" />
          </View>
          <Text style={styles.highlightTitle}>Live Bus Tracking</Text>
          <Text style={styles.highlightDesc}>
          View buses with active driver GPS and their latest reported positions.
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
            <Text style={styles.serviceDesc}>
              {activeVehicles == null ? 'Active trip data unavailable' : `${activeVehicles.length} active trips`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridRow}>
          {/* Trip Updates Card */}
          <TouchableOpacity
            style={[styles.serviceCard, SHADOWS.sm]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('RouteUpdates')}
          >
            <View style={[styles.cardIconBox, { backgroundColor: '#FEF3C7' }]}>
              <HistoryIcon size={24} color={COLORS.warning} />
            </View>
            <Text style={styles.serviceTitle}>Trip Updates</Text>
            <Text style={styles.serviceDesc}>Live status and ordered route stops</Text>
          </TouchableOpacity>
        </View>
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
  findBusCard: {
    backgroundColor: '#0F4C9A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  findBusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  findBusTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  findBusSubtitle: {
    color: '#DBEAFE',
    fontSize: 12,
    marginTop: 4,
  },
  findBusAction: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 12,
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
});
