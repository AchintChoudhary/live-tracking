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
import { CustomInput } from '../../components/CustomInput';
import {
  SearchIcon,
  RouteIcon,
  PinIcon,
  ChevronRightIcon,
  HeartIcon,
} from '../../components/Icons';
import { routeApi } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const RoutesScreen = ({ navigation, route: navRoute }) => {
  const initialFilter = navRoute?.params?.filter || 'all';
  const initialSearch = navRoute?.params?.searchQuery || '';
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [routes, setRoutes] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (navRoute?.params?.searchQuery != null) {
      setSearchQuery(navRoute.params.searchQuery);
    }
  }, [navRoute?.params?.searchQuery]);

  useEffect(() => {
    AsyncStorage.getItem('@favorite_routes')
      .then((favs) => {
        if (favs) setFavorites(JSON.parse(favs));
      })
      .catch(() => {});
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await routeApi.getAllRoutes();
      if (res.data?.data) {
        setRoutes(res.data.data);
      }
    } catch (err) {
      console.log('Error fetching transit routes:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const updated = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      AsyncStorage.setItem('@favorite_routes', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  const filteredRoutes = routes.filter((item) => {
    const matchesSearch =
      item.routeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.routeNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.startingPoint?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.destination?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeFilter === 'favorites') return favorites.includes(item._id);
    if (activeFilter === 'nearby') return true; // nearby priority
    return true;
  });

  const renderRouteCard = ({ item }) => {
    const isFav = favorites.includes(item._id);
    return (
      <View style={[styles.routeCard, SHADOWS.sm]}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeContainer}>
            <View style={styles.routeBadge}>
              <Text style={styles.routeBadgeText}>{item.routeNumber}</Text>
            </View>
            <View style={styles.titleWrapper}>
              <Text style={styles.routeName} numberOfLines={1}>
                {item.routeName}
              </Text>
              <Text style={styles.stopsCount}>
                {item.stops?.length || 0} designated bus stops
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => toggleFavorite(item._id)}
            style={styles.favBtn}
            activeOpacity={0.7}
          >
            <HeartIcon size={22} color={isFav ? COLORS.danger : COLORS.textMuted} filled={isFav} />
          </TouchableOpacity>
        </View>

        {/* Origin & Destination */}
        <View style={styles.pointsContainer}>
          <View style={styles.pointRow}>
            <View style={[styles.pointDot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.pointLabel}>Origin:</Text>
            <Text style={styles.pointText}>{item.startingPoint}</Text>
          </View>
          <View style={styles.pointConnector} />
          <View style={styles.pointRow}>
            <View style={[styles.pointDot, { backgroundColor: COLORS.danger }]} />
            <Text style={styles.pointLabel}>Dest:</Text>
            <Text style={styles.pointText}>{item.destination}</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.viewRouteBtn}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('LiveTracking', {
              selectedRoute: item,
              routeNumber: item.routeNumber,
            })
          }
        >
          <Text style={styles.viewRouteBtnText}>View Route & Live Buses</Text>
          <ChevronRightIcon size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Available Routes"
        subtitle="Public Transit Corridors"
        showBack
        onBack={() => navigation.goBack()}
      />

      <View style={styles.filterSection}>
        {/* Search Bar */}
        <CustomInput
          placeholder="Filter by route name, terminal, or number..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<SearchIcon size={18} color={COLORS.textSecondary} />}
          containerStyle={{ marginBottom: 12 }}
        />

        {/* Filter Pills */}
        <View style={styles.pillRow}>
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'all' && styles.filterPillTextActive,
              ]}
            >
              All Routes ({routes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'nearby' && styles.filterPillActive]}
            onPress={() => setActiveFilter('nearby')}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'nearby' && styles.filterPillTextActive,
              ]}
            >
              Nearby Corridors
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'favorites' && styles.filterPillActive]}
            onPress={() => setActiveFilter('favorites')}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'favorites' && styles.filterPillTextActive,
              ]}
            >
              Favorites
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading transport corridors...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRoutes}
          keyExtractor={(item) => item._id || Math.random().toString()}
          renderItem={renderRouteCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchRoutes();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No matching routes found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search criteria or switch filter tabs above.
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
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
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
  routeCard: {
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
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  routeBadge: {
    backgroundColor: '#E8F1FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  routeBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  titleWrapper: {
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  stopsCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  favBtn: {
    padding: 4,
  },
  pointsContainer: {
    marginVertical: 14,
    paddingLeft: 4,
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
  pointConnector: {
    width: 2,
    height: 14,
    backgroundColor: '#E2E8F0',
    marginLeft: 3,
    marginVertical: 2,
  },
  pointLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 44,
  },
  pointText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  viewRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewRouteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 4,
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
  },
});
