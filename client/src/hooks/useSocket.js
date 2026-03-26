import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAlertContext } from '../context/AlertContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;

export function useSocket(accessToken) {
  const { addAlert } = useAlertContext();
  const listenersRef = useRef({});

  const on = useCallback((event, handler) => {
    listenersRef.current[event] = handler;
    if (socketInstance) {
      socketInstance.on(event, handler);
    }
  }, []);

  const off = useCallback((event) => {
    if (socketInstance && listenersRef.current[event]) {
      socketInstance.off(event, listenersRef.current[event]);
      delete listenersRef.current[event];
    }
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
      });
    }

    const socket = socketInstance;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    socket.on('new_alert', (data) => {
      if (data?.incident) {
        addAlert({
          _id: data.incident._id,
          type: data.incident.type,
          message: data.message || `New ${data.incident.type} incident detected`,
          location: data.incident.location?.zone,
          severity: data.incident.severity,
          isRead: false,
          createdAt: new Date().toISOString(),
          incident: data.incident,
        });
      }
    });

    // Re-attach any pending external listeners
    Object.entries(listenersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      // We don't disconnect on unmount to preserve the connection across page changes
      // just remove our specific handlers
    };
  }, [accessToken, addAlert]);

  return { socket: socketInstance, on, off };
}
