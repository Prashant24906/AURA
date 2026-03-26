import { useState, useEffect, useRef } from 'react';
import { Radio } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import LiveFeedCard from '../components/ui/LiveFeedCard';
import { useAlertContext } from '../context/AlertContext';
import { formatDistanceToNow } from 'date-fns';

const TYPE_COLORS = {
  fire: '#FF4757', garbage: '#FFA502', pothole: '#FFA502',
  parking: '#2ED573', traffic: '#00D4FF',
};

const CAMERAS = [
  { id: 'cam-01', zone: 'Zone A - North', cameraId: 'CAM-A01', modelType: 'fire' },
  { id: 'cam-02', zone: 'Zone B - South', cameraId: 'CAM-B01', modelType: 'garbage' },
  { id: 'cam-03', zone: 'Zone C - East', cameraId: 'CAM-C01', modelType: 'pothole' },
  { id: 'cam-04', zone: 'Zone D - West', cameraId: 'CAM-D01', modelType: 'parking' },
  { id: 'cam-05', zone: 'Zone E - Central', cameraId: 'CAM-E01', modelType: 'traffic' },
  { id: 'cam-06', zone: 'Zone A - North', cameraId: 'CAM-A02', modelType: 'fire' },
];

export default function LiveFeed() {
  const { alerts } = useAlertContext();
  const alertsEndRef = useRef(null);

  useEffect(() => {
    alertsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [alerts]);

  return (
    <PageWrapper title="Live Feed">
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 108px)' }}>
        {/* Camera grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {CAMERAS.map((cam) => (
              <LiveFeedCard key={cam.id} camera={cam} />
            ))}
          </div>
        </div>

        {/* Alerts sidebar */}
        <div style={{
          width: 300, flexShrink: 0,
          background: '#111827', border: '1px solid #1E2D45',
          borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #1E2D45',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Radio size={14} style={{ color: '#2ED573' }} className="pulse-live" />
            <span style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0' }}>
              Live Alerts
            </span>
            {alerts.length > 0 && (
              <span style={{
                marginLeft: 'auto', background: '#1C2333', color: '#8892A4',
                fontSize: 10, fontFamily: "'Space Mono'", padding: '2px 6px', borderRadius: 4,
              }}>
                {alerts.length}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Radio size={24} style={{ color: '#1E2D45', marginBottom: 8 }} />
                <div style={{ fontSize: 12, color: '#4A5568' }}>
                  Monitoring for incidents...
                </div>
              </div>
            ) : (
              <>
                {[...alerts].slice(0, 30).map((a, i) => (
                  <div
                    key={a._id || i}
                    className="slide-in-right"
                    style={{
                      display: 'flex', gap: 10, padding: '10px 8px',
                      borderBottom: '1px solid #1E2D45',
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                      background: TYPE_COLORS[a.type] || '#8892A4',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#E8EAF0', lineHeight: 1.4 }}>{a.message}</div>
                      <div style={{ fontSize: 10, color: '#4A5568', marginTop: 3, fontFamily: "'Space Mono'" }}>
                        {a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : 'just now'}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={alertsEndRef} />
              </>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
