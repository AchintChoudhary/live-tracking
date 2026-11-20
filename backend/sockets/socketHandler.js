const jwt = require('jsonwebtoken');
const VehicleLocation = require('../models/VehicleLocation');
const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const { isValidCoordinates } = require('../utils/distanceCalculator');

const isValidOptionalTelemetry = (value, min, max = Infinity) =>
  value == null || (Number.isFinite(value) && value >= min && value <= max);

/**
 * In-memory location cache for low-latency live broadcasting and instant passenger sync
 */
const activeTripLocations = new Map();
const lastLocationPersistence = new Map();

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
        if (!process.env.JWT_SECRET) return next(new Error('Socket authentication is not configured'));
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        socket.user.role = decoded.role;
      } catch (err) {
        return next(new Error('Invalid or expired socket authentication token'));
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
      if (!socket.user?.id) {
        if (typeof callback === 'function') callback({ success: false, error: 'Authentication required' });
        return;
      }
      if (data?.driverId && data.driverId !== socket.user.id) {
        if (typeof callback === 'function') callback({ success: false, error: 'Cannot join another driver channel' });
        return;
      }
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
        const { tripId } = data || {};
        if (!socket.user?.id) {
          if (typeof callback === 'function') callback({ success: false, error: 'Authentication required' });
          return;
        }
        if (!tripId) {
          if (typeof callback === 'function') callback({ success: false, error: 'tripId is required' });
          return;
        }

        console.log(`[Socket.IO trip:start] Trip #${tripId} initiated by socket ${socket.id}`);

        const trip = await Trip.findById(tripId).select('driverId status vehicleId routeId');
        if (!trip || trip.status !== 'in-progress') {
          if (typeof callback === 'function') callback({ success: false, error: 'Active trip not found' });
          return;
        }
        if (trip.driverId.toString() !== socket.user.id) {
          if (typeof callback === 'function') callback({ success: false, error: 'Not authorized for this trip' });
          return;
        }

        socket.join(`trip:${tripId}`);
        const vehicleId = trip.vehicleId;
        const routeId = trip.routeId;

        const payload = {
          tripId,
          vehicleId,
          routeId,
          timestamp: new Date().toISOString(),
        };

        io.to(`route:${routeId}`).emit('trip:started', payload);

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
        if (!socket.user?.id) {
          if (typeof callback === 'function') callback({ success: false, error: 'Authentication required' });
          return;
        }
        const {
          tripId,
          vehicleId,
          driverId,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
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
        if (
          !isValidOptionalTelemetry(accuracy, 0) ||
          !isValidOptionalTelemetry(speed, 0) ||
          !isValidOptionalTelemetry(heading, 0, 360)
        ) {
          if (typeof callback === 'function') callback({ success: false, error: 'Invalid GPS telemetry values' });
          return;
        }

        const locationTime = timestamp ? new Date(timestamp).getTime() : Date.now();
        if (!Number.isFinite(locationTime) || locationTime > Date.now() + 30000 || Date.now() - locationTime > 120000) {
          if (typeof callback === 'function') callback({ success: false, error: 'GPS update timestamp is stale or invalid' });
          return;
        }

        // 2. Reject location updates if trip has ended
        let tripRecord = null;
        try {
          tripRecord = await Trip.findById(tripId).select('status driverId vehicleId');
          if (tripRecord && tripRecord.status === 'completed') {
            console.warn(`[Socket.IO Location] Rejected: Trip ${tripId} is already completed.`);
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Trip is completed. Location updates are rejected.' });
            }
            return;
          }
        } catch (e) {
          if (typeof callback === 'function') callback({ success: false, error: 'Unable to verify active trip' });
          return;
        }

        if (!tripRecord || tripRecord.status !== 'in-progress') {
          if (typeof callback === 'function') callback({ success: false, error: 'Active trip not found' });
          return;
        }
        if (tripRecord.driverId.toString() !== socket.user.id) {
          if (typeof callback === 'function') callback({ success: false, error: 'Not authorized to update this trip' });
          return;
        }
        if (tripRecord.vehicleId.toString() !== vehicleId.toString()) {
          if (typeof callback === 'function') callback({ success: false, error: 'vehicleId does not belong to this trip' });
          return;
        }
        const previousLocation = activeTripLocations.get(tripId.toString());
        if (previousLocation && new Date(previousLocation.timestamp).getTime() > locationTime) {
          if (typeof callback === 'function') callback({ success: false, error: 'Out-of-order GPS update rejected' });
          return;
        }

        const effectiveDriverId = socket.user.id;

        const locationPayload = {
          tripId,
          vehicleId,
          driverId: effectiveDriverId,
          latitude,
          longitude,
          ...(accuracy != null ? { accuracy: Math.round(accuracy) } : {}),
          ...(speed != null ? { speed: Math.round(speed) } : {}),
          ...(heading != null ? { heading: Math.round(heading) } : {}),
          timestamp: new Date(locationTime).toISOString(),
        };

        // 3. Cache latest location in memory for instant retrieval
        activeTripLocations.set(tripId.toString(), locationPayload);

        // 4. Broadcast only to passengers subscribed to this trip
        io.to(`trip:${tripId}`).emit('vehicle:location', locationPayload);

        // 5. Persist at a bounded frequency to avoid one database write per network frame
        const now = Date.now();
        const lastPersisted = lastLocationPersistence.get(tripId.toString()) || 0;
        if (now - lastPersisted >= 3000) {
          lastLocationPersistence.set(tripId.toString(), now);
          VehicleLocation.create({
            vehicleId,
            driverId: effectiveDriverId,
            tripId,
            latitude,
            longitude,
            ...(accuracy != null ? { accuracy } : {}),
            ...(speed != null ? { speed } : {}),
            ...(heading != null ? { heading } : {}),
            timestamp: new Date(locationTime),
          }).catch((dbErr) => {
            console.error('[Socket.IO location persistence error]:', dbErr.message);
          });
          Vehicle.findByIdAndUpdate(vehicleId, {
            currentLocation: {
              latitude,
              longitude,
              timestamp: new Date(locationTime),
            },
          }).catch((dbErr) => {
            console.error('[Socket.IO vehicle location update error]:', dbErr.message);
          });
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
        if (!socket.user?.id) {
          if (typeof callback === 'function') callback({ success: false, error: 'Authentication required' });
          return;
        }
        console.log(`[Socket.IO trip:status]: Trip ${tripId} status: ${status}`);

        const payload = {
          tripId,
          status,
          stopName,
          eta,
          timestamp: new Date().toISOString(),
        };

        Trip.findById(tripId).select('driverId status').then((trip) => {
          if (!trip || trip.status !== 'in-progress' || trip.driverId.toString() !== socket.user.id) {
            if (typeof callback === 'function') callback({ success: false, error: 'Not authorized to update this trip' });
            return;
          }
          Trip.findByIdAndUpdate(tripId, { liveStatus: status }).catch(() => {});
          io.to(`trip:${tripId}`).emit('trip:status', payload);
          if (typeof callback === 'function') callback({ success: true, payload });
        }).catch(() => {
          if (typeof callback === 'function') callback({ success: false, error: 'Unable to verify trip' });
        });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // trip:end
    socket.on('trip:end', async (data, callback) => {
      try {
        const { tripId, vehicleId } = data || {};
        if (!socket.user?.id) {
          if (typeof callback === 'function') callback({ success: false, error: 'Authentication required' });
          return;
        }
        console.log(`[Socket.IO trip:end]: Concluded trip ${tripId}`);

        if (tripId) {
          const trip = await Trip.findById(tripId).select('driverId status');
          if (!trip || trip.driverId.toString() !== socket.user.id) {
            if (typeof callback === 'function') callback({ success: false, error: 'Not authorized to end this trip' });
            return;
          }
          if (trip.status !== 'completed') {
            if (typeof callback === 'function') {
              callback({ success: false, error: 'Complete the trip through the authenticated trip endpoint first' });
            }
            return;
          }
          activeTripLocations.delete(tripId.toString());
          lastLocationPersistence.delete(tripId.toString());

        }

        const payload = {
          tripId,
          vehicleId,
          status: 'completed',
          timestamp: new Date().toISOString(),
        };

        io.to(`trip:${tripId}`).emit('trip:completed', payload);

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
    const handleSubscribe = (data = {}, callback) => {
      const { tripId } = data;
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

const clearTripLocationCache = (tripId) => {
  activeTripLocations.delete(String(tripId));
  lastLocationPersistence.delete(String(tripId));
};

module.exports = { initSocketHandler, activeTripLocations, clearTripLocationCache };
