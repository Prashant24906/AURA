const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  getIncidents,
  getIncident,
  createIncident,
  updateStatus,
  assignIncident,
  deleteIncident,
} = require('../controllers/incidentController');

router.use(authMiddleware);

router.get('/', getIncidents);
router.get('/:id', getIncident);
router.post('/', createIncident);
router.patch('/:id/status', updateStatus);
router.patch('/:id/assign', assignIncident);
router.delete('/:id', deleteIncident);

module.exports = router;
