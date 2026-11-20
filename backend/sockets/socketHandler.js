const jwt = require('jsonwebtoken');
const VehicleLocation = require('../models/VehicleLocation');
const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const { isValidCoordinates } = require('../utils/distanceCalculator');

/**
 * In-memory location cache for low-latency live broadcasting and instant passenger sync
 */
const activeTripLocations = new Map();

/**
 * Socket.IO Real-Time Tracking Engine
 * Manages Driver & Passenger rooms, authentication, coordinate validation,
 * database persistence, acknowledgements, and broadcast dispatches.
 */
const initSocketHandler = (io) => {
  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'transit_live_jwt_super_secret_key_2026_production'
        );
        socket.user = decoded;
      } catch (err) {
        console.log('[Socket Auth Warning]: Token verification notice:', err.message);
      }
    }
    // Allow connection (passengers can also inspect public transit map without login)
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Connected: ${socket.id} | User: ${socket.user?.id || 'Public Passenger'}`);

    // ==========================================
    // 1. DRIVER EVENTS
    // ==========================================

    // driver:join
    socket.on('driver:join', (data, callback) => {
      const driverId = data?.driverId || socket.user?.id;
      if (driverId) {
        socket.join(`driver:${driverId}`);
        console.log(`[Socket.IO] Driver registered: ${driverId} in room driver:${driverId}`);
        if (typeof callback === 'function') {
          callback({ success: true, driverId, message: 'Joined driver channel' });
        }
      } else if (typeof callback === 'function') {
        callback({ success: false, error: 'driverId required' });
      }
    });

    // trip:start
    socket.on('trip:start', async (data, callback) => {
      try {
        const { tripId, vehicleId, routeId } = data || {};
        if (!tripId) {
          if (typeof callback === 'function') callback({ success: false, error: 'tripId is required' });
          return;
        }

        console.log(`[Socket.IO trip:start] Trip #${tripId} initiated by socket ${socket.id}`);

        socket.join(`trip:${tripId}`);

        const payload = {
          tripId,
          vehicleId,
          routeId,
          timestamp: new Date().toISOString(),
        };

        // Broadcast to passengers on this route
        io.emit('trip:started', payload);

        if (typeof callback === 'function') {
          callback({ success: true, data: payload });
        }
      } catch (err) {
        console.error('[Socket trip:start error]:', err.message);
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // location:update
    socket.on('location:update', async (data, callback) => {
      try {
        const {
          tripId,
          vehicleId,
          driverId,
          latitude,
          longitude,
          accuracy = 0,
          speed = 0,
          heading = 0,
          timestamp,
        } = data || {};

        // 1. Coordinate Validation
        if (!isValidCoordinates(latitude, longitude)) {
          console.warn('[Socket.IO Location] Discarded invalid coordinates:', latitude, longitude);
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Invalid latitude or longitude bounds' });
          }
          return;
        }

        if (!tripId || !vehicleId) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'tripId and vehicleId are required' });
          }
          return;
        }

        // 2. Reject location updates if trip has ended
        let tripRecord = null;
        try {
          tripRecord = await Trip.findById(tripId).select('status driverId');
          if (tripRecord && tripRecord.status === 'completed') {
            console.warn(`[Socket.IO Location] Rejected: Trip ${tripId} is already completed.`);
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Trip is completed. Location updates are rejected.' });
            }
            return;
          }
        } catch (e) {
          // If mongo temporary timeout, proceed with broadcast to avoid blocking live stream
        }

        const effectiveDriverId = driverId || socket.user?.id || tripRecord?.driverId;

        const locationPayload = {
          tripId,
          vehicleId,
          driverId: effectiveDriverId,
          latitude,
          longitude,
          accuracy: Math.round(accuracy || 0),
          speed: Math.round(speed || 0),
          heading: Math.round(heading || 0),
          timestamp: timestamp || new Date().toISOString(),
        };

        // 3. Cache latest location in memory for instant retrieval
        activeTripLocations.set(tripId.toString(), locationPayload);

        // 4. Broadcast live vehicle location to trip room and globally
        io.to(`trip:${tripId}`).emit('vehicle:location', locationPayload);
        io.emit('vehicle:location', locationPayload);

        // 5. Asynchronously persist to MongoDB
        try {
          VehicleLocation.create({
            vehicleId,
            driverId: effectiveDriverId,
            tripId,
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            timestamp: new Date(timestamp || Date.now()),
          }).catch(() => {});
        } catch (dbErr) {
          // Non-blocking
        }

        // 6. Acknowledge receipt to driver client
        if (typeof callback === 'function') {
          callback({
            success: true,
            tripId,
            timestamp: locationPayload.timestamp,
          });
        }
      } catch (err) {
        console.error('[Socket.IO location:update error]:', err.message);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    // trip:status
    socket.on('trip:status', (data, callback) => {
      try {
        const { tripId, status, stopName, eta } = data || {};
        console.log(`[Socket.IO trip:status]: Trip ${tripId} status: ${status}`);

        const payload = {
          tripId,
          status,
          stopName,
          eta,
          timestamp: new Date().toISOString(),
        };

        io.to(`trip:${tripId}`).emit('trip:status', payload);
        io.emit('trip:status', payload);

        if (typeof callback === 'function') {
          callback({ success: true, payload });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // trip:end
    socket.on('trip:end', async (data, callback) => {
      try {
        const { tripId, vehicleId } = data || {};
        console.log(`[Socket.IO trip:end]: Concluded trip ${tripId}`);

        if (tripId) {
          activeTripLocations.delete(tripId.toString());

          // Mark trip in DB if not already done
          Trip.findByIdAndUpdate(tripId, {
            status: 'completed',
            endTime: new Date(),
          }).catch(() => {});
        }

        const payload = {
          tripId,
          vehicleId,
          status: 'completed',
          timestamp: new Date().toISOString(),
        };

        io.to(`trip:${tripId}`).emit('trip:completed', payload);
        io.emit('trip:completed', payload);

        if (typeof callback === 'function') {
          callback({ success: true, payload });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // ==========================================
    // 2. PASSENGER EVENTS
    // ==========================================

    // passenger:join
    socket.on('passenger:join', (data, callback) => {
      const passengerId = data?.passengerId || socket.user?.id;
      if (passengerId) {
        socket.join(`passenger:${passengerId}`);
        console.log(`[Socket.IO] Passenger registered in room passenger:${passengerId}`);
      }
      if (typeof callback === 'function') {
        callback({ success: true, message: 'Passenger connected to live radar' });
      }
    });

    // trip:subscribe (and compatible alias trip:join)
    const handleSubscribe = ({ tripId }, callback) => {
      if (!tripId) {
        if (typeof callback === 'function') callback({ success: false, error: 'tripId is required' });
        return;
      }

      socket.join(`trip:${tripId}`);
      console.log(`[Socket.IO] Client ${socket.id} subscribed to trip:${tripId}`);

      // Send latest cached coordinates immediately so map markers populate instantly
      const cached = activeTripLocations.get(tripId.toString());
      if (cached) {
        socket.emit('vehicle:location', cached);
      }

      if (typeof callback === 'function') {
        callback({
          success: true,
          tripId,
          hasCachedLocation: !!cached,
          lastLocation: cached || null,
        });
      }
    };

    socket.on('trip:subscribe', handleSubscribe);
    socket.on('trip:join', handleSubscribe);

    // trip:unsubscribe (and compatible alias trip:leave)
    const handleUnsubscribe = ({ tripId }, callback) => {
      if (tripId) {
        socket.leave(`trip:${tripId}`);
        console.log(`[Socket.IO] Client ${socket.id} unsubscribed from trip:${tripId}`);
      }
      if (typeof callback === 'function') {
        callback({ success: true, tripId });
      }
    };

    socket.on('trip:unsubscribe', handleUnsubscribe);
    socket.on('trip:leave', handleUnsubscribe);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });
};

module.exports = { initSocketHandler, activeTripLocations };
