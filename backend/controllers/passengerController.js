const Route = require('../models/Route');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const VehicleLocation = require('../models/VehicleLocation');

// @desc    Get passenger dashboard summary
// @route   GET /api/passenger/dashboard
// @access  Public / Private
exports.getDashboard = async (req, res, next) => {
  try {
    const activeTripsCount = await Trip.countDocuments({ status: 'in-progress' });
    const totalRoutesCount = await Route.countDocuments({ active: true });

    res.json({
      success: true,
      data: {
        activeBuses: activeTripsCount,
        totalRoutes: totalRoutesCount,
        systemStatus: 'Operational',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all available routes for passenger
// @route   GET /api/passenger/routes
// @access  Public / Private
exports.getRoutes = async (req, res, next) => {
  try {
    const routes = await Route.find({ active: true }).sort({ routeNumber: 1 });
    res.json({
      success: true,
      count: routes.length,
      data: routes,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active buses currently on route with live coordinates
// @route   GET /api/passenger/active-vehicles
// @access  Public / Private
exports.getActiveVehicles = async (req, res, next) => {
  try {
    const activeTrips = await Trip.find({ status: 'in-progress' })
      .populate('vehicleId')
      .populate('routeId')
      .populate('driverId', 'name phone');

    // Attach latest location for each active trip
    const vehiclesWithLocations = await Promise.all(
      activeTrips.map(async (trip) => {
        const latestLoc = await VehicleLocation.findOne({ tripId: trip._id }).sort({
          timestamp: -1,
        });

        return {
          tripId: trip._id,
          vehicle: trip.vehicleId,
          route: trip.routeId,
          driver: trip.driverId,
          startTime: trip.startTime,
          latestLocation: latestLoc || {
            latitude: trip.startLocation?.latitude || 37.7749,
            longitude: trip.startLocation?.longitude || -122.4194,
            speed: 0,
            heading: 0,
            timestamp: trip.startTime,
          },
        };
      })
    );

    res.json({
      success: true,
      count: vehiclesWithLocations.length,
      data: vehiclesWithLocations,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get latest live location for a specific vehicle
// @route   GET /api/passenger/vehicle/:vehicleId/location
// @access  Public / Private
exports.getVehicleLocation = async (req, res, next) => {
  try {
    const { vehicleId } = req.params;

    const location = await VehicleLocation.findOne({ vehicleId })
      .sort({ timestamp: -1 })
      .populate('tripId')
      .populate('vehicleId');

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
