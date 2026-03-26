import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0E1A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'linear-gradient(#00D4FF 1px, transparent 1px), linear-gradient(90deg, #00D4FF 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '30%', width: 400, height: 400,
        borderRadius: '50%', background: 'rgba(0,212,255,0.04)', filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        display: 'flex', width: '100%', maxWidth: 1000, gap: 40,
        alignItems: 'center', justifyContent: 'center', zIndex: 1,
      }} className="fade-in">
        {/* Left panel — Brand */}
        <div style={{ flex: 1, maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(0,212,255,0.12)',
              border: '1px solid rgba(0,212,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'Space Mono'", fontSize: 22, fontWeight: 700, color: '#00D4FF' }}>A</span>
            </div>
            <div>
              <div style={{ fontFamily: "'Space Mono'", fontSize: 28, fontWeight: 700, color: '#E8EAF0', letterSpacing: '-0.04em' }}>
                AURA
              </div>
              <div style={{ fontSize: 11, color: '#4A5568' }}>v1.0.0</div>
            </div>
          </div>

          <div>
            <div style={{ fontFamily: "'Space Mono'", fontSize: 18, color: '#00D4FF', marginBottom: 10, lineHeight: 1.4 }}>
              Urban Intelligence,<br />Automated.
            </div>
            <p style={{ fontSize: 14, color: '#8892A4', lineHeight: 1.7, maxWidth: 340 }}>
              AURA monitors city infrastructure in real time — detecting fires, road hazards,
              illegal parking, and traffic anomalies through AI-powered computer vision.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['5 AI Detection Models', 'Real-time Alerts', 'City-wide Coverage', 'Incident Response Tracking'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8892A4' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4FF', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — Login card */}
        <div style={{
          background: '#111827',
          border: '1px solid #2A3F5F',
          borderRadius: 14,
          padding: '40px 36px',
          width: '100%',
          maxWidth: 420,
          flexShrink: 0,
        }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 24, fontWeight: 500, color: '#E8EAF0', marginBottom: 6 }}>
              Welcome back
            </div>
            <div style={{ fontSize: 13, color: '#8892A4' }}>
              Sign in to access the AURA control center
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#8892A4', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@aura.city"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#8892A4', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#4A5568', padding: 0,
                  }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <a href="#" style={{ fontSize: 12, color: '#8892A4', textDecoration: 'none' }}
                onMouseEnter={(e) => e.target.style.color = '#00D4FF'}
                onMouseLeave={(e) => e.target.style.color = '#8892A4'}>
                Forgot password?
              </a>
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)',
                borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#FF4757',
              }}>
                {error}
              </div>
            )}

            <button id="signin-btn" type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? (
                <>
                  <Loader size={14} className="spin" />
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: '14px 16px', background: '#0A0E1A', borderRadius: 8, border: '1px solid #1E2D45' }}>
            <div style={{ fontSize: 11, color: '#4A5568', marginBottom: 6, fontFamily: "'Space Mono'" }}>DEMO CREDENTIALS</div>
            <div style={{ fontSize: 12, color: '#8892A4', lineHeight: 1.8 }}>
              <div>admin@aura.city / Admin@123</div>
              <div>operator1@aura.city / Operator@1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
