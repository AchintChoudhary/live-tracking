const express = require('express');
const { searchPlaces } = require('../controllers/placeController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/search', protect, searchPlaces);

module.exports = router;
