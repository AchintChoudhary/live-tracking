import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CustomButton } from '../../components/CustomButton';
import { CustomInput } from '../../components/CustomInput';
import { Header } from '../../components/Header';
import { MapContainer } from '../../components/MapContainer';
import { placeApi, routeApi, vehicleApi } from '../../services/api';
import { COLORS, SHADOWS } from '../../utils/theme';

const VEHICLE_TYPES = [
  'Standard Transit Bus',
  'Articulated Bus',
  'Electric Shuttle',
  'Double Decker Bus',
];

const PlacePicker = ({ label, value, onSelect }) => {
  const [query, setQuery] = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manualName, setManualName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const search = async () => {
    if (query.trim().length < 2) {
      Alert.alert('Enter a place', 'Type at least two characters and search explicitly.');
      return;
    }
    setSearching(true);
    try {
      const response = await placeApi.search(query.trim());
      const places = response.data?.data || [];
      setResults(places);
      if (places.length === 0) {
        Alert.alert('No places found', 'Try another search or enter coordinates from a trusted source.');
      }
    } catch (error) {
      setResults([]);
      Alert.alert(
        'Place search unavailable',
        error.response?.data?.message || 'Configure Google Places or a self-hosted geocoder, or enter known coordinates below.'
      );
    } finally {
      setSearching(false);
    }
  };

  const useManualCoordinates = () => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const name = (manualName.trim() || query.trim()).slice(0, 120);
    if (!name || !latitude.trim() || !longitude.trim() ||
      !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lng) || lng < -180 || lng > 180) {
      Alert.alert('Invalid stop', 'Provide a stop name and valid latitude/longitude from a trusted source.');
      return;
    }
    onSelect({ name, latitude: lat, longitude: lng, placeId: null });
    setResults([]);
  };

  return (
    <View style={styles.placeBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <CustomInput
        placeholder="Search for a real place"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setResults([]);
          if (value) onSelect(null);
        }}
        autoCapitalize="words"
        containerStyle={styles.inputContainer}
      />
      <CustomButton title="Search Places" variant="outline" loading={searching} onPress={search} />
      {results.map((place) => (
        <TouchableOpacity
          key={place.placeId || `${place.latitude}-${place.longitude}`}
          style={[styles.placeResult, value?.placeId === place.placeId && styles.placeResultSelected]}
          onPress={() => {
            onSelect(place);
            setQuery(place.name);
            setResults([]);
          }}
        >
          <Text style={styles.placeName}>{place.name}</Text>
          {!!place.address && <Text style={styles.placeAddress}>{place.address}</Text>}
        </TouchableOpacity>
      ))}
      {!!value && (
        <Text style={styles.selectedPlace}>
          Selected: {value.name} ({value.latitude.toFixed(5)}, {value.longitude.toFixed(5)})
        </Text>
      )}
      <Text style={styles.manualHeading}>Or enter known coordinates</Text>
      <CustomInput
        placeholder="Stop name"
        value={manualName}
        onChangeText={setManualName}
        autoCapitalize="words"
        containerStyle={styles.compactInput}
      />
      <View style={styles.coordinateRow}>
        <CustomInput
          placeholder="Latitude"
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="numeric"
          containerStyle={styles.coordinateInput}
        />
        <CustomInput
          placeholder="Longitude"
          value={longitude}
          onChangeText={setLongitude}
          keyboardType="numeric"
          containerStyle={styles.coordinateInput}
        />
      </View>
      <TouchableOpacity style={styles.manualButton} onPress={useManualCoordinates}>
        <Text style={styles.manualButtonText}>Use entered coordinates</Text>
      </TouchableOpacity>
    </View>
  );
};

