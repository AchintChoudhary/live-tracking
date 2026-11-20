const Vehicle = require('../models/Vehicle');

// @desc    Get all vehicles in transit fleet
// @route   GET /api/vehicles
// @access  Public / Private
exports.getAllVehicles = async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({ active: true })
      .populate('assignedDriver', 'name email phone')
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
