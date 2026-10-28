import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Radio, Play, Square, Users, CheckCircle, XCircle, AlertTriangle,
  Clock, ShieldAlert, Check, X, Camera, RefreshCw, UserCheck, Calendar,
  Search, Filter, Phone, Mail, Award, BookOpen
} from 'lucide-react';

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('session'); // 'session' | 'records' | 'schedule'
  const [overview, setOverview] = useState(null);
  const [activeRoster, setActiveRoster] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [collegeClasses, setCollegeClasses] = useState([]);
  const [collegeSubjects, setCollegeSubjects] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Start Session Form with Manual Inputs
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('1');
  const [selectedSubjectId, setSelectedSubjectId] = useState('1');
  const [ttlMinutes, setTtlMinutes] = useState(10);
  const [customLectureTime, setCustomLectureTime] = useState('09:00 AM - 10:00 AM');
  const [isSubstituteSession, setIsSubstituteSession] = useState(false);
  const [overrideSubstitution, setOverrideSubstitution] = useState(false);

  // Selfie Rejection Modal
  const [rejectModalRecord, setRejectModalRecord] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('Face did not match registered student profile.');

  // Manual Override Modal
  const [overrideModalStudent, setOverrideModalStudent] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState('PRESENT');
  const [overrideReason, setOverrideReason] = useState('Device BLE hardware failure in classroom');

  const fetchOverview = async () => {
    try {
      setError(null);
      const [overviewData, studentsData, classesData, subjectsData] = await Promise.all([
        api.getTeacherOverview(),
        api.getTeacherStudents().catch(() => ({ students: [] })),
        api.getTeacherClasses().catch(() => ({ classes: [] })),
        api.getTeacherSubjects().catch(() => ({ subjects: [] }))
      ]);
      setOverview(overviewData);
      setAllStudents(studentsData.students || []);
      setCollegeClasses(classesData.classes || []);
      setCollegeSubjects(subjectsData.subjects || []);

      if (overviewData.activeSession) {
        fetchRoster(overviewData.activeSession.id);
      } else {
        setActiveRoster(null);
      }
    } catch (err) {
      console.error('Error fetching teacher overview:', err);
      setError(err.message || 'Failed to load teacher dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoster = async (sessionId) => {
    try {
      const rosterData = await api.getSessionRoster(sessionId);
      setActiveRoster(rosterData);
    } catch (err) {
      console.error('Error fetching session roster:', err);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(() => {
      if (overview?.activeSession) {
        fetchRoster(overview.activeSession.id);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [overview?.activeSession?.id]);

  const handleStartSession = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.startSession({
        slotId: selectedSlotId ? parseInt(selectedSlotId, 10) : null,
        classId: parseInt(selectedClassId, 10),
        subjectId: parseInt(selectedSubjectId, 10),
        ttlMinutes: parseInt(ttlMinutes, 10) || 10,
        isSubstitute: isSubstituteSession,
        overrideSubstitution: overrideSubstitution,
        lectureTime: customLectureTime || null
      });
      setSuccessMessage(res.message);
      setSelectedSlotId('');
      setOverrideSubstitution(false);
      await fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!overview?.activeSession) return;
    if (!confirm('Are you sure you want to end this attendance session? All students who did not check in will be marked ABSENT.')) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.endSession(overview.activeSession.id);
      setSuccessMessage(res.message);
      await fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewSelfie = async (recordId, decision, reason) => {
    try {
      await api.reviewSelfie(recordId, decision, reason);
      setRejectModalRecord(null);
      if (overview?.activeSession) {
        fetchRoster(overview.activeSession.id);
      }
    } catch (err) {
      alert(`Selfie review failed: ${err.message}`);
    }
  };

  const handleManualOverride = async () => {
    if (!overview?.activeSession || !overrideModalStudent) return;
    try {
      await api.manualOverride(
        overview.activeSession.id,
        overrideModalStudent.student_id,
        overrideStatus,
        overrideReason
      );
      setOverrideModalStudent(null);
      fetchRoster(overview.activeSession.id);
    } catch (err) {
      alert(`Manual override failed: ${err.message}`);
    }
  };

  // Filter students for Teacher / GFM view
  const filteredStudents = allStudents.filter(st => {
    const matchesSearch =
      st.student_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      st.roll_number?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      st.prn?.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesClass = classFilter === 'ALL' || st.class_name === classFilter;
    return matchesSearch && matchesClass;
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <RefreshCw className="spin" size={32} color="var(--forest-green)" style={{ margin: '0 auto 1rem' }} />
        <p>Loading teacher schedule, assigned classes, and active sessions...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Teacher Top Profile Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #FAF7EE, #F2ECE0)', border: '1px solid var(--border-cream)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <h2 style={{ fontSize: '1.6rem', margin: 0 }}>{overview?.teacher?.fullName}</h2>
              <span className="badge badge-champagne">Faculty Portal</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Faculty Email: <strong>{overview?.teacher?.email}</strong> | Today: <strong>{overview?.today?.day}, {overview?.today?.date}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--forest-green)' }}>
                {overview?.totalSessionsConducted || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sessions Conducted</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: overview?.pendingSelfiesCount > 0 ? 'var(--gold-dark)' : 'var(--text-secondary)' }}>
                {overview?.pendingSelfiesCount || 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Selfies</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--forest-green)' }}>
                {allStudents.length}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Students</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs for Teacher & GFM */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-cream)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'session' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('session')}
        >
          <Radio size={16} /> Live Classroom Session & BLE Beacon
        </button>
        <button
          className={`btn ${activeTab === 'records' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('records')}
        >
          <Users size={16} /> All Student Records & Roster ({allStudents.length} Students)
        </button>
        <button
          className={`btn ${activeTab === 'schedule' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={16} /> Assigned Lecture Slots ({overview?.assignedSlots?.length || 0})
        </button>
      </div>

      {/* ERROR & SUCCESS ALERTS */}
      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          {error.includes('substituted') && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              onClick={() => {
                setSelectedSlotId('');
                setOverrideSubstitution(true);
                setError(null);
              }}
            >
              Clear Slot & Start as Ad-Hoc Lecture
            </button>
          )}
        </div>
      )}

      {successMessage && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '1rem', borderRadius: 'var(--radius-md)', color: 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ===================== TAB 1: LIVE CLASSROOM SESSION & BLE BEACON ===================== */}
      {activeTab === 'session' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Session Card */}
          {overview?.activeSession ? (
            <div className="card" style={{ border: '2px solid var(--forest-green)', background: '#F8FAF6' }}>
              <div className="card-header" style={{ borderBottomColor: 'var(--border-cream)' }}>
                <div className="card-title" style={{ color: 'var(--forest-green)' }}>
                  <Radio size={22} className="spin" color="var(--forest-green)" />
                  Active Bluetooth Beacon Advertising (Broadcasting live in classroom)
                </div>
                <button className="btn btn-danger" onClick={handleEndSession} disabled={actionLoading}>
                  <Square size={16} /> End Attendance Session & Finalize
                </button>
              </div>

              {/* Session Banner */}
              <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-cream)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Course & Class</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                    {overview.activeSession.subject_name} ({overview.activeSession.subject_code})
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Class: {overview.activeSession.class_name}</div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-cream)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>BLE Session Token</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--forest-green)', letterSpacing: '0.15em' }}>
                    {overview.activeSession.session_token}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gold-dark)' }}>Broadcasted over BLE Advertisement</div>
                </div>

                <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-cream)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classroom Tally</div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem' }}>
                    <div>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success-text)' }}>
                        {activeRoster?.summary?.presentCount || 0}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>PRESENT</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger-text)' }}>
                        {activeRoster?.summary?.absentCount || 0}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>ABSENT</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold-dark)' }}>
                        {activeRoster?.summary?.pendingSelfies || 0}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>SELFIES PENDING</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE CLASSROOM ROSTER TABLE */}
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="var(--forest-green)" />
                  Classroom Attendance Roster ({activeRoster?.roster?.length || 0} Enrolled Students)
                </h4>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Status</th>
                        <th>BLE Verification</th>
                        <th>Captured Selfie</th>
                        <th>Selfie Review Action</th>
                        <th>Override</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRoster?.roster?.map((st) => (
                        <tr key={st.student_id}>
                          <td><strong>{st.roll_number}</strong></td>
                          <td>{st.student_name}</td>
                          <td>
                            {st.attendance_status === 'PRESENT' ? (
                              <span className="badge badge-success"><CheckCircle size={12} /> PRESENT</span>
                            ) : (
                              <span className="badge badge-danger"><XCircle size={12} /> ABSENT</span>
                            )}
                          </td>
                          <td>
                            {st.ble_verified ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--forest-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Radio size={14} /> RSSI {st.ble_rssi || -64} dBm
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Not detected</span>
                            )}
                          </td>
                          <td>
                            {st.selfie_url ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <img
                                  src={`http://localhost:5000${st.selfie_url}`}
                                  alt="Selfie"
                                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-cream)' }}
                                />
                                <span className={`badge ${st.selfie_status === 'APPROVED' ? 'badge-success' : st.selfie_status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                                  {st.selfie_status}
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No selfie</span>
                            )}
                          </td>
                          <td>
                            {st.selfie_url && st.selfie_status === 'PENDING' ? (
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={() => handleReviewSelfie(st.record_id, 'APPROVED', null)}
                                  title="Approve student selfie"
                                >
                                  <Check size={14} /> Approve
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={() => setRejectModalRecord(st)}
                                  title="Reject student selfie"
                                >
                                  <X size={14} /> Reject
                                </button>
                              </div>
                            ) : st.selfie_rejection_reason ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--danger-text)' }}>
                                Rejected: {st.selfie_rejection_reason}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              onClick={() => setOverrideModalStudent(st)}
                            >
                              Manual
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* START NEW ATTENDANCE SESSION CARD WITH MANUAL INPUTS */
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Play size={20} color="var(--forest-green)" />
                  Start New BLE Attendance Session
                </div>
                <span className="badge badge-champagne">Beacon Generator</span>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Starting a session generates a cryptographic one-time token and BLE broadcast payload for your classroom.
                Enter your class details, duration in minutes, and lecture time manually below.
              </p>

              {/* Slot Linking Status */}
              <div style={{ background: 'var(--bg-cream)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-cream)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem' }}>
                  <strong>Selected Lecture Mode: </strong>
                  {selectedSlotId ? (
                    <span style={{ color: 'var(--forest-green)', fontWeight: 600 }}>
                      Linked to Slot #{selectedSlotId} (From Schedule)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Ad-Hoc / Custom Classroom Session (No timetable lock)
                    </span>
                  )}
                </div>
                {selectedSlotId && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    onClick={() => {
                      setSelectedSlotId('');
                      setOverrideSubstitution(false);
                    }}
                  >
                    Clear Slot Link (Conduct as Ad-Hoc Lecture)
                  </button>
                )}
              </div>

              <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
                {/* Class / Division Selection */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Class / Division
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', background: '#FFFFFF' }}
                  >
                    {collegeClasses.length > 0 ? (
                      collegeClasses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.department_name || 'Engineering'}) - Div {c.division}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1">TE-CSE-A (Computer Engineering)</option>
                        <option value="2">BE-CSE-A (Computer Engineering)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Subject Selection */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Subject / Course
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', background: '#FFFFFF' }}
                  >
                    {collegeSubjects.length > 0 ? (
                      collegeSubjects.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1">CS301 - Database Management Systems</option>
                        <option value="2">CS302 - Computer Networks</option>
                        <option value="3">CS303 - Operating Systems</option>
                        <option value="4">CS304 - Software Engineering</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* MANUAL TIME & DURATION INPUTS */}
              <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
                {/* Manual Session Duration Input */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Session Duration in Minutes (Write Manually)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={ttlMinutes}
                      onChange={(e) => setTtlMinutes(e.target.value)}
                      placeholder="e.g. 15"
                      style={{ width: '120px', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', fontWeight: 700 }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Minutes TTL</span>
                    {/* Quick helper shortcuts */}
                    <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                      {[5, 10, 15, 45, 60].map(m => (
                        <button
                          key={m}
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '3px 7px', fontSize: '0.72rem' }}
                          onClick={() => setTtlMinutes(m)}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Manual Lecture Slot / Time Window Input */}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Lecture Slot Time (Write Manually)
                  </label>
                  <input
                    type="text"
                    value={customLectureTime}
                    onChange={(e) => setCustomLectureTime(e.target.value)}
                    placeholder="e.g. 09:00 AM - 10:00 AM, or 02:00 PM - 03:00 PM"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                  />
                </div>
              </div>

              {/* Override Checkbox if Substitution error occurred */}
              {overrideSubstitution && (
                <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={overrideSubstitution}
                      onChange={(e) => setOverrideSubstitution(e.target.checked)}
                    />
                    <strong>Force Override:</strong> Teacher is physically present in classroom to conduct this lecture.
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleStartSession}
                  disabled={actionLoading}
                  style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                >
                  <Play size={16} /> Broadcast BLE Beacon & Open Attendance
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: ALL STUDENT RECORDS & ROSTER (FOR TEACHER & GFM) ===================== */}
      {activeTab === 'records' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <Users size={20} color="var(--forest-green)" />
                  Complete Student Enrolment & Attendance Directory
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Live academic records for Teachers and Guardian Faculty Members (GFM)
                </div>
              </div>
              <span className="badge badge-champagne">{filteredStudents.length} Students Listed</span>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search student by Name, Roll Number, or PRN..."
                  style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={16} color="var(--text-muted)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Class:</span>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', background: '#FFFFFF', fontSize: '0.82rem' }}
                >
                  <option value="ALL">All Classes</option>
                  {collegeClasses.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students Table */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name & Contact</th>
                    <th>PRN / ID</th>
                    <th>Class & Div</th>
                    <th>Guardian Details</th>
                    <th>Conducted</th>
                    <th>Attended</th>
                    <th>Absent</th>
                    <th>Attendance %</th>
                    <th>Status</th>
                    <th>Assigned GFM</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((st) => (
                      <tr key={st.id} style={{ background: st.isDefaulter ? '#FFF8F8' : 'transparent' }}>
                        <td><strong>{st.roll_number}</strong></td>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600 }}>{st.student_name}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              <Mail size={11} style={{ display: 'inline', marginRight: '3px' }} />
                              {st.student_email}
                            </div>
                            {st.student_phone && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                <Phone size={11} style={{ display: 'inline', marginRight: '3px' }} />
                                {st.student_phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{st.prn}</span></td>
                        <td>
                          <span className="badge badge-champagne">{st.class_name}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem' }}>
                            <div><strong>{st.guardian_name || 'N/A'}</strong></div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                              <Phone size={11} style={{ display: 'inline', marginRight: '3px' }} />
                              {st.guardian_phone || 'N/A'}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{st.conducted}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--forest-green)' }}>{st.attended}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: st.absent > 0 ? 'var(--danger-text)' : 'var(--text-muted)' }}>{st.absent}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '1rem', color: st.percentage >= 75 ? 'var(--forest-green)' : 'var(--danger-text)' }}>
                              {st.percentage}%
                            </strong>
                          </div>
                        </td>
                        <td>
                          {st.isDefaulter ? (
                            <span className="badge badge-danger">Defaulter (&lt;75%)</span>
                          ) : (
                            <span className="badge badge-success">Good Standing</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {st.gfm_name || 'Not assigned'}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No students found matching your search and filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: ASSIGNED LECTURE SLOTS ===================== */}
      {activeTab === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* SUBSTITUTION ALERTS */}
          {overview?.myAbsentSubstitutions?.length > 0 && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <ShieldAlert size={24} color="var(--danger-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--danger-text)', fontSize: '0.95rem' }}>
                  Substitution Lockdown Active for Today's Lecture
                </div>
                {overview.myAbsentSubstitutions.map(sub => (
                  <div key={sub.id} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    Admin has marked you on official leave/absent. Assigned substitute: <strong>{sub.substitute_teacher_name}</strong>.
                    Per college policy, the designated substitute will conduct attendance for that slot.
                  </div>
                ))}
              </div>
            </div>
          )}

          {overview?.substituteSlots?.length > 0 && (
            <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <UserCheck size={24} color="var(--warning-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--warning-text)', fontSize: '0.95rem' }}>
                  You are Assigned as Substitute Teacher Today!
                </div>
                {overview.substituteSlots.map(sub => (
                  <div key={sub.substitution_id} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    Substituting for <strong>{sub.original_teacher_name}</strong> in <strong>{sub.class_name}</strong> ({sub.subject_name} - {sub.start_time} to {sub.end_time}, {sub.room_number}).
                    <button
                      className="btn btn-gold"
                      style={{ padding: '3px 10px', fontSize: '0.75rem', marginLeft: '0.75rem' }}
                      onClick={() => {
                        setSelectedSlotId(sub.slot_id);
                        setSelectedClassId(sub.class_id);
                        setSelectedSubjectId(sub.subject_id);
                        setCustomLectureTime(`${sub.start_time} - ${sub.end_time}`);
                        setIsSubstituteSession(true);
                        setActiveTab('session');
                      }}
                    >
                      Conduct as Substitute
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Calendar size={18} color="var(--forest-green)" />
                Assigned Timetable Schedule
              </div>
              <span className="badge badge-champagne">{overview?.assignedSlots?.length || 0} Slots</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time Slot</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Room</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.assignedSlots?.map((slot) => (
                    <tr key={slot.slot_id}>
                      <td><strong>{slot.day_of_week}</strong></td>
                      <td>{slot.start_time} - {slot.end_time}</td>
                      <td>{slot.class_name}</td>
                      <td>{slot.subject_name} ({slot.subject_code})</td>
                      <td>{slot.room_number}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                          onClick={() => {
                            setSelectedSlotId(slot.slot_id);
                            setSelectedClassId(slot.class_id);
                            setSelectedSubjectId(slot.subject_id);
                            setCustomLectureTime(`${slot.start_time} - ${slot.end_time}`);
                            setIsSubstituteSession(false);
                            setActiveTab('session');
                          }}
                        >
                          Select For Session
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SELFIE REJECTION REASON MODAL */}
      {rejectModalRecord && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ margin: 0, color: 'var(--danger-text)' }}>
                Reject Student Selfie
              </h3>
              <button onClick={() => setRejectModalRecord(null)} style={{ background: 'transparent' }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Rejecting this selfie will mark the student's attendance as <strong>ABSENT</strong> and log the audit reason.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Select or Specify Rejection Reason:
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', marginBottom: '0.5rem' }}
              >
                <option value="Face did not match registered student profile.">Face did not match registered student profile.</option>
                <option value="Blurry / poor lighting image prevent identification.">Blurry / poor lighting image prevent identification.</option>
                <option value="Photo of a photo / digital screen detected (Proxy suspected).">Photo of a photo / digital screen detected (Proxy suspected).</option>
                <option value="Multiple faces detected in frame.">Multiple faces detected in frame.</option>
              </select>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Or custom explanation..."
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setRejectModalRecord(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => handleReviewSelfie(rejectModalRecord.record_id, 'REJECTED', rejectionReason)}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ATTENDANCE OVERRIDE MODAL */}
      {overrideModalStudent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ margin: 0 }}>
                Manual Attendance Override
              </h3>
              <button onClick={() => setOverrideModalStudent(null)} style={{ background: 'transparent' }}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Student: <strong>{overrideModalStudent.student_name}</strong> ({overrideModalStudent.roll_number})
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Set Status:</label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)', marginBottom: '0.75rem' }}
              >
                <option value="PRESENT">PRESENT</option>
                <option value="ABSENT">ABSENT</option>
                <option value="EXCUSED">EXCUSED (Official Duty / Medical)</option>
              </select>

              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Audit Reason:</label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Device Bluetooth hardware issue"
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setOverrideModalStudent(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleManualOverride}>Save Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
