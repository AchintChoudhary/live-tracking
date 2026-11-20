import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT } from '../utils/config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject stored JWT token to outgoing requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('@transit_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.log('Error retrieving auth token for request:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Centralized response error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('Session expired or unauthorized request.');
    }
    return Promise.reject(error);
  }
);

// 1. Authentication Endpoints
export const authApi = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  getProfile: () => apiClient.get('/auth/profile'),
};

// 2. Driver Endpoints
export const driverApi = {
  getDashboard: () => apiClient.get('/driver/dashboard'),
  getTrips: () => apiClient.get('/driver/trips'),
  startTrip: (tripData) => apiClient.post('/driver/start-trip', tripData),
  endTrip: (tripData) => apiClient.put('/driver/end-trip', tripData),
  updateTripStatus: (statusData) => apiClient.put('/driver/trip-status', statusData),
};

// 3. Passenger Endpoints
export const passengerApi = {
  getDashboard: () => apiClient.get('/passenger/dashboard'),
  getRoutes: () => apiClient.get('/passenger/routes'),
  getActiveVehicles: () => apiClient.get('/passenger/active-vehicles'),
  getVehicleLocation: (vehicleId) => apiClient.get(`/passenger/vehicle/${vehicleId}/location`),
};

// 4. Routes Endpoints
export const routeApi = {
  getAllRoutes: () => apiClient.get('/routes'),
  getRouteById: (id) => apiClient.get(`/routes/${id}`),
  createRoute: (routeData) => apiClient.post('/routes', routeData),
};

// 5. Vehicles Endpoints
export const vehicleApi = {
  getAllVehicles: () => apiClient.get('/vehicles'),
  getVehicleById: (id) => apiClient.get(`/vehicles/${id}`),
};

// 6. Location Telemetry Endpoints
export const locationApi = {
  updateLocation: (locData) => apiClient.post('/location/update', locData),
  getVehicleLocation: (vehicleId) => apiClient.get(`/location/${vehicleId}`),
};

export default apiClient;
