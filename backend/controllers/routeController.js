const Route = require('../models/Route');

// @desc    Get all routes
// @route   GET /api/routes
// @access  Public
exports.getAllRoutes = async (req, res, next) => {
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

// @desc    Get single route by ID
// @route   GET /api/routes/:id
// @access  Public
exports.getRouteById = async (req, res, next) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    res.json({
      success: true,
      data: route,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new transit corridor route
// @route   POST /api/routes
// @access  Private (Admin / Dispatcher)
exports.createRoute = async (req, res, next) => {
  try {
    const { routeNumber, routeName, startingPoint, destination, stops, coordinates } = req.body;

    const route = await Route.create({
      routeNumber,
      routeName,
      startingPoint,
      destination,
      stops: stops || [],
      coordinates: coordinates || [],
    });

    res.status(201).json({
      success: true,
      data: route,
    });
  } catch (error) {
    next(error);
  }
};
