import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const TYPE_COLORS = {
  fire: '#FF4757',
  garbage: '#FFA502',
  pothole: '#E5B800',
  parking: '#2ED573',
  traffic: '#00D4FF',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1C2333', border: '1px solid #2A3F5F',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ color: '#E8EAF0' }}>
        {(payload[0].payload.type || payload[0].name)}: <span style={{ fontFamily: "'Space Mono'", color: '#00D4FF' }}>
          {(payload[0].value * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

// Bar chart version (used on dashboard)
export function ModelPerformanceBarChart({ data = [] }) {
  return (
    <div style={{ width: '100%' }}>
      {data.map((item) => {
        const color = TYPE_COLORS[item.type] || '#8892A4';
        const pct = Math.round((item.avgConfidence || 0) * 100);
        return (
          <div key={item.type} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#8892A4', textTransform: 'capitalize' }}>
                {item.type} Model
              </span>
              <span style={{ fontFamily: "'Space Mono'", fontSize: 12, color }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 6, background: '#1E2D45', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`, background: color,
                borderRadius: 3, transition: 'width 1s ease-out',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Radar chart version (used on analytics page)
export default function ModelPerformanceChart({ data = [] }) {
  const radarData = data.map((d) => ({
    type: d.type?.charAt(0).toUpperCase() + d.type?.slice(1) || d._id,
    confidence: d.avgConfidence || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={radarData}>
        <PolarGrid stroke="#1E2D45" />
        <PolarAngleAxis
          dataKey="type"
          tick={{ fill: '#8892A4', fontSize: 11, fontFamily: "'DM Sans'" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 1]}
          tick={{ fill: '#4A5568', fontSize: 9 }}
          tickCount={4}
        />
        <Radar
          name="Confidence"
          dataKey="confidence"
          stroke="#00D4FF"
          fill="#00D4FF"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
