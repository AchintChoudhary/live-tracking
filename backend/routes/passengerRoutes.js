const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getRoutes,
  getActiveVehicles,
  getVehicleLocation,
} = require('../controllers/passengerController');

// Passenger public endpoints (with optional authorization)
router.get('/dashboard', getDashboard);
router.get('/routes', getRoutes);
router.get('/active-vehicles', getActiveVehicles);
router.get('/vehicle/:vehicleId/location', getVehicleLocation);

module.exports = router;
