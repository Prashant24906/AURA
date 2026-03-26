require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth');
const incidentRoutes = require('./routes/incidents');
const uploadRoutes = require('./routes/upload');
const analyticsRoutes = require('./routes/analytics');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS — credentials must be true for httpOnly cookie
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Static file serving for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'online', timestamp: new Date() }, message: 'AURA API is running' });
});

// Global error handler (must be after routes)
app.use(errorHandler);

// Serve static assets from React in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'dist', 'index.html'));
  });
}

module.exports = app;
