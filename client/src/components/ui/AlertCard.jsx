import { formatDistanceToNow } from 'date-fns';

const TYPE_CONFIG = {
  fire:    { color: '#FF4757', dot: '#FF4757', label: 'Fire' },
  garbage: { color: '#FFA502', dot: '#FFA502', label: 'Garbage' },
  pothole: { color: '#FFA502', dot: '#FFA502', label: 'Pothole' },
  parking: { color: '#2ED573', dot: '#2ED573', label: 'Parking' },
  traffic: { color: '#00D4FF', dot: '#00D4FF', label: 'Traffic' },
};

const STATUS_CONFIG = {
  open:        { color: '#FF4757', label: 'Open' },
  in_progress: { color: '#FFA502', label: 'In Progress' },
  resolved:    { color: '#2ED573', label: 'Resolved' },
  dismissed:   { color: '#4A5568', label: 'Dismissed' },
};

export default function AlertCard({ type, message, location, time, status, onClick }) {
  const typeConf = TYPE_CONFIG[type] || { color: '#8892A4', dot: '#8892A4', label: type };
  const statusConf = STATUS_CONFIG[status] || { color: '#8892A4', label: status };

  const timeAgo = time
    ? formatDistanceToNow(new Date(time), { addSuffix: true })
    : '';

  return (
    <div
      className="alert-card slide-in-right"
      onClick={onClick}
      style={{ borderLeft: `3px solid ${typeConf.color}` }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: typeConf.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: typeConf.color, fontFamily: "'Space Mono'", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {typeConf.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#E8EAF0', fontWeight: 500, lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {message}
          </div>
          {location && (
            <div style={{ fontSize: 11, color: '#8892A4' }}>{location}</div>
          )}
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusConf.color }} />
            <span style={{ fontSize: 10, color: statusConf.color }}>{statusConf.label}</span>
          </div>
          <span style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'" }}>{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}
