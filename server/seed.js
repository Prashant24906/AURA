require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Incident = require('./models/Incident');
const Alert = require('./models/Alert');

const ZONES = ['Zone A - North', 'Zone B - South', 'Zone C - East', 'Zone D - West', 'Zone E - Central'];
const TYPES = ['fire', 'garbage', 'pothole', 'parking', 'traffic'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'in_progress', 'resolved', 'dismissed'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randFloat = (min, max) => Math.random() * (max - min) + min;
const randDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d;
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Seed] Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Incident.deleteMany({});
    await Alert.deleteMany({});
    console.log('[Seed] Cleared existing data');

    // Create users
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@aura.city',
      password: 'Admin@123',
      role: 'admin',
      department: 'Command Center',
      isActive: true,
    });

    const op1 = await User.create({
      name: 'Operator One',
      email: 'operator1@aura.city',
      password: 'Operator@1',
      role: 'operator',
      department: 'Field Operations',
      isActive: true,
    });

    const op2 = await User.create({
      name: 'Operator Two',
      email: 'operator2@aura.city',
      password: 'Operator@2',
      role: 'operator',
      department: 'Traffic Control',
      isActive: true,
    });

    console.log('[Seed] Created 3 users');

    // Create 50 mock incidents
    const incidents = [];
    for (let i = 0; i < 50; i++) {
      const type = rand(TYPES);
      const confidence = randFloat(0.3, 0.99);
      let severity;
      if (confidence >= 0.85) severity = 'critical';
      else if (confidence >= 0.65) severity = 'high';
      else if (confidence >= 0.45) severity = 'medium';
      else severity = 'low';

      const status = rand(STATUSES);
      const createdAt = randDate(30);
      const resolvedAt = status === 'resolved' ? new Date(createdAt.getTime() + randFloat(1, 48) * 60 * 60 * 1000) : undefined;

      const incident = await Incident.create({
        type,
        severity,
        status,
        location: {
          address: `${Math.floor(Math.random() * 999) + 1} Urban Avenue, AURA City`,
          zone: rand(ZONES),
          coordinates: { lat: 28.6 + randFloat(-0.1, 0.1), lng: 77.2 + randFloat(-0.1, 0.1) },
        },
        detectionData: {
          confidence: parseFloat(confidence.toFixed(4)),
          label: `${type}_detected`,
          bbox: [
            Math.floor(randFloat(0, 200)),
            Math.floor(randFloat(0, 200)),
            Math.floor(randFloat(100, 400)),
            Math.floor(randFloat(100, 400)),
          ],
          modelName: `${type.charAt(0).toUpperCase() + type.slice(1)}_Detection_Model`,
        },
        imageUrl: `/uploads/seed_${type}_${i}.jpg`,
        reportedBy: rand([adminUser._id, op1._id, op2._id]),
        assignedTo: status !== 'open' ? rand([op1._id, op2._id]) : undefined,
        resolvedAt,
        notes: status === 'resolved' ? 'Issue has been addressed and resolved.' : '',
        createdAt,
        updatedAt: createdAt,
      });
      incidents.push(incident);
    }
    console.log('[Seed] Created 50 mock incidents');

    // Create 20 alerts
    const alertIncidents = incidents.slice(0, 20);
    for (const incident of alertIncidents) {
      await Alert.create({
        incidentId: incident._id,
        message: `${incident.type.charAt(0).toUpperCase() + incident.type.slice(1)} detected with ${(incident.detectionData.confidence * 100).toFixed(1)}% confidence at ${incident.location.zone}`,
        type: incident.type,
        severity: incident.severity,
        isRead: Math.random() > 0.5,
        sentTo: [adminUser._id, op1._id],
        createdAt: incident.createdAt,
      });
    }
    console.log('[Seed] Created 20 alerts');

    console.log('\n[Seed] ✅ Completed!');
    console.log('  Admin:     admin@aura.city / Admin@123');
    console.log('  Operator1: operator1@aura.city / Operator@1');
    console.log('  Operator2: operator2@aura.city / Operator@2');
    console.log('  Incidents: 50');
    console.log('  Alerts:    20');

    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error:', err);
    process.exit(1);
  }
}

seed();
