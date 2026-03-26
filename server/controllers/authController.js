const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateTokens = (user) => {
  const payload = { id: user._id, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

const setCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'DuplicateEmail', message: 'Email already in use' });
    }
    const user = await User.create({ name, email, password, role, department });
    const { accessToken, refreshToken } = generateTokens(user);
    res.cookie('refreshToken', refreshToken, setCookieOptions());
    res.status(201).json({
      success: true,
      data: { user: user.toSafeObject(), accessToken },
      message: 'Account created successfully',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'InvalidCredentials', message: 'Invalid email or password' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'InvalidCredentials', message: 'Invalid email or password' });
    }
    user.lastLogin = new Date();
    await user.save();
    const { accessToken, refreshToken } = generateTokens(user);
    res.cookie('refreshToken', refreshToken, setCookieOptions());
    res.json({
      success: true,
      data: { user: user.toSafeObject(), accessToken },
      message: 'Login successful',
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    res.clearCookie('refreshToken');
    res.json({ success: true, data: null, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, error: 'NoRefreshToken', message: 'No refresh token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Unauthorized', message: 'User not found' });
    }
    const { accessToken, refreshToken } = generateTokens(user);
    res.cookie('refreshToken', refreshToken, setCookieOptions());
    res.json({
      success: true,
      data: { accessToken, user: user.toSafeObject() },
      message: 'Token refreshed',
    });
  } catch (err) {
    res.clearCookie('refreshToken');
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    res.json({ success: true, data: { user: req.user }, message: 'User profile retrieved' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, department } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, department },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: { user }, message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, refresh, getMe, updateProfile };
