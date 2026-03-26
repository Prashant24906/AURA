const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, logout, refresh, getMe, updateProfile } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'RateLimited', message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authMiddleware, logout);
router.post('/refresh', refresh);
router.get('/me', authMiddleware, getMe);
router.patch('/profile', authMiddleware, updateProfile);

module.exports = router;
