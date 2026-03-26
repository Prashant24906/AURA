import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const TYPE_COLORS = {
  fire: '#FF4757',
  garbage: '#FFA502',
  pothole: '#E5B800',
  parking: '#2ED573',
  traffic: '#00D4FF',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1C2333', border: '1px solid #2A3F5F',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: '#8892A4', marginBottom: 6, fontFamily: "'Space Mono'", fontSize: 11 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, marginBottom: 2 }}>
          <span style={{ textTransform: 'capitalize' }}>{p.name}:</span>
          <span style={{ fontFamily: "'Space Mono'" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function IncidentTrendChart({ data = [] }) {
  // data: [{ date, fire, garbage, pothole, parking, traffic }, ...]
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#8892A4', fontSize: 10, fontFamily: "'Space Mono'" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#8892A4', fontSize: 10, fontFamily: "'Space Mono'" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span style={{ color: '#8892A4', fontSize: 11, textTransform: 'capitalize' }}>{value}</span>
          )}
        />
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <Line
            key={type}
            type="monotone"
            dataKey={type}
            name={type}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
