import { createContext, useContext, useState, useCallback, useRef } from 'react';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const addAlert = useCallback((alertData) => {
    setAlerts((prev) => [alertData, ...prev].slice(0, 50));
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, ...alertData }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const markRead = useCallback((id) => {
    setAlerts((prev) =>
      prev.map((a) => (a._id === id ? { ...a, isRead: true } : a))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  }, []);

  const setInitialAlerts = useCallback((initialAlerts) => {
    setAlerts(initialAlerts);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <AlertContext.Provider value={{ alerts, toasts, unreadCount, addAlert, markRead, markAllRead, setInitialAlerts, dismissToast }}>
      {children}
    </AlertContext.Provider>
  );
}

export const useAlertContext = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlertContext must be inside AlertProvider');
  return ctx;
};

export default AlertContext;
