module.exports = {
  MODEL_DIRS: {
    fire: 'Fire_Detection_Model',
    garbage: 'Garbage_Detection_Model',
    pothole: 'PotHole_Detection_Model',
    parking: 'Parking_Detection_Model/parking_module',
    traffic: 'Traffic_Detection_Model',
  },
  SEVERITY_THRESHOLDS: {
    critical: 0.85,
    high: 0.65,
    medium: 0.45,
  },
  ZONES: [
    'Zone A - North',
    'Zone B - South',
    'Zone C - East',
    'Zone D - West',
    'Zone E - Central',
  ],
  INCIDENT_TYPES: ['fire', 'garbage', 'pothole', 'parking', 'traffic'],
  INCIDENT_STATUSES: ['open', 'in_progress', 'resolved', 'dismissed'],
  INCIDENT_SEVERITIES: ['low', 'medium', 'high', 'critical'],
};
