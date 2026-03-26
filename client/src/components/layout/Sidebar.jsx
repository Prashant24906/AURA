import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Radio, AlertTriangle, BarChart3,
  Upload, Settings, LogOut, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/live', icon: Radio, label: 'Live Feed' },
  { to: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/upload', icon: Upload, label: 'Upload & Analyze' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const ROLE_COLORS = {
  admin: '#FF4757',
  operator: '#00D4FF',
  viewer: '#8892A4',
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      style={{
        width: 240,
        background: '#111827',
        borderRight: '1px solid #1E2D45',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1E2D45' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(0,212,255,0.15)',
            border: '1px solid rgba(0,212,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: "'Space Mono'", fontSize: 14, fontWeight: 700, color: '#00D4FF' }}>A</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 16, color: '#E8EAF0', letterSpacing: '-0.02em' }}>
              AURA
            </div>
            <div style={{
              fontSize: 10, color: '#4A5568', fontFamily: "'DM Sans'",
              marginTop: 1, display: 'flex', alignItems: 'center', gap: 4
            }}>
              <span style={{
                background: 'rgba(0,212,255,0.1)', color: '#00D4FF',
                padding: '0 4px', borderRadius: 3, fontSize: 9, fontFamily: "'Space Mono'"
              }}>v1.0</span>
              Urban Analytics
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            style={{ marginBottom: 2, borderRadius: 6 }}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Profile */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #1E2D45' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 8px', borderRadius: 8,
          marginBottom: 6,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(0,212,255,0.15)',
            border: '1px solid rgba(0,212,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Space Mono'", fontWeight: 700, fontSize: 12, color: '#00D4FF',
            flexShrink: 0,
          }}>
            {getInitials(user?.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#E8EAF0', truncate: true, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'User'}
            </div>
            <div style={{
              fontSize: 11, color: ROLE_COLORS[user?.role] || '#8892A4',
              textTransform: 'capitalize', fontFamily: "'Space Mono'",
            }}>
              {user?.role}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-ghost"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-start', fontSize: 13 }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
