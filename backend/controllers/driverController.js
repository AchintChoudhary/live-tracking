const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const VehicleLocation = require('../models/VehicleLocation');
const mongoose = require('mongoose');
const { isValidCoordinates } = require('../utils/distanceCalculator');
const { clearTripLocationCache } = require('../sockets/socketHandler');

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

    const assignedVehicles = await Vehicle.find({ assignedDriver: driverId, active: true })
      .populate('assignedRoute')
      .sort({ vehicleNumber: 1 });

    res.json({
      success: true,
      data: {
        activeTrip,
        totalTrips,
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        assignedVehicles,
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

    if (!routeId || !vehicleId || !startLocation) {
      return res.status(400).json({
        success: false,
        message: 'Please provide routeId, vehicleId, and the device GPS startLocation',
      });
    }

    if (!mongoose.isValidObjectId(routeId) || !mongoose.isValidObjectId(vehicleId)) {
      return res.status(400).json({
        success: false,
        message: 'routeId and vehicleId must be valid IDs',
      });
    }
    if (!isValidCoordinates(startLocation.latitude, startLocation.longitude)) {
      return res.status(400).json({
        success: false,
        message: 'A valid GPS start location is required to start a trip',
      });
    }

    const [route, vehicle, activeDriverTrip, activeVehicleTrip] = await Promise.all([
      Route.findById(routeId),
      Vehicle.findById(vehicleId),
      Trip.findOne({ driverId, status: 'in-progress' }),
      Trip.findOne({ vehicleId, status: 'in-progress' }),
    ]);

    if (!route || !route.active) {
      return res.status(404).json({ success: false, message: 'Route not found or inactive' });
    }

    if (!vehicle || !vehicle.active) {
      return res.status(404).json({ success: false, message: 'Vehicle not found or inactive' });
    }

    if (
      req.user.role !== 'admin' &&
      (!vehicle.assignedDriver || vehicle.assignedDriver.toString() !== driverId.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'This vehicle is assigned to another driver',
      });
    }

    if (
      req.user.role !== 'admin' &&
      (!vehicle.assignedRoute || vehicle.assignedRoute.toString() !== routeId.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'This route is not assigned to the selected bus',
      });
    }

    if (activeDriverTrip) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active trip',
        tripId: activeDriverTrip._id,
      });
    }

    if (activeVehicleTrip) {
      return res.status(409).json({
        success: false,
        message: 'This vehicle already has an active trip',
        tripId: activeVehicleTrip._id,
      });
    }

    const trip = await Trip.create({
      driverId,
      vehicleId,
      routeId,
      startTime: new Date(),
      status: 'in-progress',
      startLocation: {
        name: typeof startLocation.name === 'string' ? startLocation.name.trim() : '',
        latitude: Number(startLocation.latitude),
        longitude: Number(startLocation.longitude),
      },
    });

    // Populate route and vehicle info
    const populatedTrip = await Trip.findById(trip._id)
      .populate('routeId')
      .populate('vehicleId');

    // Broadcast trip started to all passengers via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`route:${routeId}`).emit('trip:started', {
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

    if (!mongoose.isValidObjectId(tripId)) {
      return res.status(400).json({ success: false, message: 'A valid tripId is required' });
    }
    if (distance != null && (!Number.isFinite(distance) || distance < 0)) {
      return res.status(400).json({ success: false, message: 'distance must be a non-negative number' });
    }
    if (duration != null && (!Number.isFinite(duration) || duration < 0)) {
      return res.status(400).json({ success: false, message: 'duration must be a non-negative number' });
    }

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
    if (endLocation) {
      if (!isValidCoordinates(endLocation.latitude, endLocation.longitude)) {
        return res.status(400).json({
          success: false,
          message: 'endLocation must contain valid GPS coordinates',
        });
      }
      trip.endLocation = {
        name: typeof endLocation.name === 'string' ? endLocation.name.trim() : null,
        latitude: Number(endLocation.latitude),
        longitude: Number(endLocation.longitude),
      };
    }
    if (distance != null) trip.distance = distance;
    if (duration != null) trip.duration = duration;

    await trip.save();
    clearTripLocationCache(trip._id);

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
    const { tripId, status, liveStatus, stopName, eta } = req.body;
    if (!mongoose.isValidObjectId(tripId)) {
      return res.status(400).json({ success: false, message: 'A valid tripId is required' });
    }
    const requestedLiveStatus = liveStatus || status;
    if (
      typeof requestedLiveStatus !== 'string' ||
      requestedLiveStatus.trim().length < 1 ||
      requestedLiveStatus.trim().length > 100
    ) {
      return res.status(400).json({ success: false, message: 'A live status between 1 and 100 characters is required' });
    }
    if (!liveStatus && ['scheduled', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trip lifecycle status is managed by the start-trip and end-trip endpoints',
      });
    }
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
    if (trip.status !== 'in-progress') {
      return res.status(409).json({ success: false, message: 'Only an active trip can receive live status updates' });
    }

    // Assign human-readable liveStatus
    const currentLiveStatus = requestedLiveStatus.trim();
    trip.liveStatus = currentLiveStatus;

    await trip.save();

    // Broadcast trip status update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const payload = {
        tripId,
        status: currentLiveStatus,
        liveStatus: currentLiveStatus,
        stopName,
        eta,
        timestamp: new Date().toISOString(),
      };
      io.to(`trip:${tripId}`).emit('trip:status', payload);
    }

    res.json({
      success: true,
      message: 'Trip status updated successfully',
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};
