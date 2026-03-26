import { useState, useEffect } from 'react';
import { User, Users, Bell, Key, Copy, RefreshCw } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import { useAuth } from '../hooks/useAuth';
import { incidentService } from '../services/incidentService';
import { authService } from '../services/authService';
import { format } from 'date-fns';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'apikeys', label: 'API Keys', icon: Key },
];

const NOTIFICATION_TYPES = [
  { key: 'fire', label: 'Fire Alerts' },
  { key: 'garbage', label: 'Garbage Alerts' },
  { key: 'pothole', label: 'Pothole Alerts' },
  { key: 'parking', label: 'Parking Alerts' },
  { key: 'traffic', label: 'Traffic Alerts' },
];

function Toggle({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`toggle-switch ${on ? 'on' : ''}`}
    />
  );
}

function ProfileTab({ user, onUpdate }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', department: user?.department || '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authService.updateProfile(form);
      onUpdate(res.data.data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(0,212,255,0.15)', border: '2px solid rgba(0,212,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Space Mono'", fontSize: 20, fontWeight: 700, color: '#00D4FF',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#E8EAF0' }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: '#8892A4', textTransform: 'capitalize' }}>{user?.role}</div>
        </div>
      </div>

      {['name', 'email', 'department'].map((field) => (
        <div key={field} style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#8892A4', display: 'block', marginBottom: 6, textTransform: 'capitalize', fontWeight: 500 }}>
            {field === 'department' ? 'Department' : field.charAt(0).toUpperCase() + field.slice(1)}
          </label>
          <input
            className="input-field"
            value={form[field]}
            onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
            type={field === 'email' ? 'email' : 'text'}
          />
        </div>
      ))}

      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function TeamTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    incidentService.getUsers()
      .then((res) => setUsers(res.data.data.users))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (id, role) => {
    try {
      await incidentService.updateUser(id, { role });
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, role } : u)));
    } catch (err) { console.error(err); }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await incidentService.updateUser(id, { isActive: !isActive });
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, isActive: !isActive } : u)));
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ color: '#4A5568' }}>Loading team...</div>;

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1E2D45' }}>
            {['Name', 'Email', 'Role', 'Last Login', 'Status', 'Actions'].map((h) => (
              <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="table-row">
              <td style={{ padding: '12px 14px', fontSize: 13, color: '#E8EAF0' }}>{u.name}</td>
              <td style={{ padding: '12px 14px', fontSize: 12, color: '#8892A4' }}>{u.email}</td>
              <td style={{ padding: '12px 14px' }}>
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u._id, e.target.value)}
                  className="select-field"
                  style={{ padding: '4px 8px' }}
                >
                  <option value="admin">admin</option>
                  <option value="operator">operator</option>
                  <option value="viewer">viewer</option>
                </select>
              </td>
              <td style={{ padding: '12px 14px', fontSize: 12, color: '#8892A4' }}>
                {u.lastLogin ? format(new Date(u.lastLogin), 'dd MMM HH:mm') : 'Never'}
              </td>
              <td style={{ padding: '12px 14px' }}>
                <span style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 6,
                  color: u.isActive ? '#2ED573' : '#4A5568',
                  background: u.isActive ? 'rgba(46,213,115,0.1)' : 'rgba(74,85,104,0.1)',
                  border: `1px solid ${u.isActive ? '#2ED57330' : '#4A556830'}`,
                }}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={{ padding: '12px 14px' }}>
                <button
                  onClick={() => handleToggleActive(u._id, u.isActive)}
                  className="btn-ghost"
                  style={{ fontSize: 12, color: u.isActive ? '#FF4757' : '#2ED573' }}
                >
                  {u.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotificationsTab() {
  const [inApp, setInApp] = useState({ fire: true, garbage: true, pothole: true, parking: true, traffic: true });
  const [email, setEmail] = useState({ fire: false, garbage: false, pothole: false, parking: true, traffic: false });

  return (
    <div style={{ maxWidth: 500 }}>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 14 }}>
          In-App Notifications
        </div>
        {NOTIFICATION_TYPES.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1E2D45' }}>
            <span style={{ fontSize: 13, color: '#E8EAF0' }}>{label}</span>
            <Toggle on={inApp[key]} onToggle={() => setInApp((p) => ({ ...p, [key]: !p[key] }))} />
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 14 }}>
          Email Notifications
        </div>
        {NOTIFICATION_TYPES.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1E2D45' }}>
            <span style={{ fontSize: 13, color: '#E8EAF0' }}>{label}</span>
            <Toggle on={email[key]} onToggle={() => setEmail((p) => ({ ...p, [key]: !p[key] }))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiKey] = useState('aura_sk_' + Math.random().toString(36).slice(2, 18).toUpperCase());

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: 540 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 4 }}>
          Production API Key
        </div>
        <div style={{ fontSize: 12, color: '#8892A4', marginBottom: 16 }}>
          Use this key to authenticate external integrations with AURA API
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{
            flex: 1, background: '#0A0E1A', border: '1px solid #1E2D45',
            borderRadius: 6, padding: '10px 14px',
            fontFamily: "'Space Mono'", fontSize: 12, color: '#8892A4',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {apiKey.slice(0, 8)}{'•'.repeat(24)}{apiKey.slice(-4)}
          </div>
          <button className="btn-secondary" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0 }}>
            <Copy size={13} />{copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {!showConfirm ? (
          <button
            className="btn-ghost"
            onClick={() => setShowConfirm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#FF4757' }}
          >
            <RefreshCw size={14} /> Regenerate Key
          </button>
        ) : (
          <div style={{
            background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)',
            borderRadius: 8, padding: 14,
          }}>
            <div style={{ fontSize: 13, color: '#FF4757', marginBottom: 10 }}>
              Are you sure? This will invalidate the current key.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ background: '#FF4757', fontSize: 12, padding: '8px 14px' }}
                onClick={() => setShowConfirm(false)}>
                Yes, Regenerate
              </button>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const { user, updateUser } = useAuth();

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab user={user} onUpdate={updateUser} />;
      case 'team': return user?.role === 'admin' ? <TeamTab /> : (
        <div style={{ color: '#4A5568', fontSize: 14 }}>Admin access required to manage team.</div>
      );
      case 'notifications': return <NotificationsTab />;
      case 'apikeys': return <ApiKeysTab />;
      default: return null;
    }
  };

  return (
    <PageWrapper title="Settings">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1E2D45', marginBottom: 24 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`tab-btn ${activeTab === id ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {renderTab()}
    </PageWrapper>
  );
}
