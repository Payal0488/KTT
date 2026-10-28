import React, { useState } from 'react';
import { api } from '../services/api';
import {
  Shield, User, Lock, Mail, Phone, BookOpen, GraduationCap,
  CheckCircle, AlertCircle, RefreshCw, KeyRound, ArrowRight
} from 'lucide-react';

export default function AuthPortal({ onLoginSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Login Form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Student Registration Form
  const [regData, setRegData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    phone: '',
    rollNumber: '',
    prn: '',
    className: '',
    departmentId: '1',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianRelation: 'Father'
  });

  // Password Reset Form
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [stepReset, setStepReset] = useState(1);

  // Labeled Demo Credentials for Testing
  const demoPresets = [
    { label: 'Admin (Dr. Kulkarni)', u: 'admin', p: 'admin123', role: 'admin' },
    { label: 'Regular Teacher (Prof. Patil)', u: 'prof.patil', p: 'teacher123', role: 'teacher' },
    { label: 'GFM / Class Teacher (Prof. Deshmukh)', u: 'prof.deshmukh', p: 'teacher123', role: 'teacher' },
    { label: 'Substitute Teacher (Prof. Shinde)', u: 'prof.shinde', p: 'teacher123', role: 'teacher' },
    { label: 'Student (Aarav - Safe 87%)', u: 'student.aarav', p: 'student123', role: 'student' },
    { label: 'Student (Rohan - Low 50%)', u: 'student.rohan', p: 'student123', role: 'student' }
  ];

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.login(loginUsername, loginPassword);
      localStorage.setItem('token', res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.registerStudent(regData);
      localStorage.setItem('token', res.token);
      setSuccessMsg('Registration successful! Redirecting to student portal...');
      setTimeout(() => {
        onLoginSuccess(res.user);
      }, 1000);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.forgotPassword(forgotIdentifier);
      setSuccessMsg(res.message);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setStepReset(2);
      }
    } catch (err) {
      setError(err.message || 'Failed to request reset token.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.resetPassword(resetToken, newPassword);
      setSuccessMsg(res.message);
      setTab('login');
      setLoginPassword('');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u, p) => {
    setLoginUsername(u);
    setLoginPassword(p);
    setError(null);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-ivory)' }}>
      {/* Top Header */}
      <header style={{ padding: '1.25rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-cream)', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div className="brand-icon">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', margin: 0, letterSpacing: '0.04em' }}>AURA BLE SMART ATTENDANCE</h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Institutional Attendance & Verification Infrastructure</p>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--forest-green)', fontWeight: 600 }}>
          Official College Portal Entry
        </div>
      </header>

      {/* Main Form Centerpiece */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem' }}>
        <div className="card" style={{ maxWidth: tab === 'register' ? '720px' : '460px', width: '100%', padding: '2rem', border: '1px solid var(--border-cream)', boxShadow: 'var(--shadow-md)' }}>
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-cream)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              className={`btn ${tab === 'login' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              onClick={() => { setTab('login'); setError(null); setSuccessMsg(null); }}
            >
              Sign In
            </button>
            <button
              className={`btn ${tab === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              onClick={() => { setTab('register'); setError(null); setSuccessMsg(null); }}
            >
              Student Self-Registration
            </button>
            <button
              className={`btn ${tab === 'forgot' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              onClick={() => { setTab('forgot'); setError(null); setSuccessMsg(null); }}
            >
              Reset Password
            </button>
          </div>

          {error && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-text)', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--success-text)', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Account Authentication</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Enter institutional credentials to access your designated role dashboard.
              </p>

              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Username or College Email</label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. admin, prof.patil, or student.aarav"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontSize: '0.9rem' }}
                    required
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Password</label>
                    <button
                      type="button"
                      style={{ background: 'transparent', fontSize: '0.72rem', color: 'var(--forest-green)', textDecoration: 'underline' }}
                      onClick={() => setTab('forgot')}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontSize: '0.9rem' }}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
                  {loading ? 'Verifying with Server...' : 'Sign In to Dashboard'}
                </button>
              </form>

              {/* Development Testing Presets */}
              <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-cream)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                  Test Credentials (Development Demo Accounts):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  {demoPresets.map((d) => (
                    <button
                      key={d.u}
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '6px 8px', textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                      onClick={() => fillDemo(d.u, d.p)}
                    >
                      <strong>{d.label}</strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{d.u} / {d.p}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STUDENT REGISTRATION */}
          {tab === 'register' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Student Enrolment Registration</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Register your student profile. Details will be verified by the college administration against university records.
              </p>

              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Full Name (As on Marksheet)</label>
                    <input
                      type="text"
                      value={regData.fullName}
                      onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                      placeholder="e.g. Maya Suresh Deshmukh"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Student Roll Number</label>
                    <input
                      type="text"
                      value={regData.rollNumber}
                      onChange={(e) => setRegData({ ...regData, rollNumber: e.target.value })}
                      placeholder="e.g. TE-CSE-24"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>University PRN / Enrolment ID</label>
                    <input
                      type="text"
                      value={regData.prn}
                      onChange={(e) => setRegData({ ...regData, prn: e.target.value })}
                      placeholder="e.g. PRN2024099"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Class & Division (Enter Manually)</label>
                    <input
                      type="text"
                      value={regData.className}
                      onChange={(e) => setRegData({ ...regData, className: e.target.value })}
                      placeholder="e.g. TE-CSE-A, SE-IT-B, BE-ENTC-A"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Account Username</label>
                    <input
                      type="text"
                      value={regData.username}
                      onChange={(e) => setRegData({ ...regData, username: e.target.value })}
                      placeholder="e.g. student.maya"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>College Email</label>
                    <input
                      type="email"
                      value={regData.email}
                      onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                      placeholder="maya@college.edu"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Account Password</label>
                    <input
                      type="password"
                      value={regData.password}
                      onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                      placeholder="Min 6 characters"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Student Mobile Number</label>
                    <input
                      type="tel"
                      value={regData.phone}
                      onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                      placeholder="+919800000000"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                    />
                  </div>
                </div>

                {/* Guardian Details */}
                <div style={{ background: 'var(--bg-cream)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--forest-green)', marginBottom: '0.5rem' }}>
                    Mandatory Guardian / Parent Contact (For IVR Alerts)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Guardian Name</label>
                      <input
                        type="text"
                        value={regData.guardianName}
                        onChange={(e) => setRegData({ ...regData, guardianName: e.target.value })}
                        placeholder="Mr. Suresh Deshmukh"
                        style={{ width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontSize: '0.85rem' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Guardian Phone</label>
                      <input
                        type="tel"
                        value={regData.guardianPhone}
                        onChange={(e) => setRegData({ ...regData, guardianPhone: e.target.value })}
                        placeholder="+919876543210"
                        style={{ width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontSize: '0.85rem' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Relationship</label>
                      <select
                        value={regData.guardianRelation}
                        onChange={(e) => setRegData({ ...regData, guardianRelation: e.target.value })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontSize: '0.85rem' }}
                      >
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Guardian">Legal Guardian</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
                  {loading ? 'Submitting Registration...' : 'Complete Enrolment Registration'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: PASSWORD RECOVERY */}
          {tab === 'forgot' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Institutional Password Reset</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Enter your username or email to generate an authorized password reset token.
              </p>

              {stepReset === 1 ? (
                <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Username or Registered Email</label>
                    <input
                      type="text"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="e.g. student.aarav or prof.patil"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                    {loading ? 'Searching Record...' : 'Request Password Reset Token'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Reset Token</label>
                    <input
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontFamily: 'monospace' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Set New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                    {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
