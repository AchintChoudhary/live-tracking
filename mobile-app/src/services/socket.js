import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_SERVER_URL } from '../utils/config';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentTripId = null;
    this.activeSubscriptions = new Set();
  }

  /**
   * Initializes Socket.IO connection with reconnection policies and JWT token auth
   */
  async connect() {
    if (this.socket && this.connected) {
      return this.socket;
    }

    const token = await AsyncStorage.getItem('@transit_token');

    this.socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        token: token || '',
      },
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[Socket.IO] Connected. Socket ID:', this.socket.id);

      // Re-subscribe to any active trip room upon reconnection
      if (this.currentTripId) {
        this.subscribeTrip(this.currentTripId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('[Socket.IO] Disconnected. Reason:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.log('[Socket.IO] Connection error:', err.message);
    });

    return this.socket;
  }

  // ==========================================
  // DRIVER EMITTERS
  // ==========================================

  driverJoin(driverId, callback) {
    if (this.socket) {
      this.socket.emit('driver:join', { driverId }, callback);
    }
  }

  startTrip(tripData, callback) {
    if (this.socket) {
      this.socket.emit('trip:start', tripData, callback);
    }
  }

  sendLocationUpdate(locationData, callback) {
    if (this.socket) {
      this.socket.emit('location:update', locationData, callback);
    }
  }

  sendTripStatus(statusData, callback) {
    if (this.socket) {
      this.socket.emit('trip:status', statusData, callback);
    }
  }

  sendTripEnd(tripData, callback) {
    if (this.socket) {
      this.socket.emit('trip:end', tripData, callback);
    }
  }

  // ==========================================
  // PASSENGER EMITTERS
  // ==========================================

  passengerJoin(passengerId, callback) {
    if (this.socket) {
      this.socket.emit('passenger:join', { passengerId }, callback);
    }
  }

  subscribeTrip(tripId, callback) {
    if (!tripId) return;
    this.currentTripId = tripId;
    this.activeSubscriptions.add(tripId);

    if (this.socket) {
      this.socket.emit('trip:subscribe', { tripId }, callback);
    }
  }

  unsubscribeTrip(tripId, callback) {
    if (!tripId) return;
    this.activeSubscriptions.delete(tripId);
    if (this.currentTripId === tripId) {
      this.currentTripId = null;
    }

    if (this.socket) {
      this.socket.emit('trip:unsubscribe', { tripId }, callback);
    }
  }

  // Legacy aliases
  joinTrip(tripId) {
    this.subscribeTrip(tripId);
  }

  leaveTrip(tripId) {
    this.unsubscribeTrip(tripId);
  }

  // ==========================================
  // REAL-TIME LISTENERS
  // ==========================================

  onVehicleLocation(callback) {
    if (!this.socket) this.connect();
    // Remove previous duplicate listeners before registering
    this.socket.off('vehicle:location');
    this.socket.on('vehicle:location', callback);
    return () => {
      if (this.socket) this.socket.off('vehicle:location', callback);
    };
  }

  onTripStarted(callback) {
    if (!this.socket) this.connect();
    this.socket.off('trip:started');
    this.socket.on('trip:started', callback);
    return () => {
      if (this.socket) this.socket.off('trip:started', callback);
    };
  }

  onTripStatus(callback) {
    if (!this.socket) this.connect();
    this.socket.off('trip:status');
    this.socket.on('trip:status', callback);
    return () => {
      if (this.socket) this.socket.off('trip:status', callback);
    };
  }

  onTripCompleted(callback) {
    if (!this.socket) this.connect();
    this.socket.off('trip:completed');
    this.socket.on('trip:completed', callback);
    return () => {
      if (this.socket) this.socket.off('trip:completed', callback);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentTripId = null;
      this.activeSubscriptions.clear();
    }
  }
}

export const socketService = new SocketService();
