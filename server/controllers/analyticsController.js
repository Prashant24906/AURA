const Incident = require('../models/Incident');

// GET /api/analytics/summary
const getSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [typeCounts, sevCounts, statusCounts, todayCounts, yesterdayCounts] = await Promise.all([
      Incident.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      Incident.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Incident.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: { createdAt: { $gte: yesterday, $lt: today } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    const byType = {};
    typeCounts.forEach((t) => (byType[t._id] = t.count));
    const bySeverity = {};
    sevCounts.forEach((s) => (bySeverity[s._id] = s.count));
    const byStatus = {};
    statusCounts.forEach((s) => (byStatus[s._id] = s.count));
    const todayByType = {};
    todayCounts.forEach((t) => (todayByType[t._id] = t.count));
    const yesterdayByType = {};
    yesterdayCounts.forEach((t) => (yesterdayByType[t._id] = t.count));

    res.json({
      success: true,
      data: { byType, bySeverity, byStatus, todayByType, yesterdayByType, total: await Incident.countDocuments() },
      message: 'Summary retrieved',
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/trends
const getTrends = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const trends = await Incident.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    res.json({ success: true, data: { trends }, message: 'Trends retrieved' });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/by-zone
const getByZone = async (req, res, next) => {
  try {
    const zones = await Incident.aggregate([
      {
        $group: {
          _id: { zone: '$location.zone', type: '$type' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, data: { zones }, message: 'Zone data retrieved' });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/model-performance
const getModelPerformance = async (req, res, next) => {
  try {
    const performance = await Incident.aggregate([
      { $match: { 'detectionData.confidence': { $exists: true } } },
      {
        $group: {
          _id: '$type',
          avgConfidence: { $avg: '$detectionData.confidence' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, data: { performance }, message: 'Model performance retrieved' });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/resolution-time
const getResolutionTime = async (req, res, next) => {
  try {
    const resolution = await Incident.aggregate([
      { $match: { status: 'resolved', resolvedAt: { $exists: true } } },
      {
        $group: {
          _id: '$type',
          avgHours: {
            $avg: {
              $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, data: { resolution }, message: 'Resolution time retrieved' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSummary, getTrends, getByZone, getModelPerformance, getResolutionTime };
