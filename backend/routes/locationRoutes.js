const express = require('express');
const router = express.Router();
const {
  updateLocation,
  getVehicleLocation,
  reverseGeocode,
} = require('../controllers/locationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// POST /api/location/update (Protected - Driver / Admin only)
router.post('/update', protect, authorize('driver', 'admin'), updateLocation);

router.get('/reverse-geocode', protect, reverseGeocode);
// GET /api/location/:vehicleId (Public or Passenger)
router.get('/:vehicleId', getVehicleLocation);
router.get('/vehicle/:vehicleId', getVehicleLocation);

module.exports = router;
