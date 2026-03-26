import { useEffect, useState } from 'react';

function getBarColor(value) {
  if (value > 0.8) return '#00D4FF';
  if (value >= 0.5) return '#FFA502';
  return '#FF4757';
}

export default function ConfidenceBar({ value = 0, color, label }) {
  const [width, setWidth] = useState(0);
  const barColor = color || getBarColor(value);
  const pct = Math.round((value || 0) * 100);

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 12, color: '#8892A4' }}>{label}</span>
          <span style={{ fontFamily: "'Space Mono'", fontSize: 12, color: barColor }}>{pct}%</span>
        </div>
      )}
      <div style={{ height: 6, background: '#1E2D45', borderRadius: 3, overflow: 'hidden' }}>
        <div
          className="confidence-bar-fill"
          style={{ width: `${width}%`, background: barColor }}
        />
      </div>
      {!label && (
        <div style={{ textAlign: 'right', marginTop: 3 }}>
          <span style={{ fontFamily: "'Space Mono'", fontSize: 11, color: barColor }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}
