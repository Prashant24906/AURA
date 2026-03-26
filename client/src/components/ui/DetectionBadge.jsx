const TYPE_CONFIG = {
  fire:    { color: '#FF4757', label: 'Fire' },
  garbage: { color: '#FFA502', label: 'Garbage' },
  pothole: { color: '#FFA502', label: 'Pothole' },
  parking: { color: '#2ED573', label: 'Parking' },
  traffic: { color: '#00D4FF', label: 'Traffic' },
};

export default function DetectionBadge({ type, confidence }) {
  const conf = TYPE_CONFIG[type] || { color: '#8892A4', label: type || 'Unknown' };
  const pct = confidence != null ? `${(confidence * 100).toFixed(1)}%` : '';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontFamily: "'DM Sans'", fontWeight: 500,
      color: conf.color, padding: '3px 8px',
      border: `1px solid ${conf.color}30`,
      borderRadius: 6, background: `${conf.color}10`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: conf.color, flexShrink: 0,
      }} />
      {conf.label}
      {pct && <span style={{ color: '#E8EAF0', fontFamily: "'Space Mono'", fontSize: 10 }}>{pct}</span>}
    </span>
  );
}
