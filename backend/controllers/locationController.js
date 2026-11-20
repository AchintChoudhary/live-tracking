const VehicleLocation = require('../models/VehicleLocation');
const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const { isValidCoordinates } = require('../utils/distanceCalculator');
const { activeTripLocations } = require('../sockets/socketHandler');
const { getProvider, reverseGeocode: lookupAddress } = require('../services/geocodingService');

// @desc    Update vehicle GPS location via REST API
// @route   POST /api/location/update
// @access  Private (Driver only)
exports.updateLocation = async (req, res, next) => {
  try {
    const {
      tripId,
      vehicleId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      timestamp,
    } = req.body;

    // 1. Validate coordinates
    if (!isValidCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates provided. Latitude must be -90..90, Longitude -180..180.',
      });
    }

    if (!tripId || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both tripId and vehicleId',
      });
    }
    const validOptionalTelemetry = (value, min, max = Infinity) =>
      value == null || (Number.isFinite(value) && value >= min && value <= max);
    if (
      !validOptionalTelemetry(accuracy, 0) ||
      !validOptionalTelemetry(speed, 0) ||
      !validOptionalTelemetry(heading, 0, 360)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS telemetry values',
      });
    }

    const locationTimestamp = timestamp ? new Date(timestamp) : new Date();
    if (
      Number.isNaN(locationTimestamp.getTime()) ||
      locationTimestamp.getTime() > Date.now() + 30000 ||
      Date.now() - locationTimestamp.getTime() > 120000
    ) {
      return res.status(400).json({
        success: false,
        message: 'GPS update timestamp is stale or invalid',
      });
    }

    // 2. Validate trip existence and status
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Associated trip not found',
      });
    }

    // 3. Ensure ended trips cannot receive new location updates
    if (trip.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: `Location update rejected: Trip is currently ${trip.status}. Only in-progress trips accept telemetry.`,
      });
    }

    if (trip.vehicleId.toString() !== vehicleId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'vehicleId does not belong to this trip',
      });
    }

    const latestLocation = await VehicleLocation.findOne({ tripId }).sort({ timestamp: -1 }).select('timestamp');
    if (latestLocation && latestLocation.timestamp > locationTimestamp) {
      return res.status(409).json({
        success: false,
        message: 'Out-of-order GPS update rejected',
      });
    }

    // 4. Validate driver ownership
    if (
      trip.driverId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send location telemetry for this trip',
      });
    }

    // 5. Create Vehicle Location record
    const vehicleLoc = await VehicleLocation.create({
      vehicleId,
      driverId: req.user._id,
      tripId,
      latitude,
      longitude,
      ...(accuracy != null ? { accuracy } : {}),
      ...(speed != null ? { speed } : {}),
      ...(heading != null ? { heading } : {}),
      timestamp: locationTimestamp,
    });

    // 6. Update cache & broadcast to Socket.IO
    const locationPayload = {
      tripId,
      vehicleId,
      driverId: req.user._id,
      latitude,
      longitude,
      ...(accuracy != null ? { accuracy } : {}),
      ...(speed != null ? { speed: Math.round(speed) } : {}),
      ...(heading != null ? { heading: Math.round(heading) } : {}),
      timestamp: vehicleLoc.timestamp.toISOString(),
    };

    if (activeTripLocations) {
      activeTripLocations.set(tripId.toString(), locationPayload);
    }

    await Vehicle.findByIdAndUpdate(vehicleId, {
      currentLocation: {
        latitude,
        longitude,
        timestamp: vehicleLoc.timestamp,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`trip:${tripId}`).emit('vehicle:location', locationPayload);
    }

    res.status(200).json({
      success: true,
      data: locationPayload,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get latest GPS location for a specific vehicle
// @route   GET /api/location/:vehicleId
// @access  Public / Private
exports.getVehicleLocation = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;

    const location = await VehicleLocation.findOne({ vehicleId })
      .sort({ timestamp: -1 })
      .populate('tripId')
      .populate('vehicleId')
      .populate('driverId', 'name phone');

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'No live telemetry found for this vehicle',
      });
    }

    res.json({
      success: true,
      data: location,
    });
  } catch (error) {
    next(error);
  }
};

exports.reverseGeocode = async (req, res, next) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (!isValidCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude are required',
      });
    }

    if (getProvider() === 'none') {
      return res.status(503).json({
        success: false,
        message: 'Reverse geocoding is not configured',
      });
    }

    const address = await lookupAddress(latitude, longitude);
    if (!address) {
      return res.status(404).json({ success: false, message: 'No address found for these coordinates' });
    }
    res.json({ success: true, data: { address, latitude, longitude } });
  } catch (error) {
    next(error);
  }
};
