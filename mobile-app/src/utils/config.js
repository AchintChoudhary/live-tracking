import { Platform } from 'react-native';

/**
 * Centralized Network Configuration for TransitTrack Live
 * Android Emulator connects to host machine backend via 10.0.2.2
 */
export const BACKEND_PORT = 5000;

export const SERVER_HOST = Platform.select({
  android: `http://10.0.2.2:${BACKEND_PORT}`,
  default: `http://localhost:${BACKEND_PORT}`,
});

export const API_BASE_URL = `${SERVER_HOST}/api`;
export const SOCKET_SERVER_URL = SERVER_HOST;
export const REQUEST_TIMEOUT = 12000;
