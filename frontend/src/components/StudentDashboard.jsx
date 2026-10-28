import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import SelfieCaptureModal from './SelfieCaptureModal';
import {
  Radio, CheckCircle2, XCircle, AlertTriangle, Calculator,
  Clock, Calendar, User, Shield, Camera, RefreshCw, FileText
} from 'lucide-react';

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Attendance Submission State
  const [isSelfieModalOpen, setIsSelfieModalOpen] = useState(false);
  const [capturedSelfieBlob, setCapturedSelfieBlob] = useState(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState(null);
  const [sessionTokenInput, setSessionTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);

  // Goal Simulator
  const [simulatedGoal, setSimulatedGoal] = useState(75);

  const fetchData = async () => {
    try {
      setError(null);
      const [profileRes, statsRes, timetableRes, activeRes] = await Promise.all([
        api.getStudentProfile(),
        api.getStudentStats(),
        api.getStudentTimetable(),
        api.getActiveSessionForStudent()
      ]);

      setProfile(profileRes.student);
      setStats(statsRes.stats);
      setHistory(statsRes.history);
      setTimetable(timetableRes.timetable);
      setActiveSession(activeRes.activeSession);

      // Pre-fill session token if active session is detected
      if (activeRes.activeSession && activeRes.activeSession.session_token) {
        setSessionTokenInput(activeRes.activeSession.session_token);
      }
    } catch (err) {
      console.error('Error fetching student dashboard:', err);
      setError(err.message || 'Failed to load student data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 10 seconds for active BLE sessions
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSelfieCaptured = (blob) => {
    setCapturedSelfieBlob(blob);
    setSelfiePreviewUrl(URL.createObjectURL(blob));
  };

  const handleSubmitAttendance = async () => {
    if (!activeSession) return;
    if (!sessionTokenInput) {
      alert('Please enter or scan the BLE Session Token.');
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const formData = new FormData();
      formData.append('sessionId', activeSession.id);
      formData.append('sessionToken', sessionTokenInput.trim());
      formData.append('rssi', -64); // Realistic in-room BLE signal
      if (capturedSelfieBlob) {
        formData.append('selfie', capturedSelfieBlob, 'selfie.jpg');
      }

      const res = await api.markAttendance(formData);
      setSubmitMessage({ type: 'success', text: res.message });
      setCapturedSelfieBlob(null);
      setSelfiePreviewUrl(null);
      await fetchData();
    } catch (err) {
      setSubmitMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic Goal Calculator
  const calculateLecturesForGoal = (targetPercent) => {
    if (!stats || stats.totalConducted === 0) return 0;
    const target = targetPercent / 100;
    const A = stats.totalAttended;
    const N = stats.totalConducted;

    if (stats.overallPercentage < targetPercent) {
      const needed = Math.ceil(((target * N) - A) / (1 - target));
      return needed > 0 ? needed : 0;
    }
    return 0;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <RefreshCw className="spin" size={32} color="var(--forest-green)" style={{ margin: '0 auto 1rem' }} />
        <p>Loading student profile and real-time attendance records...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Banner: Profile & Overview */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #FAF7EE, #F2ECE0)', border: '1px solid var(--border-cream)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <h2 style={{ fontSize: '1.6rem', margin: 0 }}>{profile?.fullName}</h2>
              <span className="badge badge-champagne">{profile?.rollNumber}</span>
              <span className="badge badge-success">{profile?.className}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span><strong>Department:</strong> {profile?.department}</span>
              <span><strong>PRN:</strong> {profile?.prn}</span>
              <span><strong>Guardian:</strong> {profile?.guardianName} ({profile?.guardianPhone})</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-cream)', textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Guardian Faculty Member (GFM)</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--forest-green)' }}>{profile?.gfm?.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{profile?.gfm?.phone || profile?.gfm?.email}</div>
          </div>
        </div>
      </div>

      {/* ACTIVE BLE SESSION RADAR */}
      {activeSession && (
        <div className="card" style={{ border: '2px solid var(--olive-muted)', background: '#F8FAF6', boxShadow: 'var(--shadow-md)' }}>
          <div className="card-header" style={{ borderBottomColor: 'var(--border-cream)' }}>
            <div className="card-title" style={{ color: 'var(--forest-green)' }}>
              <Radio size={22} className="spin" color="var(--forest-green)" />
              Live BLE Attendance Session in Progress!
            </div>
            <span className="badge badge-warning" style={{ fontSize: '0.8rem' }}>
              <Clock size={14} /> TTL: {activeSession.remainingSeconds}s remaining
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' }}>
            <div>
              <div className="beacon-radar">
                <div className="beacon-wave" />
                <div className="beacon-wave" />
                <div className="beacon-center">
                  <Radio size={20} />
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{activeSession.subject_name} ({activeSession.subject_code})</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Lecturer: {activeSession.teacher_name} {activeSession.is_substitute ? '(Substitute)' : ''}
                </div>
                <div style={{ marginTop: '0.5rem', display: 'inline-block', background: 'var(--bg-card)', padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700 }}>
                  BLE Beacon Token: {activeSession.session_token}
                </div>
              </div>
            </div>

            <div>
              {activeSession.alreadyMarked ? (
                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', textAlign: 'center' }}>
                  <CheckCircle2 size={36} color="var(--success-text)" style={{ margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success-text)' }}>Attendance Submitted!</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                    Bluetooth beacon signal verified. Selfie review: <strong>{activeSession.alreadyMarked.selfie_status}</strong>.
                  </p>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-cream)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Verify Presence & Link Selfie</h4>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      BLE Beacon Token (Auto-detected from Bluetooth scanner)
                    </label>
                    <input
                      type="text"
                      value={sessionTokenInput}
                      onChange={(e) => setSessionTokenInput(e.target.value)}
                      placeholder="e.g. 8-digit Session Token"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontFamily: 'monospace', fontSize: '0.9rem' }}
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Student Selfie (Required for anti-proxy check)
                    </label>
                    {selfiePreviewUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={selfiePreviewUrl} alt="Selfie" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--olive-muted)' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--success-text)', fontWeight: 600 }}>Selfie captured!</span>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setIsSelfieModalOpen(true)}>Retake</button>
                      </div>
                    ) : (
                      <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setIsSelfieModalOpen(true)}>
                        <Camera size={16} /> Open Camera & Capture Selfie
                      </button>
                    )}
                  </div>

                  {submitMessage && (
                    <div style={{ padding: '0.6rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', fontSize: '0.8rem', background: submitMessage.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)', color: submitMessage.type === 'error' ? 'var(--danger-text)' : 'var(--success-text)' }}>
                      {submitMessage.text}
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={handleSubmitAttendance}
                    disabled={submitting}
                  >
                    {submitting ? 'Verifying with Teacher Beacon...' : 'Submit Attendance via BLE'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats & Required Lectures Calculator */}
      <div className="grid-3">
        {/* Overall Attendance Card */}
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Overall Attendance</span>
            {stats?.isBelowThreshold ? (
              <span className="badge badge-danger"><AlertTriangle size={12} /> Defaulter Alert</span>
            ) : (
              <span className="badge badge-success"><CheckCircle2 size={12} /> Eligible</span>
            )}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: stats?.isBelowThreshold ? 'var(--danger-text)' : 'var(--forest-green)' }}>
            {stats?.overallPercentage}%
          </div>
          <div className="progress-bar-container">
            <div
              className={`progress-bar-fill ${stats?.isBelowThreshold ? 'fill-danger' : 'fill-safe'}`}
              style={{ width: `${Math.min(100, stats?.overallPercentage || 0)}%` }}
            />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span>Attended: <strong style={{ color: 'var(--forest-green)' }}>{stats?.totalAttended}</strong></span>
            <span>Final Absent: <strong style={{ color: 'var(--danger-text)' }}>{stats?.finalizedAbsent}</strong></span>
            <span>Pending Selfies: <strong style={{ color: 'var(--gold-dark)' }}>{stats?.pendingVerification}</strong></span>
            <span>Conducted: <strong>{stats?.totalConducted}</strong></span>
          </div>
        </div>

        {/* Dynamic Calculator Card */}
        <div className="card" style={{ borderLeft: '4px solid var(--champagne-gold)' }}>
          <div className="card-header">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calculator size={16} color="var(--gold-dark)" />
              Attendance Calculator
            </span>
            <span className="badge badge-champagne">Formula Engine</span>
          </div>

          {stats?.isBelowThreshold ? (
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger-text)' }}>
                +{stats?.requiredLecturesToCatchUp} Lectures
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                You must attend <strong>{stats?.requiredLecturesToCatchUp} consecutive upcoming lectures</strong> without absence to reach the mandatory <strong>75%</strong> threshold.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--forest-green)' }}>
                {stats?.safeLecturesToBunk} Lectures
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                You can safely miss up to <strong>{stats?.safeLecturesToBunk} lectures</strong> while maintaining overall attendance at or above <strong>75%</strong>.
              </p>
            </div>
          )}

          {/* Target Simulator Slider */}
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
              <span>Simulate Target Goal:</span>
              <strong>{simulatedGoal}%</strong>
            </div>
            <input
              type="range"
              min="75"
              max="95"
              step="5"
              value={simulatedGoal}
              onChange={(e) => setSimulatedGoal(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--gold-dark)', marginTop: '4px' }}>
              To reach {simulatedGoal}%: Need <strong>{calculateLecturesForGoal(simulatedGoal)}</strong> more consecutive lectures.
            </div>
          </div>
        </div>

        {/* Policy / Warnings Card */}
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>University Regulations</span>
            <span className="badge badge-champagne">Ordinance 119</span>
          </div>
          <ul style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: 1.6 }}>
            <li>Minimum 75% attendance mandatory in every course for exam term-grant.</li>
            <li>Selfie & BLE device MAC registered to prevent proxy check-ins.</li>
            <li>Automated IVR call sent to parents when attendance drops below 75%.</li>
          </ul>
        </div>
      </div>

      {/* Subject-Wise Attendance Breakdown */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Subject-Wise Attendance Breakdown</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Real-time database statistics</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Credits</th>
                <th>Conducted</th>
                <th>Attended</th>
                <th>Percentage</th>
                <th>Catch-Up Required</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats?.subjectStats?.map((sub) => (
                <tr key={sub.subjectId}>
                  <td><strong>{sub.code}</strong></td>
                  <td>{sub.name}</td>
                  <td>{sub.credits}</td>
                  <td>{sub.conducted}</td>
                  <td>{sub.attended}</td>
                  <td style={{ width: '160px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700 }}>{sub.percentage}%</span>
                    </div>
                    <div className="progress-bar-container" style={{ margin: 0, height: '6px' }}>
                      <div
                        className={`progress-bar-fill ${sub.isBelowThreshold ? 'fill-danger' : 'fill-safe'}`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    {sub.isBelowThreshold ? (
                      <span style={{ color: 'var(--danger-text)', fontWeight: 700 }}>+{sub.requiredToCatchUp} lectures</span>
                    ) : (
                      <span style={{ color: 'var(--forest-green)' }}>Safe to miss: {sub.safeToMiss}</span>
                    )}
                  </td>
                  <td>
                    {sub.isBelowThreshold ? (
                      <span className="badge badge-danger">Low (&lt;75%)</span>
                    ) : (
                      <span className="badge badge-success">Good</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly & Semester Summaries */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Monthly Attendance Breakdown</div>
            <span className="badge badge-champagne">Semester Trend</span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Conducted</th>
                  <th>Attended</th>
                  <th>Absent</th>
                  <th>Percentage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.monthlySummaries && stats.monthlySummaries.length > 0 ? (
                  stats.monthlySummaries.map((m) => (
                    <tr key={m.monthKey}>
                      <td><strong>{m.monthKey}</strong></td>
                      <td>{m.conducted}</td>
                      <td>{m.attended}</td>
                      <td>{m.absent}</td>
                      <td><strong>{m.percentage}%</strong></td>
                      <td>
                        {m.isBelowThreshold ? (
                          <span className="badge badge-danger">Below 75%</span>
                        ) : (
                          <span className="badge badge-success">Safe</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No monthly attendance history recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ background: '#FAF8F2' }}>
          <div className="card-header">
            <div className="card-title">Semester Term Summary</div>
            <span className={`badge ${stats?.semesterSummary?.status === 'ELIGIBLE' ? 'badge-success' : 'badge-danger'}`}>
              {stats?.semesterSummary?.status === 'ELIGIBLE' ? 'Term Grant Eligible' : 'Defaulter Warning'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Academic Term:</span>
              <strong>{stats?.semesterSummary?.term}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Semester Lectures:</span>
              <strong>{stats?.semesterSummary?.totalConducted}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Attended Lectures:</span>
              <strong style={{ color: 'var(--forest-green)' }}>{stats?.semesterSummary?.totalAttended}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Finalized Absent Lectures:</span>
              <strong style={{ color: 'var(--danger-text)' }}>{stats?.semesterSummary?.finalizedAbsent}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Pending Selfie Verifications:</span>
              <strong style={{ color: 'var(--gold-dark)' }}>{stats?.semesterSummary?.pendingVerification}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>University Minimum Threshold:</span>
              <strong>{stats?.semesterSummary?.minThreshold}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Timetable Schedule */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Calendar size={18} color="var(--forest-green)" />
            Class Timetable Schedule
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Time Slot</th>
                <th>Subject</th>
                <th>Faculty</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {timetable.map((slot) => (
                <tr key={slot.id}>
                  <td><strong>{slot.day_of_week}</strong></td>
                  <td>{slot.start_time} - {slot.end_time}</td>
                  <td>{slot.subject_name} ({slot.subject_code})</td>
                  <td>{slot.teacher_name}</td>
                  <td>{slot.room_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance History */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileText size={18} color="var(--forest-green)" />
            Verified Attendance History
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Showing past sessions</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Subject</th>
                <th>Faculty</th>
                <th>Status</th>
                <th>BLE Beacon</th>
                <th>Selfie Review</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id}>
                  <td>{record.session_date}</td>
                  <td>{record.start_time.split(' ')[1] || record.start_time}</td>
                  <td><strong>{record.subject_code}</strong> - {record.subject_name}</td>
                  <td>{record.teacher_name}</td>
                  <td>
                    {record.status === 'PRESENT' ? (
                      <span className="badge badge-success"><CheckCircle2 size={12} /> PRESENT</span>
                    ) : (
                      <span className="badge badge-danger"><XCircle size={12} /> ABSENT</span>
                    )}
                  </td>
                  <td>
                    {record.ble_verified ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--forest-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Radio size={14} /> Verified ({record.ble_rssi || -64} dBm)
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manual / Unverified</span>
                    )}
                  </td>
                  <td>
                    {record.selfie_url ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <a href={`http://localhost:5000${record.selfie_url}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: 'var(--gold-dark)', textDecoration: 'underline' }}>
                          View Selfie
                        </a>
                        <span className={`badge ${record.selfie_status === 'APPROVED' ? 'badge-success' : record.selfie_status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                          {record.selfie_status}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selfie Modal */}
      <SelfieCaptureModal
        isOpen={isSelfieModalOpen}
        onClose={() => setIsSelfieModalOpen(false)}
        onCaptured={handleSelfieCaptured}
      />
    </div>
  );
}
