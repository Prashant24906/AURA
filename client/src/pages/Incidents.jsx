import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Download, X, ChevronLeft, ChevronRight, Flame, Trash2, Construction, Car, TrafficCone } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import DetectionBadge from '../components/ui/DetectionBadge';
import { incidentService } from '../services/incidentService';
import { format } from 'date-fns';

const TYPE_ICONS = { fire: Flame, garbage: Trash2, pothole: Construction, parking: Car, traffic: TrafficCone };
const TYPE_COLORS = { fire: '#FF4757', garbage: '#FFA502', pothole: '#FFA502', parking: '#2ED573', traffic: '#00D4FF' };
const SEVERITY_COLORS = { critical: '#FF4757', high: '#FFA502', medium: '#E5B800', low: '#8892A4' };
const STATUS_COLORS = { open: '#FF4757', in_progress: '#FFA502', resolved: '#2ED573', dismissed: '#4A5568' };
const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', dismissed: 'Dismissed' };

function Badge({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, color, padding: '3px 8px', borderRadius: 6,
      border: `1px solid ${color}30`, background: `${color}10`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

function IncidentModal({ incident, onClose, onUpdate }) {
  const [status, setStatus] = useState(incident.status);
  const [notes, setNotes] = useState(incident.notes || '');
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  const drawBbox = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !incident.detectionData?.bbox?.length) return;
    const { naturalWidth, naturalHeight, width, height } = img;
    canvas.width = width;
    canvas.height = height;
    const scaleX = width / (naturalWidth || width);
    const scaleY = height / (naturalHeight || height);
    const [x, y, w, h] = incident.detectionData.bbox;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = TYPE_COLORS[incident.type] || '#00D4FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);
    ctx.fillStyle = (TYPE_COLORS[incident.type] || '#00D4FF') + '22';
    ctx.fillRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);
  }, [incident]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await incidentService.updateStatus(incident._id, { status, notes });
      onUpdate(res.data.data.incident);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const imageUrl = incident.imageUrl
    ? (incident.imageUrl.startsWith('http') ? incident.imageUrl : `${API_BASE}${incident.imageUrl}`)
    : null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content fade-in">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #1E2D45' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Space Mono'", fontSize: 14, color: '#E8EAF0' }}>
              Incident #{incident._id?.slice(-6)?.toUpperCase()}
            </span>
            <DetectionBadge type={incident.type} confidence={incident.detectionData?.confidence} />
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {/* Left — Image */}
          <div style={{ padding: 24, borderRight: '1px solid #1E2D45' }}>
            <div style={{ position: 'relative', background: '#0A0E1A', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
              {imageUrl ? (
                <>
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="Incident"
                    style={{ width: '100%', display: 'block', borderRadius: 8 }}
                    onLoad={drawBbox}
                  />
                  <canvas
                    ref={canvasRef}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  />
                </>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A5568' }}>
                  No image available
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Type', incident.type],
                ['Severity', incident.severity],
                ['Zone', incident.location?.zone],
                ['Confidence', incident.detectionData?.confidence != null ? `${(incident.detectionData.confidence * 100).toFixed(1)}%` : 'N/A'],
                ['Label', incident.detectionData?.label],
                ['Model', incident.detectionData?.modelName?.replace('_Detection_Model', '')],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 3 }}>{k.toUpperCase()}</div>
                  <div style={{ fontSize: 13, color: '#E8EAF0', textTransform: 'capitalize' }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            {incident.detectionData?.bbox?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 3 }}>BBOX [x, y, w, h]</div>
                <div style={{ fontSize: 12, color: '#8892A4', fontFamily: "'Space Mono'" }}>
                  [{incident.detectionData.bbox.join(', ')}]
                </div>
              </div>
            )}
          </div>

          {/* Right — Metadata */}
          <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 6 }}>UPDATE STATUS</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="select-field"
                style={{ width: '100%' }}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 6 }}>NOTES</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field"
                rows={4}
                placeholder="Add notes about this incident..."
                style={{ resize: 'vertical', fontFamily: "'DM Sans'" }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 4 }}>REPORTED</div>
                <div style={{ fontSize: 12, color: '#8892A4' }}>
                  {incident.createdAt ? format(new Date(incident.createdAt), 'dd MMM yyyy HH:mm') : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 4 }}>REPORTED BY</div>
                <div style={{ fontSize: 12, color: '#8892A4' }}>{incident.reportedBy?.name || 'System'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 4 }}>ADDRESS</div>
                <div style={{ fontSize: 12, color: '#8892A4' }}>{incident.location?.address || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 4 }}>ASSIGNED TO</div>
                <div style={{ fontSize: 12, color: '#8892A4' }}>{incident.assignedTo?.name || 'Unassigned'}</div>
              </div>
              {incident.resolvedAt && (
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", marginBottom: 4 }}>RESOLVED AT</div>
                  <div style={{ fontSize: 12, color: '#2ED573' }}>
                    {format(new Date(incident.resolvedAt), 'dd MMM yyyy HH:mm')}
                  </div>
                </div>
              )}
            </div>

            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ type: '', status: '', severity: '', zone: '', search: '' });
  const [page, setPage] = useState(1);

  const fetchIncidents = async (f = filters, p = page) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20, ...f };
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      const res = await incidentService.getAll(params);
      setIncidents(res.data.data.incidents);
      setPagination(res.data.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, []);

  const handleFilter = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPage(1);
    fetchIncidents(next, 1);
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchIncidents(filters, p);
  };

  const exportCSV = () => {
    const headers = ['ID', 'Type', 'Severity', 'Zone', 'Status', 'Confidence', 'Reported At'];
    const rows = incidents.map((i) => [
      i._id, i.type, i.severity, i.location?.zone, i.status,
      i.detectionData?.confidence?.toFixed(3), format(new Date(i.createdAt), 'dd/MM/yyyy HH:mm'),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'aura_incidents.csv'; a.click();
  };

  return (
    <PageWrapper title="Incidents">
      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4A5568' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 32 }}
            placeholder="Search location, label..."
            value={filters.search}
            onChange={(e) => handleFilter('search', e.target.value)}
          />
        </div>
        {[
          { key: 'type', opts: ['fire', 'garbage', 'pothole', 'parking', 'traffic'] },
          { key: 'status', opts: ['open', 'in_progress', 'resolved', 'dismissed'] },
          { key: 'severity', opts: ['low', 'medium', 'high', 'critical'] },
        ].map(({ key, opts }) => (
          <select key={key} className="select-field" value={filters[key]} onChange={(e) => handleFilter(key, e.target.value)}>
            <option value="">All {key}s</option>
            {opts.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
          </select>
        ))}
        <button onClick={exportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1E2D45' }}>
              {['ID', 'Type', 'Severity', 'Location', 'Status', 'Confidence', 'Reported At', 'Assigned To', 'Actions'].map((h) => (
                <th key={h} style={{
                  padding: '12px 14px', textAlign: 'left',
                  fontSize: 10, color: '#4A5568', fontFamily: "'Space Mono'", fontWeight: 400,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#4A5568' }}>Loading incidents...</td></tr>
            ) : incidents.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#4A5568' }}>No incidents found</td></tr>
            ) : (
              incidents.map((inc) => {
                const Icon = TYPE_ICONS[inc.type] || Flame;
                return (
                  <tr key={inc._id} className="table-row">
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#4A5568', fontFamily: "'Space Mono'" }}>
                      #{inc._id?.slice(-6)?.toUpperCase()}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon size={14} style={{ color: TYPE_COLORS[inc.type] }} />
                        <span style={{ fontSize: 13, color: '#E8EAF0', textTransform: 'capitalize' }}>{inc.type}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge label={inc.severity} color={SEVERITY_COLORS[inc.severity] || '#8892A4'} />
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#8892A4', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.location?.zone || '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge label={STATUS_LABELS[inc.status] || inc.status} color={STATUS_COLORS[inc.status] || '#8892A4'} />
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: "'Space Mono'", fontSize: 12, color: '#00D4FF' }}>
                      {inc.detectionData?.confidence != null ? `${(inc.detectionData.confidence * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#8892A4' }}>
                      {inc.createdAt ? format(new Date(inc.createdAt), 'dd MMM HH:mm') : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#8892A4' }}>
                      {inc.assignedTo?.name || 'Unassigned'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: '5px 10px', color: '#00D4FF' }}
                        onClick={() => setSelected(inc)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" onClick={() => handlePageChange(page - 1)} disabled={page === 1} style={{ padding: '6px 10px' }}>
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => handlePageChange(p)}
              className={page === p ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '6px 12px', fontSize: 13, minWidth: 36 }}
            >
              {p}
            </button>
          ))}
          <button className="btn-ghost" onClick={() => handlePageChange(page + 1)} disabled={page === pagination.pages} style={{ padding: '6px 10px' }}>
            <ChevronRight size={16} />
          </button>
          <span style={{ fontSize: 12, color: '#4A5568' }}>
            {pagination.total} total
          </span>
        </div>
      )}

      {/* Incident modal */}
      {selected && (
        <IncidentModal
          incident={selected}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => {
            setIncidents((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
            setSelected(updated);
          }}
        />
      )}
    </PageWrapper>
  );
}
