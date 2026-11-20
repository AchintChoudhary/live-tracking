const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const VehicleLocation = require('../models/VehicleLocation');

// @desc    Get driver dashboard metrics & active trip status
// @route   GET /api/driver/dashboard
// @access  Private (Driver only)
exports.getDashboard = async (req, res, next) => {
  try {
    const driverId = req.user._id;

    // 1. Check for active trip
    const activeTrip = await Trip.findOne({
      driverId,
      status: 'in-progress',
    })
      .populate('routeId')
      .populate('vehicleId');

    // 2. Aggregate total trips & distance
    const totalTrips = await Trip.countDocuments({
      driverId,
      status: 'completed',
    });

    const distanceAgg = await Trip.aggregate([
      { $match: { driverId, status: 'completed' } },
      { $group: { _id: null, totalDist: { $sum: '$distance' } } },
    ]);
    const totalDistance = distanceAgg[0]?.totalDist || 0;

    // 3. Find assigned vehicle
    const assignedVehicle = await Vehicle.findOne({ assignedDriver: driverId });

    res.json({
      success: true,
      data: {
        activeTrip,
        totalTrips,
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        assignedVehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all trips conducted by this driver
// @route   GET /api/driver/trips
// @access  Private (Driver only)
exports.getTrips = async (req, res, next) => {
  try {
    const driverId = req.user._id;
    const trips = await Trip.find({ driverId })
      .populate('routeId')
      .populate('vehicleId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: trips.length,
      data: trips,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Start a new trip
// @route   POST /api/driver/start-trip
// @access  Private (Driver only)
exports.startTrip = async (req, res, next) => {
  try {
    const driverId = req.user._id;
    const { routeId, vehicleId, startLocation } = req.body;

    if (!routeId || !vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide routeId and vehicleId',
      });
    }

    // 1. Enforce rule: Only one active trip per vehicle
    const activeVehicleTrip = await Trip.findOne({
      vehicleId,
      status: 'in-progress',
    });

    if (activeVehicleTrip) {
      if (activeVehicleTrip.driverId.toString() !== driverId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle is currently in use on another active trip by another driver.',
        });
      }
      // Same driver: close previous active session for this vehicle
      activeVehicleTrip.status = 'completed';
      activeVehicleTrip.endTime = new Date();
      await activeVehicleTrip.save();
    }

    // 2. Conclude any previous active trips for this driver
    await Trip.updateMany(
      { driverId, status: 'in-progress' },
      { status: 'completed', endTime: new Date() }
    );

    const trip = await Trip.create({
      driverId,
      vehicleId,
      routeId,
      startTime: new Date(),
      status: 'in-progress',
      startLocation: startLocation || {
        name: 'Terminal 1',
        latitude: 37.7749,
        longitude: -122.4194,
      },
    });

    // Populate route and vehicle info
    const populatedTrip = await Trip.findById(trip._id)
      .populate('routeId')
      .populate('vehicleId');

    // Broadcast trip started to all passengers via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('trip:started', {
        tripId: trip._id,
        vehicleId,
        routeId,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(201).json({
      success: true,
      data: populatedTrip,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Conclude an active trip
// @route   PUT /api/driver/end-trip
// @access  Private (Driver only)
exports.endTrip = async (req, res, next) => {
  try {
    const { tripId, endLocation, distance, duration } = req.body;

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Enforce authorization: only the assigned driver or admin can end this trip
    if (
      trip.driverId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to end this trip',
      });
    }

    if (trip.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Trip has already been completed',
      });
    }

    trip.status = 'completed';
    trip.endTime = new Date();
    if (endLocation) trip.endLocation = endLocation;
    if (distance != null) trip.distance = distance;
    if (duration != null) trip.duration = duration;

    await trip.save();

    // Broadcast trip completion to passengers via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const payload = {
        tripId: trip._id,
        vehicleId: trip.vehicleId,
        status: 'completed',
        timestamp: new Date().toISOString(),
      };
      io.to(`trip:${tripId}`).emit('trip:completed', payload);
      io.emit('trip:completed', payload);
    }

    res.json({
      success: true,
      message: 'Trip completed successfully',
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update trip status (e.g. at stop, delayed)
// @route   PUT /api/driver/trip-status
// @access  Private (Driver only)
exports.updateTripStatus = async (req, res, next) => {
  try {
    const { tripId, status, stopName, eta } = req.body;
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Verify driver authorization
    if (
      trip.driverId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this trip status',
      });
    }

    if (status) trip.status = status;
    await trip.save();

    // Broadcast trip status update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const payload = {
        tripId,
        status,
        stopName,
        eta,
        timestamp: new Date().toISOString(),
      };
      io.to(`trip:${tripId}`).emit('trip:status', payload);
      io.emit('trip:status', payload);
    }

    res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};
