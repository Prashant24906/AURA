import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';
import { useAlertContext } from '../../context/AlertContext';

const TYPE_COLORS = {
  fire: '#FF4757',
  garbage: '#FFA502',
  pothole: '#FFA502',
  parking: '#2ED573',
  traffic: '#00D4FF',
};

export default function Topbar({ title }) {
  const [time, setTime] = useState(new Date());
  const [showAlerts, setShowAlerts] = useState(false);
  const { alerts, unreadCount, markRead, markAllRead } = useAlertContext();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header style={{
      height: 60,
      background: '#111827',
      borderBottom: '1px solid #1E2D45',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
    }}>
      <h1 style={{ fontFamily: "'Space Mono'", fontSize: 16, fontWeight: 700, color: '#E8EAF0', letterSpacing: '-0.02em' }}>
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Live clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ED573' }} className="pulse-live" />
          <span style={{ fontFamily: "'Space Mono'", fontSize: 12, color: '#8892A4' }}>
            {format(time, 'HH:mm:ss')}
          </span>
          <span style={{ fontSize: 12, color: '#4A5568' }}>
            {format(time, 'dd MMM yyyy')}
          </span>
        </div>

        {/* Bell with badge */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="btn-ghost"
            style={{ padding: '6px 8px', position: 'relative' }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                background: '#FF4757', color: 'white',
                fontFamily: "'Space Mono'", fontSize: 9, fontWeight: 700,
                minWidth: 16, height: 16, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Alert dropdown */}
          {showAlerts && (
            <div style={{
              position: 'absolute', right: 0, top: 44,
              width: 340, background: '#111827',
              border: '1px solid #2A3F5F', borderRadius: 10,
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
              zIndex: 100, overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderBottom: '1px solid #1E2D45',
              }}>
                <span style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0' }}>
                  Alerts
                </span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{
                    fontSize: 11, color: '#00D4FF', background: 'none', border: 'none', cursor: 'pointer'
                  }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#4A5568', fontSize: 13 }}>
                    No alerts yet
                  </div>
                ) : (
                  alerts.slice(0, 20).map((a, i) => (
                    <div
                      key={a._id || i}
                      onClick={() => markRead(a._id)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #1E2D45',
                        cursor: 'pointer',
                        background: a.isRead ? 'transparent' : 'rgba(0,212,255,0.03)',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                        background: TYPE_COLORS[a.type] || '#8892A4',
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#E8EAF0', lineHeight: 1.4 }}>{a.message}</div>
                        {a.location && <div style={{ fontSize: 11, color: '#8892A4', marginTop: 2 }}>{a.location}</div>}
                      </div>
                      {!a.isRead && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4FF', flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close overlay for alert dropdown */}
      {showAlerts && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setShowAlerts(false)}
        />
      )}
    </header>
  );
}
