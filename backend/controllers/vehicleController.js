const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const { isValidCoordinates } = require('../utils/distanceCalculator');
const { getRoutePreview } = require('../services/googleRoutesService');

// @desc    Get all vehicles in transit fleet
// @route   GET /api/vehicles
// @access  Public / Private
exports.getAllVehicles = async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({ active: true })
      .populate('assignedDriver', 'name')
      .sort({ vehicleNumber: 1 });

    res.json({
      success: true,
      count: vehicles.length,
      data: vehicles,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyVehicles = async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({ assignedDriver: req.user._id, active: true })
      .populate('assignedRoute')
      .sort({ vehicleNumber: 1 });
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (error) {
    next(error);
  }
};

exports.createVehicle = async (req, res, next) => {
  try {
    const {
      vehicleName,
      vehicleNumber,
      vehicleType,
      capacity,
      routeName,
      stops,
    } = req.body;

    const name = typeof vehicleName === 'string' ? vehicleName.trim() : '';
    const plate = typeof vehicleNumber === 'string' ? vehicleNumber.trim().toUpperCase() : '';
    const allowedTypes = [
      'Standard Transit Bus',
      'Articulated Bus',
      'Electric Shuttle',
      'Double Decker Bus',
    ];

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ success: false, message: 'Bus name must be between 2 and 80 characters' });
    }
    if (!/^[A-Z0-9][A-Z0-9 -]{1,19}$/.test(plate)) {
      return res.status(400).json({ success: false, message: 'Enter a valid registration number (2-20 letters, numbers, spaces, or hyphens)' });
    }
    if (!allowedTypes.includes(vehicleType)) {
      return res.status(400).json({ success: false, message: 'Unsupported bus type' });
    }
    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 100) {
      return res.status(400).json({ success: false, message: 'Capacity must be a whole number from 1 to 100' });
    }
    if (!Array.isArray(stops) || stops.length < 2 || stops.length > 20) {
      return res.status(400).json({ success: false, message: 'Configure an ordered route with a start, destination, and no more than 18 intermediate stops' });
    }

    const routeStops = [];
    for (let index = 0; index < stops.length; index += 1) {
      const stop = stops[index];
      const stopName = typeof stop?.name === 'string' ? stop.name.trim() : '';
      const latitude = Number(stop?.latitude);
      const longitude = Number(stop?.longitude);
      if (!stopName || stopName.length > 120 || !isValidCoordinates(latitude, longitude)) {
        return res.status(400).json({
          success: false,
          message: `Route stop ${index + 1} needs a name and valid coordinates`,
        });
      }
      routeStops.push({
        name: stopName,
        latitude,
        longitude,
        order: index + 1,
        placeId: typeof stop.placeId === 'string' ? stop.placeId.slice(0, 200) : null,
        dwellTimeSeconds: null,
      });
    }

    const existingVehicle = await Vehicle.findOne({ vehicleNumber: plate }).select('_id');
    if (existingVehicle) {
      return res.status(409).json({ success: false, message: 'A bus with this registration number already exists' });
    }

    const routeIdSuffix = String(req.user._id).slice(-6).toUpperCase();
    let routePreview = null;
    try {
      routePreview = await getRoutePreview(routeStops);
    } catch (error) {
      console.warn(`[Bus registration] Road geometry unavailable: ${error.message}`);
    }

    const route = await Route.create({
      routeNumber: `RT-${Date.now().toString(36).toUpperCase()}-${routeIdSuffix}`,
      routeName: typeof routeName === 'string' && routeName.trim()
        ? routeName.trim().slice(0, 100)
        : `${routeStops[0].name} - ${routeStops[routeStops.length - 1].name}`,
      startingPoint: routeStops[0].name,
      destination: routeStops[routeStops.length - 1].name,
      stops: routeStops,
      coordinates: routePreview?.coordinates || routeStops.map(({ latitude, longitude }) => ({ latitude, longitude })),
      coordinatesVerified: Boolean(routePreview?.coordinates?.length > 1),
      active: true,
    });

    let vehicle;
    try {
      vehicle = await Vehicle.create({
        vehicleName: name,
        vehicleNumber: plate,
        vehicleType,
        capacity: Number(capacity),
        assignedDriver: req.user._id,
        assignedRoute: route._id,
        active: true,
      });
    } catch (error) {
      await Route.deleteOne({ _id: route._id });
      throw error;
    }

    res.status(201).json({
      success: true,
      data: vehicle,
      route: {
        id: route._id,
        coordinatesVerified: route.coordinatesVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single vehicle by ID
// @route   GET /api/vehicles/:id
// @access  Public / Private
exports.getVehicleById = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate('assignedDriver', 'name phone');
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};