export const AddBusScreen = ({ navigation }) => {
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [vehicleType, setVehicleType] = useState(null);
  const [routeName, setRouteName] = useState('');
  const [startingPoint, setStartingPoint] = useState(null);
  const [destination, setDestination] = useState(null);
  const [intermediateStops, setIntermediateStops] = useState([]);
  const [routePreview, setRoutePreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const getSelectedStops = () =>
    [startingPoint, ...intermediateStops.map((stop) => stop.place), destination]
      .filter(Boolean)
      .map(({ name, placeId, latitude, longitude }) => ({ name, placeId, latitude, longitude }));

  const previewRoadRoute = async () => {
    if (!startingPoint || !destination || intermediateStops.some((stop) => !stop.place)) {
      Alert.alert('Route stops required', 'Select or enter real coordinates for every ordered route stop first.');
      return;
    }
    setPreviewing(true);
    try {
      const response = await routeApi.previewRoute({ stops: getSelectedStops() });
      setRoutePreview(response.data?.data || null);
      if (!response.data?.data) {
        Alert.alert('Preview unavailable', 'The routing provider did not return a road route.');
      }
    } catch (error) {
      setRoutePreview(null);
      Alert.alert(
        'Road preview unavailable',
        error.response?.data?.message || 'Configure Google Routes or self-hosted OSRM to preview a road route.'
      );
    } finally {
      setPreviewing(false);
    }
  };

  const updateIntermediateStop = (id, place) => {
    setRoutePreview(null);
    setIntermediateStops((current) =>
      current.map((stop) => (stop.id === id ? { ...stop, place } : stop))
    );
  };

  const saveBus = async () => {
    if (
      vehicleName.trim().length < 2 ||
      !vehicleNumber.trim() ||
      !vehicleType ||
      !Number.isInteger(Number(capacity)) ||
      Number(capacity) < 1 ||
      Number(capacity) > 100
    ) {
      Alert.alert('Bus details required', 'Enter the bus name, registration number, bus type, and passenger capacity (1–100).');
      return;
    }
    if (!startingPoint || !destination || intermediateStops.some((stop) => !stop.place)) {
      Alert.alert('Route stops required', 'Select or enter real coordinates for the start, every intermediate stop, and destination.');
      return;
    }

    setSaving(true);
    try {
      const stops = getSelectedStops();
      const response = await vehicleApi.createVehicle({
        vehicleName: vehicleName.trim(),
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        vehicleType,
        capacity: Number(capacity),
        routeName: routeName.trim(),
        stops,
      });
      const bus = response.data?.data;
      const geometryMessage = response.data?.route?.coordinatesVerified
        ? 'Road geometry was saved.'
        : 'Stops were saved; road geometry is not verified.';
      Alert.alert(
        'Bus registered',
        `${bus?.vehicleName || vehicleName} and its ordered route stops were saved. ${geometryMessage}`,
        [{ text: 'Continue', onPress: () => navigation.replace('DriverVehicles') }]
      );
    } catch (error) {
      Alert.alert(
        'Could not register bus',
        error.response?.data?.message || 'Check the connection and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Register a Bus" subtitle="Bus details and ordered stops" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, SHADOWS.sm]}>
          <CustomInput label="Bus Name" placeholder="Name shown to passengers" value={vehicleName} onChangeText={setVehicleName} autoCapitalize="words" />
          <CustomInput label="Registration Number" placeholder="Official plate number" value={vehicleNumber} onChangeText={setVehicleNumber} autoCapitalize="characters" />
          <CustomInput label="Passenger Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
          <Text style={styles.fieldLabel}>Bus Type — select the registered vehicle type</Text>
          <View style={styles.typeList}>
            {VEHICLE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeOption, vehicleType === type && styles.typeOptionSelected]}
                onPress={() => setVehicleType(type)}
              >
                <Text style={[styles.typeText, vehicleType === type && styles.typeTextSelected]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <CustomInput label="Route Name (Optional)" placeholder="Leave blank to use start and destination" value={routeName} onChangeText={setRouteName} autoCapitalize="words" />
        </View>

        <View style={[styles.card, SHADOWS.sm]}>
          <Text style={styles.sectionTitle}>Ordered Route Stops</Text>
          <Text style={styles.note}>
            Select actual places or enter coordinates from a trusted source. Stops are not inferred from a road route.
          </Text>
          <PlacePicker
            label="1. Starting Stop"
            value={startingPoint}
            onSelect={(place) => {
              setStartingPoint(place);
              setRoutePreview(null);
            }}
          />
          {intermediateStops.map((stop, index) => (
            <View key={stop.id} style={styles.intermediateBlock}>
              <View style={styles.stopHeader}>
                <Text style={styles.fieldLabel}>{index + 2}. Intermediate Stop</Text>
                <TouchableOpacity onPress={() => setIntermediateStops((current) => current.filter((entry) => entry.id !== stop.id))}>
                  <Text style={styles.removeStop}>Remove</Text>
                </TouchableOpacity>
              </View>
              <PlacePicker
                value={stop.place}
                onSelect={(place) => updateIntermediateStop(stop.id, place)}
                label={`Stop ${index + 2}`}
              />
            </View>
          ))}
          {intermediateStops.length < 18 && (
            <TouchableOpacity
              style={styles.addStop}
              onPress={() => {
                setRoutePreview(null);
                setIntermediateStops((current) => [...current, { id: `${Date.now()}-${current.length}`, place: null }]);
              }}
            >
              <Text style={styles.addStopText}>+ Add Intermediate Stop</Text>
            </TouchableOpacity>
          )}
          <PlacePicker
            label={`${intermediateStops.length + 2}. Final Destination`}
            value={destination}
            onSelect={(place) => {
              setDestination(place);
              setRoutePreview(null);
            }}
          />
          <CustomButton
            title="Preview Road Route"
            variant="outline"
            loading={previewing}
            onPress={previewRoadRoute}
            style={styles.previewButton}
          />
          {routePreview && (
            <View style={styles.previewCard}>
              <Text style={styles.previewSummary}>
                Road route · {(routePreview.distanceMeters / 1000).toFixed(1)} km · {Math.ceil(routePreview.durationSeconds / 60)} min
              </Text>
              <MapContainer
                routeCoordinates={routePreview.coordinates}
                routeCoordinatesVerified
                stops={getSelectedStops()}
                startingPoint={startingPoint?.name}
                destination={destination?.name}
                showCenterButton
                style={styles.previewMap}
              />
            </View>
          )}
        </View>

        <CustomButton title="Save Bus and Route" loading={saving} onPress={saveBus} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  note: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  fieldLabel: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13, marginBottom: 7 },
  placeBlock: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 14, marginTop: 8 },
  inputContainer: { marginBottom: 8 },
  placeResult: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: '#FFFFFF' },
  placeResultSelected: { borderColor: COLORS.primary, backgroundColor: '#F8FAFF' },
  placeName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  placeAddress: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  selectedPlace: { color: COLORS.success, fontSize: 12, marginTop: 8, fontWeight: '700' },
  manualHeading: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  compactInput: { marginBottom: 8 },
  coordinateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  coordinateInput: { width: '48%', marginBottom: 6 },
  manualButton: { paddingVertical: 9, alignItems: 'center', borderRadius: 8, backgroundColor: '#F1F5F9' },
  manualButtonText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  typeList: { marginBottom: 16 },
  typeOption: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, padding: 10, marginBottom: 7 },
  typeOptionSelected: { borderColor: COLORS.primary, backgroundColor: '#F1F7FF' },
  typeText: { color: COLORS.textSecondary, fontSize: 13 },
  typeTextSelected: { color: COLORS.primary, fontWeight: '700' },
  intermediateBlock: { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 8 },
  stopHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12 },
  removeStop: { color: COLORS.danger, fontSize: 12, fontWeight: '700' },
  addStop: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, padding: 12, marginVertical: 12, alignItems: 'center' },
  addStopText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  previewButton: { marginTop: 16 },
  previewCard: { marginTop: 12, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 12, overflow: 'hidden' },
  previewSummary: { padding: 11, color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  previewMap: { height: 240 },
});
