const VehicleLocation = require('../models/VehicleLocation');
const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const { isValidCoordinates } = require('../utils/distanceCalculator');
const { activeTripLocations } = require('../sockets/socketHandler');

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
      accuracy = 0,
      speed = 0,
      heading = 0,
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
      accuracy,
      speed,
      heading,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    // 6. Update cache & broadcast to Socket.IO
    const locationPayload = {
      tripId,
      vehicleId,
      driverId: req.user._id,
      latitude,
      longitude,
      accuracy,
      speed: Math.round(speed),
      heading: Math.round(heading),
      timestamp: vehicleLoc.timestamp.toISOString(),
    };

    if (activeTripLocations) {
      activeTripLocations.set(tripId.toString(), locationPayload);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`trip:${tripId}`).emit('vehicle:location', locationPayload);
      io.emit('vehicle:location', locationPayload);
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
