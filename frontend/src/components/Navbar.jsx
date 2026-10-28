import React from 'react';
import { ShieldCheck, UserCheck, Radio, LogOut, GraduationCap, PhoneCall, BookOpen, User } from 'lucide-react';

export default function Navbar({ currentUser, onSwitchUser, onLogout, onOpenLogin }) {
  const demoUsers = [
    { label: 'Admin (Dean)', username: 'admin', role: 'admin', desc: 'Dr. Kulkarni' },
    { label: 'Teacher (Regular)', username: 'prof.patil', role: 'teacher', desc: 'Prof. Patil' },
    { label: 'GFM / Class Teacher', username: 'prof.deshmukh', role: 'teacher', desc: 'Prof. Deshmukh' },
    { label: 'Substitute Teacher', username: 'prof.shinde', role: 'teacher', desc: 'Prof. Shinde' },
    { label: 'Student (Safe 87%)', username: 'student.aarav', role: 'student', desc: 'Aarav (Roll #1)' },
    { label: 'Student (Defaulter 50%)', username: 'student.rohan', role: 'student', desc: 'Rohan (Roll #2)' }
  ];

  return (
    <nav className="navbar">
      <div className="brand-section">
        <div className="brand-icon">
          <Radio size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="brand-name">AURA BLE</span>
            <span className="brand-badge">Smart Attendance</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Hardware-Free BLE Beacon & Selfie AI Verification
          </div>
        </div>
      </div>

      <div className="nav-actions">
        {/* Compact Responsive Demo Switcher */}
        <div className="demo-switcher">
          <User size={14} color="var(--forest-green)" />
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--forest-green)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            Demo:
          </span>
          <select
            value={currentUser?.username || ''}
            onChange={(e) => {
              const u = demoUsers.find(x => x.username === e.target.value);
              if (u) {
                onSwitchUser(u.username, u.role === 'admin' ? 'admin123' : u.role === 'teacher' ? 'teacher123' : 'student123');
              }
            }}
            style={{
              padding: '4px 8px',
              fontSize: '0.76rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-cream)',
              background: '#FFFFFF',
              color: 'var(--forest-dark)',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="" disabled>-- Switch Demo Profile --</option>
            {demoUsers.map(u => (
              <option key={u.username} value={u.username}>
                {u.label} - {u.desc}
              </option>
            ))}
          </select>
        </div>

        {currentUser ? (
          <div className="user-badge">
            <span className={`role-tag ${currentUser.role}`}>
              {currentUser.role}
            </span>
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '700' }}>{currentUser.fullName}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>@{currentUser.username}</div>
            </div>
            <button
              onClick={onLogout}
              style={{ background: 'transparent', padding: '4px', color: 'var(--text-muted)', display: 'flex', cursor: 'pointer' }}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={onOpenLogin}>
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}
