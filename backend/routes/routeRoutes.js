const express = require('express');
const router = express.Router();
const {
  getAllRoutes,
  getRouteById,
  createRoute,
  previewRoute,
} = require('../controllers/routeController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', getAllRoutes);
router.post('/preview', protect, authorize('driver'), previewRoute);
router.get('/:id', getRouteById);
router.post('/', protect, authorize('admin'), createRoute);

module.exports = router;
