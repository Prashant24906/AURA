const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' },
    message: { type: String },
    type: {
      type: String,
      enum: ['fire', 'garbage', 'pothole', 'parking', 'traffic'],
    },
    severity: { type: String },
    isRead: { type: Boolean, default: false },
    sentTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
