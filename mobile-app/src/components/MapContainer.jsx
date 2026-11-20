import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS } from '../utils/theme';
import { BusIcon, PinIcon, NavigationIcon } from './Icons';

/**
 * Enhanced Universal Map Component for Android
 * Embeds react-native-maps with Google Maps SDK support.
 * Displays route polylines, origin/destination pins, designated stops,
 * multi-vehicle markers with registration badges, and one-tap re-centering.
 */
export const MapContainer = ({
  initialRegion,
  busLocation,
  userLocation,
  vehicles = [],
  routeCoordinates = [],
  routeCoordinatesVerified = false,
  stops = [],
  startingPoint,
  destination,
  selectedStop,
  destinationStop,
  onStopSelect,
  selectedVehicleId,
  onVehicleSelect,
  showCenterButton = true,
  showCoordinates = false,
  style,
  zoomEnabled = true,
  rotateEnabled = false,
}) => {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Derive target vehicle coordinate for centering
  const activeTargetLoc =
    busLocation ||
    vehicles.find((v) => v.vehicleId === selectedVehicleId || v.tripId === selectedVehicleId) ||
    vehicles[0] ||
    userLocation ||
    (routeCoordinates[0] ? { latitude: routeCoordinates[0].latitude, longitude: routeCoordinates[0].longitude } : null);

  const defaultRegion = activeTargetLoc
    ? {
        latitude: activeTargetLoc.latitude,
        longitude: activeTargetLoc.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }
    : undefined;

  const hasInitiallyCentered = useRef(false);

  // Center map on active target
  const handleCenterOnLocation = () => {
    if (mapRef.current && activeTargetLoc) {
      mapRef.current.animateToRegion(
        {
          latitude: activeTargetLoc.latitude,
          longitude: activeTargetLoc.longitude,
          latitudeDelta: 0.018,
          longitudeDelta: 0.018,
        },
        500
      );
    }
  };

  // Center map once upon initial target ready to avoid camera hijacking on every GPS tick
  useEffect(() => {
    if (mapReady && mapRef.current && activeTargetLoc && !hasInitiallyCentered.current) {
      hasInitiallyCentered.current = true;
      mapRef.current.animateToRegion(
        {
          latitude: activeTargetLoc.latitude,
          longitude: activeTargetLoc.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        },
        600
      );
    }
  }, [activeTargetLoc?.latitude, activeTargetLoc?.longitude, mapReady]);

  // Combine single busLocation with vehicles array
  const allVehicles = [...vehicles];
  if (busLocation && !allVehicles.some((v) => v.vehicleId === busLocation.vehicleId || v.tripId === busLocation.tripId)) {
    allVehicles.push(busLocation);
  }

  const originCoord = routeCoordinates[0] || (stops[0] ? { latitude: stops[0].latitude, longitude: stops[0].longitude } : null);
  const destCoord = destinationStop
    ? { latitude: destinationStop.latitude, longitude: destinationStop.longitude }
    :
    routeCoordinates[routeCoordinates.length - 1] ||
    (stops.length > 1 ? { latitude: stops[stops.length - 1].latitude, longitude: stops[stops.length - 1].longitude } : null);

  return (
    <View style={[styles.container, style]}>
      {(initialRegion || defaultRegion) ? <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion || defaultRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        zoomEnabled={zoomEnabled}
        rotateEnabled={rotateEnabled}
        onMapReady={() => setMapReady(true)}
      >
        {/* Route Polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={COLORS.primary}
            strokeWidth={4.5}
            lineDashPattern={[0]}
          />
        )}

        {/* Origin / Starting Point Marker */}
        {originCoord && (
          <Marker
            coordinate={{ latitude: originCoord.latitude, longitude: originCoord.longitude }}
            title={`Origin: ${startingPoint || 'Start stop'}`}
            description="Route departure station"
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.originMarker}>
              <View style={styles.originMarkerInner} />
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {destCoord && (
          <Marker
            coordinate={{ latitude: destCoord.latitude, longitude: destCoord.longitude }}
            title={`Destination: ${destinationStop?.name || destination || 'Route destination'}`}
            description={destinationStop ? 'Selected passenger destination stop' : 'Route terminal arrival'}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.destMarker}>
              <View style={styles.destMarkerInner} />
            </View>
          </Marker>
        )}

        {userLocation && (
          <Marker
            coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
            title="Passenger location"
            description="Your current or selected starting point"
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
            </View>
          </Marker>
        )}

        {/* Bus Stops Markers */}
        {stops.map((stop, index) => {
          const isSelected = selectedStop && String(selectedStop._id) === String(stop._id);
          return (
            <Marker
              key={`stop-${stop.name}-${index}`}
              coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
              title={stop.name}
              description={`Designated Stop #${index + 1}`}
              onPress={() => onStopSelect && onStopSelect(stop)}
            >
              <View style={[styles.stopMarker, isSelected && styles.stopMarkerSelected]}>
                <Text style={[styles.stopMarkerText, isSelected && styles.stopMarkerTextSelected]}>
                  {index + 1}
                </Text>
              </View>
            </Marker>
          );
        })}

        {/* Moving Bus Markers (Multi-Vehicle Support) */}
        {allVehicles.map((veh, index) => {
          const isSelected =
            (selectedVehicleId && (veh.vehicleId === selectedVehicleId || veh.tripId === selectedVehicleId)) ||
            allVehicles.length === 1;

          return (
            <Marker
              key={`bus-${veh.vehicleId || veh.tripId || index}`}
              coordinate={{
                latitude: veh.latitude,
                longitude: veh.longitude,
              }}
              title={veh.busName || veh.vehicleNumber || 'Bus'}
              description={`${veh.vehicleNumber || 'Registration unavailable'}${Number.isFinite(veh.etaMinutes) ? ` • ETA ${veh.etaMinutes} min` : ''} • Speed: ${Number.isFinite(veh.speed) ? `${Math.round(veh.speed)} km/h` : 'Unavailable'} • Heading: ${Number.isFinite(veh.heading) ? `${Math.round(veh.heading)}°` : 'Unavailable'}`}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onVehicleSelect && onVehicleSelect(veh)}
            >
              <View style={styles.busMarkerOuter}>
                <View style={[styles.busMarkerWave, isSelected && styles.busMarkerWaveSelected]} />
                <View style={[styles.busMarkerBadge, isSelected && styles.busMarkerBadgeSelected]}>
                  <BusIcon size={18} color="#FFFFFF" />
                </View>
                <View style={styles.busNumberTag}>
                  <Text style={styles.busNumberTagText} numberOfLines={1}>
                    {veh.vehicleNumber || 'Bus'}
                  </Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView> : (
        <View style={styles.mapUnavailable}>
          <Text style={styles.mapUnavailableText}>Location unavailable. Enable GPS or select a route stop.</Text>
        </View>
      )}

      {routeCoordinates.length > 1 && !routeCoordinatesVerified && (
        <View style={styles.geometryNotice}>
          <Text style={styles.geometryNoticeText}>UNVERIFIED STOP CONNECTOR · NOT A ROAD ROUTE</Text>
        </View>
      )}

      {/* Re-Center on Active Vehicle FAB */}
      {showCenterButton && (
        <TouchableOpacity
          style={styles.recenterFab}
          activeOpacity={0.85}
          onPress={handleCenterOnLocation}
        >
          <NavigationIcon size={20} color={COLORS.primary} />
        </TouchableOpacity>
      )}

      {/* Coordinate Telemetry Badge for Drivers */}
      {showCoordinates && activeTargetLoc && (
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>
            Lat: {activeTargetLoc.latitude.toFixed(5)} • Lon: {activeTargetLoc.longitude.toFixed(5)}
            {activeTargetLoc.accuracy ? ` (±${Math.round(activeTargetLoc.accuracy)}m)` : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  mapUnavailable: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mapUnavailableText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  originMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.success,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  originMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  destMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.danger,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  destMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  userMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  stopMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  stopMarkerSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F1FD',
    transform: [{ scale: 1.25 }],
  },
  stopMarkerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  stopMarkerTextSelected: {
    color: COLORS.primary,
  },
  busMarkerOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 65,
    height: 70,
  },
  busMarkerWave: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(8, 102, 232, 0.25)',
  },
  busMarkerWaveSelected: {
    backgroundColor: 'rgba(22, 163, 74, 0.3)',
  },
  busMarkerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0866E8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  busMarkerBadgeSelected: {
    backgroundColor: COLORS.success,
  },
  busNumberTag: {
    marginTop: 3,
    backgroundColor: 'rgba(23, 32, 51, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#FFFFFF',
  },
  busNumberTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  recenterFab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  coordsBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(23, 32, 51, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  coordsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  geometryNotice: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  geometryNoticeText: {
    color: '#92400E',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
