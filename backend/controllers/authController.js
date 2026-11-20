const jwt = require('jsonwebtoken');
const User = require('../models/User');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateCredentials = ({ name, email, password }) => {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return 'Name must be between 2 and 100 characters';
  }
  if (!isValidEmail(email)) return 'Please provide a valid email address';
  if (typeof password !== 'string' || password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
};

const validateDriverPassword = (password) =>
  typeof password === 'string' &&
  password.length >= 8 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const createAuthResponse = (res, user, status = 200) => {
  const token = generateToken(user._id);
  res.status(status).json({
    success: true,
    token,
    user: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
};

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const validationError = validateCredentials({ name, email: normalizedEmail, password });
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone: phone || '',
      role: 'passenger',
    });

    createAuthResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Register a driver account without allowing public role escalation
// @route   POST /api/auth/driver/register
// @access  Public
exports.registerDriver = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const validationError = validateCredentials({ name, email: normalizedEmail, password });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    if (!validateDriverPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Driver password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol',
      });
    }
    if (typeof phone !== 'string' || !/^\+?[0-9][0-9\s().-]{5,19}$/.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid driver phone number',
      });
    }

    const normalizedPhone = phone.trim();
    const userExists = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email or phone number already exists',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: normalizedPhone,
      role: 'driver',
    });
    createAuthResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user & return JWT token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password, driverId } = req.body;
    const loginIdentifier = (email || driverId || '').trim().toLowerCase();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const user = await User.findOne({
      $or: [
        { email: loginIdentifier },
        { phone: loginIdentifier },
      ],
    }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.',
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
