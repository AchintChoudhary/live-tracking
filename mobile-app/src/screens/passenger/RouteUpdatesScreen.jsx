import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Header } from '../../components/Header';
import { LiveBadge } from '../../components/LiveBadge';
import { socketService } from '../../services/socket';
import { COLORS, SHADOWS } from '../../utils/theme';

export const RouteUpdatesScreen = ({ route: navRoute, navigation }) => {
  const {
    tripId,
    tripData,
    route: activeRoute,
    selectedStop,
    destinationStop,
    liveLocation: initialLocation,
  } = navRoute.params || {};
  const [liveLocation, setLiveLocation] = useState(initialLocation || null);
  const [status, setStatus] = useState(tripData?.liveStatus || tripData?.status || 'Status unavailable');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!tripId) return undefined;
    let active = true;
    const unsubscribeLocation = socketService.onVehicleLocation((event) => {
      if (active && String(event?.tripId) === String(tripId)) setLiveLocation(event);
    });
    const unsubscribeStatus = socketService.onTripStatus((event) => {
      if (active && String(event?.tripId) === String(tripId)) {
        setStatus(event.liveStatus || event.status || 'Status unavailable');
      }
    });
    const unsubscribeCompleted = socketService.onTripCompleted((event) => {
      if (active && String(event?.tripId) === String(tripId)) {
        setCompleted(true);
        setStatus('Trip completed');
      }
    });

    socketService.connect()
      .then(() => {
        if (active) {
          socketService.subscribeTrip(tripId, (response) => {
            if (active && response?.hasCachedLocation && response.lastLocation) {
              setLiveLocation(response.lastLocation);
            }
          });
        }
      })
      .catch((error) => console.warn('Trip updates connection failed:', error.message));

    return () => {
      active = false;
      unsubscribeLocation();
      unsubscribeStatus();
      unsubscribeCompleted();
      socketService.unsubscribeTrip(tripId);
    };
  }, [tripId]);

  const stops = [...(activeRoute?.stops || [])].sort((a, b) => a.order - b.order);
  const currentLocationTime = liveLocation?.timestamp
    ? new Date(liveLocation.timestamp).toLocaleString()
    : 'No GPS update received';

  return (
    <View style={styles.container}>
      <Header
        title="Trip Updates"
        subtitle={activeRoute?.routeName || 'Select a live bus to view trip details'}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={tripId ? <LiveBadge label={completed ? 'COMPLETED' : 'TRIP'} size="sm" /> : null}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {!tripId ? (
          <View style={[styles.card, SHADOWS.sm]}>
            <Text style={styles.title}>No trip selected</Text>
            <Text style={styles.copy}>
              Select an active bus to view its reported status and ordered route stops. Arrival estimates are shown only when driving-route data is available.
            </Text>
            <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('PassengerBusSearch')}>
              <Text style={styles.searchButtonText}>Find active buses</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[styles.card, SHADOWS.sm]}>
              <Text style={styles.label}>Bus status</Text>
              <Text style={styles.value}>{status}</Text>
              <Text style={styles.label}>Last driver GPS update</Text>
              <Text style={styles.value}>{currentLocationTime}</Text>
              {liveLocation?.latitude != null && liveLocation?.longitude != null && (
                <Text style={styles.coordinates}>
                  {Number(liveLocation.latitude).toFixed(5)}, {Number(liveLocation.longitude).toFixed(5)}
                </Text>
              )}
            </View>

            <View style={[styles.card, SHADOWS.sm]}>
              <Text style={styles.title}>Ordered route stops</Text>
              {stops.map((stop, index) => (
                <View key={String(stop._id || `${stop.order}-${stop.name}`)} style={styles.stopRow}>
                  <Text style={styles.stopNumber}>{index + 1}</Text>
                  <View style={styles.stopText}>
                    <Text style={styles.stopName}>{stop.name}</Text>
                    {String(stop._id) === String(selectedStop?._id) && (
                      <Text style={styles.stopTag}>Selected boarding stop</Text>
                    )}
                    {String(stop._id) === String(destinationStop?._id) && (
                      <Text style={styles.stopTag}>Selected destination</Text>
                    )}
                  </View>
                </View>
              ))}
              {!stops.length && <Text style={styles.copy}>No ordered stops are configured for this route.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 16, padding: 16, marginBottom: 14 },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  copy: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  searchButton: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  searchButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 6 },
  value: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 3, marginBottom: 8 },
  coordinates: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  stopRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  stopNumber: { color: COLORS.primary, backgroundColor: '#E8F1FD', borderRadius: 14, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', width: 28, height: 28, fontSize: 12, fontWeight: '800' },
  stopText: { marginLeft: 10, flex: 1 },
  stopName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  stopTag: { color: COLORS.primary, fontSize: 11, marginTop: 2 },
});
