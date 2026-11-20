const express = require('express');
const router = express.Router();
const { register, registerDriver, login, getProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/driver/register', registerDriver);
router.post('/login', login);
router.get('/me', protect, getProfile);
router.get('/profile', protect, getProfile);

module.exports = router;
