const express = require('express');
const router = express.Router();
const {
  getAllVehicles,
  getMyVehicles,
  createVehicle,
  getVehicleById,
} = require('../controllers/vehicleController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', getAllVehicles);
router.get('/mine', protect, authorize('driver'), getMyVehicles);
router.post('/', protect, authorize('driver'), createVehicle);
router.get('/:id', getVehicleById);

module.exports = router;
