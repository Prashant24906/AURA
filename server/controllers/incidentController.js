const Incident = require('../models/Incident');
const Alert = require('../models/Alert');
const socketService = require('../services/socketService');

// GET /api/incidents
const getIncidents = async (req, res, next) => {
  try {
    const { type, status, severity, zone, dateFrom, dateTo, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (zone) filter['location.zone'] = zone;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (search) {
      filter.$or = [
        { 'location.address': { $regex: search, $options: 'i' } },
        { 'detectionData.label': { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Incident.countDocuments(filter);
    const incidents = await Incident.find(filter)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        incidents,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      message: 'Incidents retrieved',
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/incidents/:id
const getIncident = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('reportedBy', 'name email role')
      .populate('assignedTo', 'name email role');
    if (!incident) {
      return res.status(404).json({ success: false, error: 'NotFound', message: 'Incident not found' });
    }
    res.json({ success: true, data: { incident }, message: 'Incident retrieved' });
  } catch (err) {
    next(err);
  }
};

// POST /api/incidents
const createIncident = async (req, res, next) => {
  try {
    const incident = await Incident.create({ ...req.body, reportedBy: req.user._id });
    await Alert.create({
      incidentId: incident._id,
      message: `Manual incident reported: ${incident.type}`,
      type: incident.type,
      severity: incident.severity,
    });
    socketService.emitNewAlert({ incident: incident.toObject() });
    res.status(201).json({ success: true, data: { incident }, message: 'Incident created' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/incidents/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const update = { status };
    if (notes) update.notes = notes;
    if (status === 'resolved') update.resolvedAt = new Date();

    const incident = await Incident.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!incident) {
      return res.status(404).json({ success: false, error: 'NotFound', message: 'Incident not found' });
    }
    socketService.emitIncidentUpdated({ id: incident._id, status, updatedBy: req.user._id });
    res.json({ success: true, data: { incident }, message: 'Status updated' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/incidents/:id/assign
const assignIncident = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { assignedTo, status: 'in_progress' },
      { new: true }
    ).populate('assignedTo', 'name email');
    if (!incident) {
      return res.status(404).json({ success: false, error: 'NotFound', message: 'Incident not found' });
    }
    res.json({ success: true, data: { incident }, message: 'Incident assigned' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/incidents/:id
const deleteIncident = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden', message: 'Admin access required' });
    }
    const incident = await Incident.findByIdAndDelete(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'NotFound', message: 'Incident not found' });
    }
    await Alert.deleteMany({ incidentId: req.params.id });
    res.json({ success: true, data: null, message: 'Incident deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getIncidents, getIncident, createIncident, updateStatus, assignIncident, deleteIncident };
