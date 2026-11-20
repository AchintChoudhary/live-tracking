const express = require('express');
const router = express.Router();
const {
  getAllRoutes,
  getRouteById,
  createRoute,
} = require('../controllers/routeController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', getAllRoutes);
router.get('/:id', getRouteById);
router.post('/', protect, authorize('admin', 'driver'), createRoute);

module.exports = router;
