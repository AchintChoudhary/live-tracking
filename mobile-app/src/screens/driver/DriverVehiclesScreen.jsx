import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BusIcon, ChevronRightIcon } from '../../components/Icons';
import { CustomButton } from '../../components/CustomButton';
import { Header } from '../../components/Header';
import { vehicleApi } from '../../services/api';
import { COLORS, SHADOWS } from '../../utils/theme';

export const DriverVehiclesScreen = ({ navigation }) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadVehicles = useCallback(async () => {
    try {
      const response = await vehicleApi.getMyVehicles();
      setVehicles(response.data?.data || []);
    } catch (error) {
      console.warn('Unable to load driver buses:', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadVehicles);
    loadVehicles();
    return unsubscribe;
  }, [loadVehicles, navigation]);

  return (
    <View style={styles.container}>
      <Header title="My Buses" subtitle="Buses registered to your account" showBack onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadVehicles} />}
        >
          {vehicles.map((vehicle) => (
            <View key={vehicle._id} style={[styles.card, SHADOWS.sm]}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBox}><BusIcon size={22} color={COLORS.primary} /></View>
                <View style={styles.busText}>
                  <Text style={styles.busName}>{vehicle.vehicleName}</Text>
                  <Text style={styles.plate}>{vehicle.vehicleNumber}</Text>
                </View>
                <ChevronRightIcon size={18} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.detail}>{vehicle.vehicleType} · Capacity {vehicle.capacity}</Text>
              {vehicle.assignedRoute ? (
                <>
                  <Text style={styles.routeName}>{vehicle.assignedRoute.routeName}</Text>
                  <Text style={styles.detail}>
                    {vehicle.assignedRoute.startingPoint} → {vehicle.assignedRoute.destination}
                  </Text>
                  <Text style={styles.detail}>
                    {vehicle.assignedRoute.stops?.length || 0} ordered route stops
                  </Text>
                </>
              ) : (
                <Text style={styles.unassigned}>No route configured</Text>
              )}
            </View>
          ))}
          {!vehicles.length && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No buses registered</Text>
              <Text style={styles.emptyText}>Add a bus and select its real ordered route stops to enable trip tracking.</Text>
            </View>
          )}
          <CustomButton title="Register a Bus" onPress={() => navigation.navigate('AddBus')} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 18, paddingBottom: 36 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E8F1FD', alignItems: 'center', justifyContent: 'center' },
  busText: { flex: 1, marginLeft: 12 },
  busName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  plate: { color: COLORS.textSecondary, marginTop: 2, fontSize: 13 },
  detail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 7 },
  routeName: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 14, marginTop: 12 },
  unassigned: { color: COLORS.warning, fontSize: 12, fontWeight: '700', marginTop: 10 },
  empty: { alignItems: 'center', padding: 30, marginBottom: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: 6 },
});
