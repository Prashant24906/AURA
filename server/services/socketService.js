const socketService = {
  io: null,

  init(io) {
    this.io = io;

    io.use((socket, next) => {
      // Optional JWT auth on socket — skip if no token (public viewers)
      const token = socket.handshake.auth?.token;
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          socket.userId = decoded.id;
          socket.userRole = decoded.role;
          if (decoded.role === 'admin') socket.join('admin');
          if (decoded.role === 'operator') socket.join('operator');
        } catch (e) {
          console.warn('[Socket] Invalid token on handshake');
        }
      }
      next();
    });

    io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });
  },

  emitNewAlert(data) {
    if (this.io) {
      this.io.emit('new_alert', data);
    }
  },

  emitIncidentUpdated(data) {
    if (this.io) {
      this.io.emit('incident_updated', data);
    }
  },

  emitModelProcessing(imageId, progress) {
    if (this.io) {
      this.io.emit('model_processing', { imageId, progress });
    }
  },
};

module.exports = socketService;
