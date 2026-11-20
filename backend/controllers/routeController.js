const Route = require('../models/Route');
const {
  getRoutePreview,
  hasRoutingProviderConfigured,
} = require('../services/googleRoutesService');
const { isValidCoordinates } = require('../utils/distanceCalculator');

exports.previewRoute = async (req, res) => {
  const { stops } = req.body;
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 20) {
    return res.status(400).json({
      success: false,
      message: 'Provide 2 to 20 ordered route stops',
    });
  }
  const routeStops = [];
  for (let index = 0; index < stops.length; index += 1) {
    const latitude = Number(stops[index]?.latitude);
    const longitude = Number(stops[index]?.longitude);
    if (!isValidCoordinates(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        message: `Route stop ${index + 1} has invalid coordinates`,
      });
    }
    routeStops.push({ latitude, longitude });
  }
  if (!hasRoutingProviderConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'A Google Routes key or self-hosted OSRM endpoint is required for road-route previews',
    });
  }

  try {
    const preview = await getRoutePreview(routeStops);
    if (!preview) {
      return res.status(502).json({
        success: false,
        message: 'The routing provider did not return a valid road route',
      });
    }
    res.json({ success: true, data: preview });
  } catch (error) {
    console.error(`[Route preview] ${error.message}`);
    res.status(502).json({
      success: false,
      message: 'Road-route preview is temporarily unavailable',
    });
  }
};

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
    const {
      routeNumber,
      routeName,
      startingPoint,
      destination,
      stops,
      coordinates,
      coordinatesVerified,
    } = req.body;

    const route = await Route.create({
      routeNumber,
      routeName,
      startingPoint,
      destination,
      stops: stops || [],
      coordinates: coordinates || [],
      coordinatesVerified: coordinatesVerified === true,
    });

    res.status(201).json({
      success: true,
      data: route,
    });
  } catch (error) {
    next(error);
  }
};
