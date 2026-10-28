import React, { useState } from 'react';
import { api } from '../services/api';
import { Shield, Key, User, X, AlertCircle } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(username, password);
      localStorage.setItem('token', res.token);
      onLoginSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemo = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            <Shield size={20} color="var(--forest-green)" />
            Portal Sign In
          </h3>
          <button onClick={onClose} style={{ background: 'transparent' }}><X size={20} /></button>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-text)', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Username or Email</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or prof.patil"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>

        {/* Demo Fast Login Presets */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Quick Demo Credentials:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px' }}
              onClick={() => setDemo('admin', 'admin123')}
            >
              Dean / Admin
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px' }}
              onClick={() => setDemo('prof.patil', 'teacher123')}
            >
              Teacher (Patil)
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px' }}
              onClick={() => setDemo('prof.deshmukh', 'teacher123')}
            >
              GFM (Deshmukh)
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px' }}
              onClick={() => setDemo('prof.shinde', 'teacher123')}
            >
              Substitute (Shinde)
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px' }}
              onClick={() => setDemo('student.aarav', 'student123')}
            >
              Student (Safe 87%)
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px' }}
              onClick={() => setDemo('student.rohan', 'student123')}
            >
              Student (Low 50%)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
