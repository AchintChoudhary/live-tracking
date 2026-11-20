const express = require('express');
const router = express.Router();
const {
  startTrip,
  endTrip,
  updateTripStatus,
} = require('../controllers/driverController');
const { searchActiveTrips, getTripEta } = require('../controllers/tripSearchController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/search', searchActiveTrips);
router.get('/:tripId/eta', getTripEta);

router.use(protect);
router.use(authorize('driver', 'admin'));

router.get('/active', async (req, res, next) => {
  try {
    const Trip = require('../models/Trip');
    const trips = await Trip.find({ status: 'in-progress' })
      .populate('driverId', 'name phone')
      .populate('vehicleId')
      .populate('routeId');
    res.json({ success: true, count: trips.length, data: trips });
  } catch (error) {
    next(error);
  }
});
router.post('/start', startTrip);
router.patch('/:id/status', (req, res, next) => {
  req.body.tripId = req.params.id;
  updateTripStatus(req, res, next);
});
router.patch('/:id/end', (req, res, next) => {
  req.body.tripId = req.params.id;
  endTrip(req, res, next);
});

module.exports = router;
