const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getTrips,
  startTrip,
  endTrip,
  updateTripStatus,
} = require('../controllers/driverController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All driver routes are protected with JWT and role-checked for 'driver' or 'admin'
router.use(protect);
router.use(authorize('driver', 'admin'));

router.get('/dashboard', getDashboard);
router.get('/trips', getTrips);
router.post('/start-trip', startTrip);
router.put('/end-trip', endTrip);
router.put('/trip-status', updateTripStatus);

module.exports = router;
