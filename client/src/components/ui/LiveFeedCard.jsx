import { useState } from 'react';
import { Camera, Loader, Zap } from 'lucide-react';
import DetectionBadge from '../ui/DetectionBadge';
import { incidentService } from '../../services/incidentService';
import { formatDistanceToNow } from 'date-fns';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function LiveFeedCard({ camera }) {
  const { id, zone, cameraId, imageUrl, lastDetection, lastScan } = camera;
  const [loading, setLoading] = useState(false);
  const [detection, setDetection] = useState(lastDetection || null);
  const [scanTime, setScanTime] = useState(lastScan || null);
  const [detected, setDetected] = useState(false);

  const handleScan = async () => {
    try {
      setLoading(true);
      setDetected(false);
      const formData = new FormData();
      const res = await incidentService.analyzeAll(formData);
      const results = res.data.data.results;
      const found = results.find((r) => r.detected);
      if (found) {
        setDetection({ type: found.type, confidence: found.confidence, label: found.label });
        setDetected(true);
      } else {
        setDetection(null);
      }
      setScanTime(new Date().toISOString());
    } catch {
      // Handle silently
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#111827',
      border: `1px solid ${detected ? '#FF4757' : '#1E2D45'}`,
      borderRadius: 10,
      overflow: 'hidden',
      transition: 'border-color 0.3s ease',
      animation: detected ? 'borderPulse 1s ease 3' : 'none',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid #1E2D45',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EAF0' }}>{zone}</div>
          <div style={{ fontSize: 11, color: '#8892A4', fontFamily: "'Space Mono'" }}>{cameraId}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2ED573' }} className="pulse-live" />
          <span style={{ fontSize: 10, color: '#2ED573', fontFamily: "'Space Mono'" }}>LIVE</span>
        </div>
      </div>

      {/* Image area */}
      <div style={{ position: 'relative', background: '#0A0E1A', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imageUrl ? (
          <img src={imageUrl} alt={zone} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <Camera size={36} style={{ color: '#1E2D45', marginBottom: 8 }} />
            <div style={{ fontSize: 11, color: '#4A5568' }}>No feed</div>
          </div>
        )}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(10,14,26,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Loader size={24} className="spin" style={{ color: '#00D4FF' }} />
          </div>
        )}
      </div>

      {/* Detection result */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1E2D45', minHeight: 42 }}>
        {detection ? (
          <DetectionBadge type={detection.type} confidence={detection.confidence} />
        ) : (
          <span style={{ fontSize: 12, color: '#4A5568' }}>No detection</span>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
        <span style={{ fontSize: 11, color: '#4A5568', fontFamily: "'Space Mono'" }}>
          {scanTime ? formatDistanceToNow(new Date(scanTime), { addSuffix: true }) : 'Never scanned'}
        </span>
        <button
          onClick={handleScan}
          disabled={loading}
          className="btn-primary"
          style={{ fontSize: 11, padding: '6px 12px', gap: 5 }}
        >
          <Zap size={12} />
          {loading ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>
    </div>
  );
}
