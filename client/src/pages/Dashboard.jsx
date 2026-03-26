import { useState, useEffect } from 'react';
import { Flame, Trash2, Construction, Car, TrafficCone } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import StatCard from '../components/ui/StatCard';
import AlertCard from '../components/ui/AlertCard';
import IncidentTrendChart from '../components/charts/IncidentTrendChart';
import { ModelPerformanceBarChart } from '../components/charts/ModelPerformanceChart';
import { incidentService } from '../services/incidentService';
import { useAlertContext } from '../context/AlertContext';
import { format, subDays } from 'date-fns';

const TYPE_ICONS = {
  fire: Flame, garbage: Trash2, pothole: Construction,
  parking: Car, traffic: TrafficCone,
};
const TYPE_COLORS = {
  fire: '#FF4757', garbage: '#FFA502', pothole: '#FFA502',
  parking: '#2ED573', traffic: '#00D4FF',
};

function buildTrendData(trends) {
  const map = {};
  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'MMM dd'));
  last7.forEach((d) => { map[d] = { date: d, fire: 0, garbage: 0, pothole: 0, parking: 0, traffic: 0 }; });
  trends.forEach(({ _id }) => {
    const key = format(new Date(_id.date), 'MMM dd');
    if (map[key] && _id.type) map[key][_id.type] = (map[key][_id.type] || 0) + 1;
  });
  return Object.values(map);
}

const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'dismissed'];
const STATUS_COLORS = { open: '#FF4757', in_progress: '#FFA502', resolved: '#2ED573', dismissed: '#4A5568' };
const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', dismissed: 'Dismissed' };

// Resolution ring
function ResolutionRing({ resolved = 0, total = 0 }) {
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const r = 45, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E2D45" strokeWidth={8} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#00D4FF" strokeWidth={8}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
        <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "'Space Mono'", fontSize: 20, fill: '#E8EAF0', fontWeight: 700 }}>
          {pct}%
        </text>
      </svg>
      <div style={{ fontSize: 12, color: '#8892A4', textAlign: 'center' }}>
        {resolved} / {total} resolved today
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [zones, setZones] = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const { alerts, setInitialAlerts } = useAlertContext();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sumRes, trendRes, perfRes, zoneRes, incRes, alertRes] = await Promise.all([
          incidentService.getSummary(),
          incidentService.getTrends({ days: 7 }),
          incidentService.getModelPerformance(),
          incidentService.getByZone(),
          incidentService.getAll({ limit: 8, page: 1 }),
          incidentService.getAlerts(),
        ]);
        setSummary(sumRes.data.data);
        setTrends(buildTrendData(trendRes.data.data.trends || []));
        setPerformance(perfRes.data.data.performance || []);
        setZones(zoneRes.data.data.zones || []);
        setRecentIncidents(incRes.data.data.incidents || []);
        setInitialAlerts(alertRes.data.data.alerts || []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      }
    };
    fetchAll();
  }, []);

  const STAT_CARDS = [
    { key: 'fire', title: 'Fire Incidents', icon: Flame, color: '#FF4757' },
    { key: 'garbage', title: 'Garbage Dumps', icon: Trash2, color: '#FFA502' },
    { key: 'pothole', title: 'Potholes Found', icon: Construction, color: '#FFA502' },
    { key: 'parking', title: 'Illegal Parking', icon: Car, color: '#2ED573' },
    { key: 'traffic', title: 'Traffic Alerts', icon: TrafficCone, color: '#00D4FF' },
  ];

  function getChange(type) {
    const today = summary?.todayByType?.[type] || 0;
    const yesterday = summary?.yesterdayByType?.[type] || 0;
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  }

  // Group zones for top-5
  const zoneAgg = {};
  zones.forEach(({ _id, count }) => {
    if (!_id.zone) return;
    if (!zoneAgg[_id.zone]) zoneAgg[_id.zone] = { zone: _id.zone, total: 0, critical: 0, high: 0 };
    zoneAgg[_id.zone].total += count;
  });
  const topZones = Object.values(zoneAgg).sort((a, b) => b.total - a.total).slice(0, 5);

  // Resolution stats today
  const resolvedToday = summary?.byStatus?.resolved || 0;
  const totalToday = Object.values(summary?.todayByType || {}).reduce((a, b) => a + b, 0);

  return (
    <PageWrapper title="Dashboard">
      {/* Stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 14, marginBottom: 20,
      }}>
        {STAT_CARDS.map(({ key, title, icon, color }) => (
          <StatCard
            key={key}
            title={title}
            value={summary?.todayByType?.[key] ?? 0}
            change={getChange(key)}
            color={color}
            icon={icon}
          />
        ))}
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 20 }}>
        {/* Trend chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 2 }}>
              Incident Trend
            </div>
            <div style={{ fontSize: 12, color: '#8892A4' }}>Last 7 days by detection type</div>
          </div>
          <IncidentTrendChart data={trends} />
        </div>

        {/* Recent alerts feed */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 2 }}>
                Recent Alerts
              </div>
              <div style={{ fontSize: 12, color: '#8892A4' }}>Live incident feed</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
            {recentIncidents.length === 0 ? (
              <div style={{ color: '#4A5568', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No recent incidents
              </div>
            ) : (
              recentIncidents.map((inc) => (
                <AlertCard
                  key={inc._id}
                  type={inc.type}
                  message={`${inc.type?.charAt(0).toUpperCase() + inc.type?.slice(1)} detected — ${(inc.detectionData?.confidence * 100)?.toFixed(1) || 0}% confidence`}
                  location={inc.location?.zone}
                  time={inc.createdAt}
                  status={inc.status}
                  onClick={() => setSelectedIncident(inc)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {/* Model confidence */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 2 }}>Model Confidence</div>
            <div style={{ fontSize: 12, color: '#8892A4' }}>Average per model</div>
          </div>
          <ModelPerformanceBarChart data={performance} />
        </div>

        {/* Zone activity */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 2 }}>Zone Activity</div>
            <div style={{ fontSize: 12, color: '#8892A4' }}>Top 5 zones by incidents</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", paddingBottom: 8 }}>ZONE</th>
                <th style={{ textAlign: 'right', fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", paddingBottom: 8 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {topZones.map((z, i) => (
                <tr key={z.zone} className="table-row">
                  <td style={{ padding: '8px 0', fontSize: 12, color: '#E8EAF0' }}>{z.zone}</td>
                  <td style={{ padding: '8px 0', fontSize: 12, color: '#00D4FF', fontFamily: "'Space Mono'", textAlign: 'right' }}>{z.total}</td>
                </tr>
              ))}
              {topZones.length === 0 && (
                <tr><td colSpan={2} style={{ color: '#4A5568', fontSize: 12, padding: '12px 0' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Resolution rate */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', marginBottom: 2 }}>Resolution Rate</div>
            <div style={{ fontSize: 12, color: '#8892A4' }}>Incidents resolved today</div>
          </div>
          <ResolutionRing resolved={resolvedToday} total={Math.max(totalToday, resolvedToday)} />
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {STATUS_ORDER.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8892A4' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[s] }} />
                {STATUS_LABELS[s]}: <span style={{ color: '#E8EAF0', fontFamily: "'Space Mono'" }}>{summary?.byStatus?.[s] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
