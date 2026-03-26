const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getSummary, getTrends, getByZone, getModelPerformance, getResolutionTime } = require('../controllers/analyticsController');
const User = require('../models/User');
const Alert = require('../models/Alert');

router.use(authMiddleware);

router.get('/summary', getSummary);
router.get('/trends', getTrends);
router.get('/by-zone', getByZone);
router.get('/model-performance', getModelPerformance);
router.get('/resolution-time', getResolutionTime);

// GET /api/analytics/users — for settings team tab
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: { users }, message: 'Users retrieved' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/analytics/users/:id — update user role/status
router.patch('/users/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden', message: 'Admin only' });
    }
    const { role, isActive } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role, isActive }, { new: true }).select('-password');
    res.json({ success: true, data: { user }, message: 'User updated' });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/alerts — recent alerts
router.get('/alerts', async (req, res, next) => {
  try {
    const alerts = await Alert.find().populate('incidentId').sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: { alerts }, message: 'Alerts retrieved' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/analytics/alerts/:id/read
router.patch('/alerts/:id/read', async (req, res, next) => {
  try {
    await Alert.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, data: null, message: 'Alert marked as read' });
  } catch (err) {
    next(err);
  }
});

// POST /api/analytics/alerts/read-all
router.post('/alerts/read-all', async (req, res, next) => {
  try {
    await Alert.updateMany({ isRead: false }, { isRead: true });
    res.json({ success: true, data: null, message: 'All alerts marked as read' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
