import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({ title, value, change, color, icon: Icon }) {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {Icon && <Icon size={18} style={{ color }} />}
        </div>
        <span style={{ fontSize: 11, color: '#4A5568', fontFamily: "'Space Mono'" }}>TODAY</span>
      </div>

      <div className="metric-number" style={{ fontSize: 36, color, lineHeight: 1, marginBottom: 6 }}>
        {value ?? '—'}
      </div>

      <div style={{ fontSize: 12, color: '#8892A4', marginBottom: 8 }}>{title}</div>

      {typeof change === 'number' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
          color: isPositive ? '#FF4757' : isNegative ? '#2ED573' : '#8892A4',
        }}>
          {isPositive ? <TrendingUp size={12} /> : isNegative ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span style={{ fontFamily: "'Space Mono'" }}>
            {isPositive ? '+' : ''}{change}%
          </span>
          <span style={{ color: '#4A5568' }}>vs yesterday</span>
        </div>
      )}
    </div>
  );
}
