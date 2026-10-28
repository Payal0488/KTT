import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthPortal from './components/AuthPortal';
import StudentDashboard from './components/StudentDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import AdminDashboard from './components/AdminDashboard';
import { api } from './services/api';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing token on initial load
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.getMe();
          setCurrentUser(res.user);
        } catch (e) {
          console.warn('Stored token is invalid or expired. Requiring sign-in.');
          localStorage.removeItem('token');
          setCurrentUser(null);
        }
      }
      setLoading(false);
    };

    verifySession();
  }, []);

  const handleSwitchUser = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.login(username, password);
      localStorage.setItem('token', res.token);
      setCurrentUser(res.user);
    } catch (err) {
      alert(`Account switch failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-ivory)' }}>
        <RefreshCw className="spin" size={40} color="var(--forest-green)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--forest-dark)' }}>AURA BLE College Attendance</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Verifying institutional session...</p>
      </div>
    );
  }

  // Real Login & Registration Entry Point
  if (!currentUser) {
    return <AuthPortal onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="app-container">
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onOpenLogin={() => {}}
      />

      <main className="main-content">
        {currentUser.role === 'student' && <StudentDashboard />}
        {currentUser.role === 'teacher' && <TeacherDashboard />}
        {currentUser.role === 'admin' && <AdminDashboard />}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-cream)', background: 'var(--bg-card)', padding: '1rem 2rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        BLE-Based Smart College Attendance Management System &bull; Institutional Edition &bull; Persistent SQLite Backend &bull; Hardware-Free Bluetooth LE
      </footer>
    </div>
  );
}
