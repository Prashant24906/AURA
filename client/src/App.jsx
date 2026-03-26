import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import VoiceCommand from './components/ui/VoiceCommand';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveFeed from './pages/LiveFeed';
import Incidents from './pages/Incidents';
import Analytics from './pages/Analytics';
import Upload from './pages/Upload';
import Settings from './pages/Settings';

// Toast notification component
import { useAlertContext } from './context/AlertContext';
const TYPE_COLORS = { fire: '#FF4757', garbage: '#FFA502', pothole: '#FFA502', parking: '#2ED573', traffic: '#00D4FF' };

function ToastContainer() {
  const { toasts, dismissToast } = useAlertContext();
  return (
    <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 999, display: 'flex', flexDirection: 'column-reverse', gap: 8 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="slide-in-right"
          style={{
            background: '#1C2333', border: `1px solid ${TYPE_COLORS[t.type] || '#2A3F5F'}`,
            borderRadius: 10, padding: '12px 16px', minWidth: 280, maxWidth: 360,
            display: 'flex', alignItems: 'flex-start', gap: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            cursor: 'pointer',
          }}
          onClick={() => dismissToast(t.id)}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[t.type] || '#8892A4', marginTop: 4, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, color: '#E8EAF0', fontWeight: 500 }}>{t.message}</div>
            {t.location && <div style={{ fontSize: 11, color: '#8892A4', marginTop: 2 }}>{t.location}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Socket initializer — runs inside AuthProvider
function SocketInit() {
  const { accessToken } = useAuth();
  useSocket(accessToken);
  return null;
}

// Voice command controller — needs to be inside BrowserRouter for useNavigate
function VoiceCommandController() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <VoiceCommand
      onNavigate={(path) => navigate(path)}
      onStatus={() => navigate('/analytics')}
    />
  );
}

function PrivateRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0A0E1A',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Space Mono'", fontSize: 24, color: '#00D4FF', marginBottom: 16 }}>AURA</div>
          <div style={{ width: 24, height: 24, border: '2px solid #1E2D45', borderTopColor: '#00D4FF', borderRadius: '50%', margin: '0 auto' }} className="spin" />
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertProvider>
          <SocketInit />
          <ToastContainer />
          <VoiceCommandController />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/live" element={<PrivateRoute><LiveFeed /></PrivateRoute>} />
            <Route path="/incidents" element={<PrivateRoute><Incidents /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AlertProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
