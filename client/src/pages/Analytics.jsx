import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import PageWrapper from '../components/layout/PageWrapper';
import ModelPerformanceChart from '../components/charts/ModelPerformanceChart';
import HeatmapPlaceholder from '../components/charts/HeatmapPlaceholder';
import { incidentService } from '../services/incidentService';
import { format, subDays } from 'date-fns';
import { Download } from 'lucide-react';

const TYPE_COLORS = { fire: '#FF4757', garbage: '#FFA502', pothole: '#E5B800', parking: '#2ED573', traffic: '#00D4FF' };
const SEVERITY_COLORS = { critical: '#FF4757', high: '#FFA502', medium: '#E5B800', low: '#8892A4' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1C2333', border: '1px solid #2A3F5F',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
    }}>
      {label && <div style={{ color: '#8892A4', marginBottom: 6, fontSize: 11, fontFamily: "'Space Mono'" }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color || '#E8EAF0', marginBottom: 2 }}>
          {p.name}: <span style={{ fontFamily: "'Space Mono'" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#8892A4' }}>{subtitle}</div>}
        </div>
        <button className="btn-ghost" style={{ padding: '4px 8px' }}><Download size={14} /></button>
      </div>
      {children}
    </div>
  );
}

function buildAreaData(trends, days) {
  const map = {};
  const dates = Array.from({ length: days }, (_, i) =>
    format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd')
  );
  dates.forEach((d) => { map[d] = { date: format(new Date(d), 'MMM dd'), fire: 0, garbage: 0, pothole: 0, parking: 0, traffic: 0 }; });
  (trends || []).forEach(({ _id }) => {
    const key = _id.date;
    if (map[key] && _id.type) map[key][_id.type] = (map[key][_id.type] || 0) + 1;
  });
  return Object.values(map);
}

export default function Analytics() {
  const [range, setRange] = useState(30);
  const [trends, setTrends] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [resolution, setResolution] = useState([]);
  const [summary, setSummary] = useState(null);
  const [zones, setZones] = useState([]);

  const fetchData = async (days = range) => {
    try {
      const [trendRes, perfRes, resRes, sumRes, zoneRes] = await Promise.all([
        incidentService.getTrends({ days }),
        incidentService.getModelPerformance(),
        incidentService.getResolutionTime(),
        incidentService.getSummary(),
        incidentService.getByZone(),
      ]);
      setTrends(buildAreaData(trendRes.data.data.trends, days));
      setPerformance(perfRes.data.data.performance || []);
      setResolution(resRes.data.data.resolution || []);
      setSummary(sumRes.data.data);
      setZones(zoneRes.data.data.zones || []);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRangeChange = (days) => {
    setRange(days);
    fetchData(days);
  };

  // Pie chart data
  const pieData = Object.entries(summary?.byType || {}).map(([type, count]) => ({
    name: type, value: count, color: TYPE_COLORS[type] || '#8892A4',
  }));

  // Severity bar data
  const severityData = Object.entries(summary?.bySeverity || {}).map(([severity, count]) => ({
    severity, count, color: SEVERITY_COLORS[severity] || '#8892A4',
  }));

  // Resolution bar data
  const resolutionData = resolution.map((r) => ({
    type: r._id, hours: parseFloat((r.avgHours || 0).toFixed(1)),
    color: TYPE_COLORS[r._id] || '#8892A4',
  }));

  // Zone heatmap data
  const zoneMap = {};
  zones.forEach(({ _id, count }) => {
    if (!_id.zone) return;
    zoneMap[_id.zone] = (zoneMap[_id.zone] || 0) + count;
  });
  const heatmapData = Object.entries(zoneMap).map(([zone, count]) => ({ zone, count }));

  return (
    <PageWrapper title="Analytics">
      {/* Date range selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#8892A4', marginRight: 4 }}>Time Range:</span>
        {[
          { label: 'Last 7 days', days: 7 },
          { label: 'Last 30 days', days: 30 },
          { label: 'Last 90 days', days: 90 },
        ].map(({ label, days }) => (
          <button
            key={days}
            onClick={() => handleRangeChange(days)}
            className={range === days ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* 1. Incidents Over Time — Area chart */}
        <ChartPanel title="Incidents Over Time" subtitle={`Stacked area — last ${range} days`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trends} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8892A4', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#8892A4', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <Area key={type} type="monotone" dataKey={type} name={type} stroke={color}
                  fill={`${color}18`} strokeWidth={2} stackId="1" />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* 2. Type Distribution — Donut */}
        <ChartPanel title="Type Distribution" subtitle="Incidents by detection category">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                paddingAngle={3} dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#8892A4', fontSize: 11, textTransform: 'capitalize' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* 3. Severity Breakdown — Bar */}
        <ChartPanel title="Severity Breakdown" subtitle="Incident count by severity level">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={severityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" vertical={false} />
              <XAxis dataKey="severity" tick={{ fill: '#8892A4', fontSize: 11, textTransform: 'capitalize' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8892A4', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]}>
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* 4. Model Confidence — Radar */}
        <ChartPanel title="Model Confidence" subtitle="Average detection confidence per model">
          <ModelPerformanceChart data={performance} />
        </ChartPanel>

        {/* 5. Avg Resolution Time — Horizontal bar */}
        <ChartPanel title="Avg Resolution Time" subtitle="Hours to resolve by incident type">
          <div style={{ paddingTop: 8 }}>
            {resolutionData.length === 0 ? (
              <div style={{ color: '#4A5568', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No resolved incidents yet
              </div>
            ) : (
              resolutionData.map(({ type, hours, color }) => (
                <div key={type} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#8892A4', textTransform: 'capitalize' }}>{type}</span>
                    <span style={{ fontFamily: "'Space Mono'", fontSize: 12, color }}>{hours}h</span>
                  </div>
                  <div style={{ height: 6, background: '#1E2D45', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min((hours / 48) * 100, 100)}%`,
                      background: color, borderRadius: 3,
                    }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </ChartPanel>

        {/* 6. Zone Heatmap */}
        <ChartPanel title="Zone Heatmap" subtitle="Incident density by area (cyan = more incidents)">
          <HeatmapPlaceholder data={heatmapData} />
        </ChartPanel>
      </div>
    </PageWrapper>
  );
}
