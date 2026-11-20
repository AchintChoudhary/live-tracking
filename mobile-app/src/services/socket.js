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
    if (this.socket && this.connected) {
      this.socket.emit('driver:join', { driverId }, callback);
    } else {
      this.connect().then(() => {
        if (this.socket) this.socket.emit('driver:join', { driverId }, callback);
      });
    }
  }

  startTrip(tripData, callback) {
    if (this.socket && this.connected) {
      this.socket.emit('trip:start', tripData, callback);
    } else {
      this.connect().then(() => {
        if (this.socket) this.socket.emit('trip:start', tripData, callback);
      });
    }
  }

  sendLocationUpdate(locationData, callback) {
    if (this.socket && this.connected) {
      this.socket.emit('location:update', locationData, callback);
    } else {
      this.connect().then(() => {
        if (this.socket) this.socket.emit('location:update', locationData, callback);
      });
    }
  }

  sendTripStatus(statusData, callback) {
    if (this.socket && this.connected) {
      this.socket.emit('trip:status', statusData, callback);
    } else {
      this.connect().then(() => {
        if (this.socket) this.socket.emit('trip:status', statusData, callback);
      });
    }
  }

  sendTripEnd(tripData, callback) {
    if (this.socket && this.connected) {
      this.socket.emit('trip:end', tripData, callback);
    } else {
      this.connect().then(() => {
        if (this.socket) this.socket.emit('trip:end', tripData, callback);
      });
    }
  }

  // ==========================================
  // PASSENGER EMITTERS
  // ==========================================

  passengerJoin(passengerId, callback) {
    if (this.socket && this.connected) {
      this.socket.emit('passenger:join', { passengerId }, callback);
    } else {
      this.connect().then(() => {
        if (this.socket) this.socket.emit('passenger:join', { passengerId }, callback);
      });
    }
  }

  subscribeTrip(tripId, callback) {
    if (!tripId) return;
    this.currentTripId = tripId;
    this.activeSubscriptions.add(tripId);

    if (this.socket && this.connected) {
      this.socket.emit('trip:subscribe', { tripId }, callback);
    } else {
      this.connect().then(() => {
        if (this.socket) this.socket.emit('trip:subscribe', { tripId }, callback);
      });
    }
  }

  unsubscribeTrip(tripId, callback) {
    if (!tripId) return;
    this.activeSubscriptions.delete(tripId);
    if (this.currentTripId === tripId) {
      this.currentTripId = null;
    }

    if (this.socket && this.connected) {
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
  // REAL-TIME LISTENERS (GUARANTEED NULL-SAFE)
  // ==========================================

  on(event, callback) {
    let isSubscribed = true;
    const attach = () => {
      if (this.socket && isSubscribed) {
        this.socket.off(event, callback);
        this.socket.on(event, callback);
      }
    };

    if (this.socket) {
      attach();
    } else {
      this.connect().then(() => attach());
    }

    return () => {
      isSubscribed = false;
      if (this.socket) {
        this.socket.off(event, callback);
      }
    };
  }

  onVehicleLocation(callback) {
    return this.on('vehicle:location', callback);
  }

  onTripStarted(callback) {
    return this.on('trip:started', callback);
  }

  onTripStatus(callback) {
    return this.on('trip:status', callback);
  }

  onTripCompleted(callback) {
    return this.on('trip:completed', callback);
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
