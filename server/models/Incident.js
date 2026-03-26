const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['fire', 'garbage', 'pothole', 'parking', 'traffic'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'dismissed'],
      default: 'open',
    },
    location: {
      address: { type: String },
      zone: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    detectionData: {
      confidence: { type: Number, min: 0, max: 1 },
      label: { type: String },
      bbox: [{ type: Number }],
      modelName: { type: String },
    },
    imageUrl: { type: String },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

incidentSchema.index({ type: 1, status: 1, createdAt: -1 });
incidentSchema.index({ 'location.zone': 1 });

module.exports = mongoose.model('Incident', incidentSchema);
