require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const socketService = require('./services/socketService');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

socketService.init(io);

(async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`[AURA] Server running on port ${PORT}`);
    console.log(`[AURA] Client URL: ${CLIENT_URL}`);
    console.log(`[AURA] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
})();
