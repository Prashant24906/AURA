import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload as UploadIcon, X, CheckCircle, AlertTriangle, Flame, Trash2, Construction, Car, TrafficCone } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import ConfidenceBar from '../components/ui/ConfidenceBar';
import { incidentService } from '../services/incidentService';

const TYPE_ICONS = { fire: Flame, garbage: Trash2, pothole: Construction, parking: Car, traffic: TrafficCone };
const TYPE_COLORS = { fire: '#FF4757', garbage: '#FFA502', pothole: '#FFA502', parking: '#2ED573', traffic: '#00D4FF' };

const MODEL_OPTIONS = [
  { value: 'all', label: 'All Models' },
  { value: 'fire', label: 'Fire Detection' },
  { value: 'garbage', label: 'Garbage Detection' },
  { value: 'pothole', label: 'Pothole Detection' },
  { value: 'parking', label: 'Parking Detection' },
  { value: 'traffic', label: 'Traffic Detection' },
];

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [model, setModel] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [creatingIncident, setCreatingIncident] = useState(null);
  const [createdFor, setCreatedFor] = useState(new Set());
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const [searchParams] = useSearchParams();

  // Auto-select model from ?model= query param (set by voice command)
  useEffect(() => {
    const qm = searchParams.get('model');
    if (qm && MODEL_OPTIONS.some(o => o.value === qm)) {
      setModel(qm);
    }
  }, [searchParams]);

  const handleFile = (f) => {
    if (!f) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(f.type)) {
      alert('Only .jpg, .jpeg, .png files are allowed');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResults(null);
    setCreatedFor(new Set());
    setProgress(0);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('zone', 'Manual Upload');

      setProgress(30);

      let res;
      if (model === 'all') {
        res = await incidentService.analyzeAll(formData);
      } else {
        res = await incidentService.analyzeSingle(model, formData);
        // normalize single result to array format
        const r = res.data.data.result;
        res = { data: { data: { results: [r], incidents: r.incident ? [r.incident] : [] } } };
      }

      setProgress(100);
      setResults(res.data.data);
    } catch (err) {
      console.error('Analysis failed:', err);
      alert(err.response?.data?.message || 'Analysis failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateIncident = async (modelKey, result) => {
    setCreatingIncident(modelKey);
    try {
      await incidentService.create({
        type: result.type || modelKey,
        severity: result.confidence >= 0.85 ? 'critical' : result.confidence >= 0.65 ? 'high' : result.confidence >= 0.45 ? 'medium' : 'low',
        detectionData: {
          confidence: result.confidence,
          label: result.label,
          bbox: result.bbox || [],
          modelName: result.model,
        },
        location: { address: 'Manual Upload', zone: 'Manual' },
        status: 'open',
      });
      setCreatedFor((prev) => new Set([...prev, modelKey]));
    } catch (err) {
      console.error('Create incident failed:', err);
    } finally {
      setCreatingIncident(null);
    }
  };

  const detectedResults = results?.results?.filter((r) => r.detected) || [];

  return (
    <PageWrapper title="Upload &amp; Analyze">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, height: 'calc(100vh - 108px)' }}>
        {/* Left — Upload panel */}
        <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono'", fontSize: 14, color: '#E8EAF0', marginBottom: 4 }}>
              Upload Image
            </div>
            <div style={{ fontSize: 13, color: '#8892A4' }}>
              Upload a city camera image for AI analysis
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#00D4FF' : '#1E2D45'}`,
              borderRadius: 10,
              minHeight: 200,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'border-color 0.2s ease, background 0.2s ease',
              background: dragOver ? 'rgba(0,212,255,0.04)' : 'transparent',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {preview ? (
              <>
                <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: 14, color: '#E8EAF0', marginBottom: 4 }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: '#8892A4' }}>{(file.size / 1024).toFixed(1)} KB — Click to change</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setResults(null); }}
                    style={{
                      marginTop: 10, background: '#FF4757', border: 'none', color: 'white',
                      borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <X size={12} /> Remove
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <UploadIcon size={40} style={{ color: dragOver ? '#00D4FF' : '#1E2D45', marginBottom: 12 }} />
                <div style={{ fontSize: 14, color: '#8892A4', marginBottom: 6 }}>
                  Drag & drop an image here
                </div>
                <div style={{ fontSize: 12, color: '#4A5568' }}>or click to browse — .jpg, .jpeg, .png</div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {/* Model selection */}
          <div>
            <div style={{ fontSize: 12, color: '#8892A4', marginBottom: 10, fontWeight: 500 }}>Select Model</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MODEL_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setModel(value)}
                  style={{
                    padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    border: `1px solid ${model === value ? '#00D4FF' : '#1E2D45'}`,
                    background: model === value ? 'rgba(0,212,255,0.1)' : 'transparent',
                    color: model === value ? '#00D4FF' : '#8892A4',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          {uploading && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#8892A4' }}>Analyzing...</span>
                <span style={{ fontFamily: "'Space Mono'", fontSize: 12, color: '#00D4FF' }}>{progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleAnalyze}
            disabled={!file || uploading}
            style={{ width: '100%', marginTop: 'auto' }}
          >
            {uploading ? 'Analyzing Image...' : 'Analyze Image'}
          </button>
        </div>

        {/* Right — Results panel */}
        <div className="panel" style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ fontFamily: "'Space Mono'", fontSize: 14, color: '#E8EAF0', marginBottom: 4 }}>
            Analysis Results
          </div>
          <div style={{ fontSize: 13, color: '#8892A4', marginBottom: 20 }}>
            AI detection output from the uploaded image
          </div>

          {!results ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <UploadIcon size={48} style={{ color: '#1E2D45', marginBottom: 16 }} />
              <div style={{ fontSize: 14, color: '#4A5568' }}>Awaiting analysis...</div>
              <div style={{ fontSize: 12, color: '#2A3F5F', marginTop: 6 }}>Upload an image and click Analyze</div>
            </div>
          ) : detectedResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <CheckCircle size={48} style={{ color: '#2ED573', marginBottom: 16 }} />
              <div style={{ fontSize: 16, color: '#2ED573', fontFamily: "'Space Mono'" }}>No threats detected</div>
              <div style={{ fontSize: 13, color: '#8892A4', marginTop: 8 }}>
                All {results.results?.length || 0} models returned clear
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {detectedResults.map((r, i) => {
                const Icon = TYPE_ICONS[r.type || r.model?.split('_')[0].toLowerCase()] || AlertTriangle;
                const typeKey = r.type || r.model?.split('_')[0].toLowerCase();
                const color = TYPE_COLORS[typeKey] || '#00D4FF';
                const alreadyCreated = createdFor.has(typeKey);
                return (
                  <div key={i} style={{
                    background: '#0A0E1A', border: `1px solid ${color}30`,
                    borderRadius: 10, padding: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: `${color}18`, border: `1px solid ${color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Space Mono'", fontSize: 13, color: '#E8EAF0', textTransform: 'capitalize' }}>
                          {r.type || typeKey} Detected
                        </div>
                        <div style={{ fontSize: 11, color: '#8892A4' }}>via {r.model}</div>
                      </div>
                    </div>
                    <ConfidenceBar value={r.confidence} label="Confidence" />
                    <div style={{ marginTop: 10, fontSize: 12, color: '#8892A4' }}>
                      Label: <span style={{ color: '#E8EAF0' }}>{r.label}</span>
                    </div>
                    {r.bbox?.length > 0 && (
                      <div style={{ fontSize: 12, color: '#8892A4', marginTop: 4 }}>
                        BBox: <span style={{ fontFamily: "'Space Mono'", fontSize: 11, color: '#4A5568' }}>
                          [{r.bbox.join(', ')}]
                        </span>
                      </div>
                    )}
                    <button
                      className={alreadyCreated ? 'btn-secondary' : 'btn-primary'}
                      onClick={() => !alreadyCreated && handleCreateIncident(typeKey, r)}
                      disabled={alreadyCreated || creatingIncident === typeKey}
                      style={{ width: '100%', marginTop: 12, fontSize: 12 }}
                    >
                      {alreadyCreated ? '✓ Incident Report Created' :
                        creatingIncident === typeKey ? 'Creating...' : 'Create Incident Report'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
