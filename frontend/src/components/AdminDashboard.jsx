import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Users, UserCheck, ShieldCheck, PhoneCall, AlertTriangle, Download,
  Settings, CheckCircle, RefreshCw, Trash2, Calendar, FileText, Plus, Radio
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [callQueue, setCallQueue] = useState([]);
  const [providerStatus, setProviderStatus] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [pendingStudents, setPendingStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [rules, setRules] = useState({
    min_threshold_percentage: 75.0,
    warning_threshold_percentage: 80.0,
    session_timeout_minutes: 10,
    require_selfie: 1,
    require_ble: 1
  });

  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState(null);

  // Class Management Form
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDept, setNewClassDept] = useState('1');
  const [newClassYear, setNewClassYear] = useState('TE');
  const [newClassDivision, setNewClassDivision] = useState('A');
  const [newClassGfm, setNewClassGfm] = useState('');

  // New Substitution Form
  const [subSlotId, setSubSlotId] = useState('');
  const [subTeacherId, setSubTeacherId] = useState('');
  const [subDate, setSubDate] = useState(new Date().toISOString().split('T')[0]);
  const [subReason, setSubReason] = useState('Official Academic Duty / Leave');

  const fetchAllData = async () => {
    try {
      const [
        ovRes, stRes, tcRes, clRes, ttRes, sbRes, cqRes, logRes, pendRes
      ] = await Promise.all([
        api.getAdminOverview(),
        api.getStudents(),
        api.getTeachers(),
        api.getClasses(),
        api.getTimetable(),
        api.getSubstitutions(),
        api.getCallQueue(),
        api.getAuditLogs(),
        api.getPendingStudents()
      ]);

      setOverview(ovRes);
      setRules(ovRes.rules || {});
      setStudents(stRes.students);
      setTeachers(tcRes.teachers);
      setClasses(clRes.classes);
      setTimetable(ttRes.timetable);
      setSubstitutions(sbRes.substitutions);
      setCallQueue(cqRes.queue);
      setProviderStatus(cqRes.providerStatus);
      setAuditLogs(logRes.logs);
      setPendingStudents(pendRes.pending || []);

      if (ttRes.timetable.length > 0 && !subSlotId) {
        setSubSlotId(ttRes.timetable[0].id);
      }
      if (tcRes.teachers.length > 0 && !subTeacherId) {
        setSubTeacherId(tcRes.teachers[0].id);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSaveRules = async () => {
    try {
      await api.updateRules({
        minThreshold: rules.min_threshold_percentage,
        warningThreshold: rules.warning_threshold_percentage,
        sessionTimeout: rules.session_timeout_minutes,
        requireSelfie: rules.require_selfie,
        requireBle: rules.require_ble
      });
      setActionMessage({ type: 'success', text: 'Attendance rules updated successfully in database.' });
      await fetchAllData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setActionMessage(null);
    try {
      await api.createClass({
        name: newClassName,
        departmentId: parseInt(newClassDept, 10),
        academicYear: newClassYear,
        division: newClassDivision,
        gfmTeacherId: newClassGfm ? parseInt(newClassGfm, 10) : null
      });
      setActionMessage({ type: 'success', text: `Class ${newClassName} registered successfully.` });
      setNewClassName('');
      setShowAddClass(false);
      await fetchAllData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleAssignGFM = async (classId, gfmId) => {
    try {
      await api.assignGFM(classId, gfmId ? parseInt(gfmId, 10) : null);
      setActionMessage({ type: 'success', text: 'Guardian Faculty Member (GFM) assignment updated.' });
      await fetchAllData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateSubstitution = async (e) => {
    e.preventDefault();
    setActionMessage(null);
    try {
      const res = await api.createSubstitution({
        slotId: parseInt(subSlotId, 10),
        substituteTeacherId: parseInt(subTeacherId, 10),
        date: subDate,
        reason: subReason
      });
      setActionMessage({ type: 'success', text: res.message });
      await fetchAllData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteSubstitution = async (id) => {
    if (!confirm('Are you sure you want to revoke this substitution?')) return;
    try {
      await api.deleteSubstitution(id);
      setActionMessage({ type: 'success', text: 'Teacher substitution revoked.' });
      await fetchAllData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleSyncCallQueue = async () => {
    try {
      const res = await api.syncLowAttendance();
      setActionMessage({ type: 'success', text: res.message });
      await fetchAllData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleTriggerCall = async (queueId) => {
    try {
      const res = await api.triggerCall(queueId);
      setActionMessage({ type: 'success', text: res.message });
      await fetchAllData();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: `${err.message} (Note: Per hackathon rules, successful calls are NEVER faked when telephony provider credentials are unconfigured)`
      });
    }
  };

  const handleSendSms = async (queueId) => {
    try {
      const res = await api.sendSms(queueId);
      setActionMessage({ type: 'success', text: res.message });
      await fetchAllData();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: `${err.message} (Note: Real SMS dispatch requires TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN in backend/.env)`
      });
    }
  };

  const handleApproveEnrollment = async (studentId, status) => {
    try {
      const res = await api.approveStudentEnrollment(studentId, status);
      setActionMessage({ type: 'success', text: res.message });
      await fetchAllData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleSaveStudentEdit = async () => {
    if (!editingStudent) return;
    try {
      const res = await api.updateStudentProfile(editingStudent.id, editingStudent);
      setActionMessage({ type: 'success', text: res.message });
      setEditingStudent(null);
      await fetchAllData();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleAdminResetPassword = async () => {
    if (!resettingUser || !newPasswordInput) return;
    try {
      const res = await api.adminResetPassword(resettingUser.id, newPasswordInput);
      setActionMessage({ type: 'success', text: res.message });
      setResettingUser(null);
      setNewPasswordInput('');
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <RefreshCw className="spin" size={32} color="var(--forest-green)" style={{ margin: '0 auto 1rem' }} />
        <p>Loading college administration console...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #FAF7EE, #F2ECE0)', border: '1px solid var(--border-cream)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <h2 style={{ fontSize: '1.6rem', margin: 0 }}>Dean / College Administration</h2>
              <span className="badge badge-champagne">Full Authority</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              AURA BLE System Oversight | Persistent SQLite Storage | University Policy Compliance
            </div>
          </div>

          {/* Export Report Quick Trigger */}
          <a
            href={api.getExportCsvUrl(1)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-gold"
            download
          >
            <Download size={16} /> Export TE-CSE-A Attendance CSV
          </a>
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-cream)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'System Overview' },
          { id: 'classes', label: `College Classes (${classes.length})` },
          { id: 'verification', label: `Enrolment Verification (${pendingStudents.length} Pending)` },
          { id: 'substitutions', label: 'Teacher Substitution' },
          { id: 'telephony', label: 'GFM & Parent IVR Queue' },
          { id: 'rules', label: 'Attendance Rules' },
          { id: 'students', label: 'Students Directory' },
          { id: 'teachers', label: 'Faculty Directory' },
          { id: 'audit', label: 'Audit Trail' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div style={{ padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', background: actionMessage.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)', color: actionMessage.type === 'error' ? 'var(--danger-text)' : 'var(--success-text)', border: `1px solid ${actionMessage.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {actionMessage.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="grid-4">
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Enrolled Students</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--forest-green)', margin: '0.2rem 0' }}>{overview?.totalStudents}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Across all departments</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Faculty Members</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--forest-green)', margin: '0.2rem 0' }}>{overview?.totalTeachers}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assigned GFMs & Lecturers</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attendance Sessions</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--forest-green)', margin: '0.2rem 0' }}>{overview?.totalSessions}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Conducted via BLE Beacons</div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid #E74C3C' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Low Attendance (&lt;75%)</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger-text)', margin: '0.2rem 0' }}>{overview?.lowAttendanceCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--danger-text)' }}>Defaulters Requiring Action</div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Administrative Fast Actions</div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setActiveTab('verification')}>
                <CheckCircle size={16} /> Verify Enrolments ({pendingStudents.length} Pending)
              </button>
              <button className="btn btn-secondary" onClick={() => setActiveTab('substitutions')}>
                <UserCheck size={16} /> Assign Teacher Substitution
              </button>
              <button className="btn btn-secondary" onClick={() => setActiveTab('telephony')}>
                <PhoneCall size={16} /> View Parent Call Queue ({overview?.pendingCalls} Pending)
              </button>
              <button className="btn btn-secondary" onClick={() => setActiveTab('rules')}>
                <Settings size={16} /> Configure Attendance Thresholds
              </button>
              <a href={api.getExportCsvUrl(1)} download className="btn btn-secondary">
                <Download size={16} /> Download Full CSV Report
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB: COLLEGE CLASSES DIRECTORY */}
      {activeTab === 'classes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <Users size={20} color="var(--forest-green)" />
                  College Classes & Divisions Directory
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  All registered academic classes, student counts, and assigned Guardian Faculty Members (GFM)
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddClass(!showAddClass)}
              >
                <Plus size={16} /> {showAddClass ? 'Cancel' : 'Add New Class'}
              </button>
            </div>

            {/* ADD CLASS FORM */}
            {showAddClass && (
              <form onSubmit={handleCreateClass} style={{ background: 'var(--bg-cream)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-cream)', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', margin: '0 0 1rem 0' }}>Register New College Class</h4>
                <div className="grid-4" style={{ marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Class Name</label>
                    <input
                      type="text"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="e.g. SE-IT-A, BE-MECH-B"
                      style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Department</label>
                    <select
                      value={newClassDept}
                      onChange={(e) => setNewClassDept(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                    >
                      <option value="1">Computer Engineering (CSE)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Academic Year & Div</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select
                        value={newClassYear}
                        onChange={(e) => setNewClassYear(e.target.value)}
                        style={{ width: '50%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                      >
                        <option value="FE">FE</option>
                        <option value="SE">SE</option>
                        <option value="TE">TE</option>
                        <option value="BE">BE</option>
                      </select>
                      <input
                        type="text"
                        value={newClassDivision}
                        onChange={(e) => setNewClassDivision(e.target.value)}
                        placeholder="Div"
                        style={{ width: '50%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Assigned GFM Faculty</label>
                    <select
                      value={newClassGfm}
                      onChange={(e) => setNewClassGfm(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                    >
                      <option value="">-- Select GFM Teacher --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name} (@{t.username})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddClass(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Class</button>
                </div>
              </form>
            )}

            {/* CLASSES TABLE */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Class ID</th>
                    <th>Class Name</th>
                    <th>Department</th>
                    <th>Academic Year</th>
                    <th>Division</th>
                    <th>Enrolled Students</th>
                    <th>Assigned Guardian Faculty (GFM)</th>
                    <th>Conducted Sessions</th>
                    <th>Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(c => (
                    <tr key={c.id}>
                      <td><strong>#{c.id}</strong></td>
                      <td>
                        <strong style={{ fontSize: '1rem', color: 'var(--forest-green)' }}>{c.name}</strong>
                      </td>
                      <td>{c.department_name} ({c.department_code})</td>
                      <td><span className="badge badge-champagne">{c.academic_year}</span></td>
                      <td><strong>{c.division}</strong></td>
                      <td>
                        <span className="badge badge-success">
                          {c.student_count || 0} Enrolled
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <select
                            value={c.gfm_teacher_id || ''}
                            onChange={(e) => handleAssignGFM(c.id, e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                          >
                            <option value="">Unassigned</option>
                            {teachers.map(t => (
                              <option key={t.id} value={t.id}>{t.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>{c.sessions_count || 0}</td>
                      <td>
                        <a
                          href={api.getExportCsvUrl(c.id)}
                          download
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                          title={`Export attendance CSV for ${c.name}`}
                        >
                          <Download size={13} /> Export CSV
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ENROLMENT VERIFICATION & CORRECTION */}
      {activeTab === 'verification' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* PENDING APPROVALS */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <CheckCircle size={20} color="var(--forest-green)" />
                Pending Student Enrolment Applications ({pendingStudents.length})
              </div>
              <span className="badge badge-warning">Awaiting Verification</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Review self-registered students. Ensure student ID, PRN, and authorized parent contact information align with official college admissions records before granting attendance privileges.
            </p>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Roll Number</th>
                    <th>PRN</th>
                    <th>Department & Class</th>
                    <th>Guardian Details</th>
                    <th>Decision Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No pending registrations. All current student accounts are verified.
                      </td>
                    </tr>
                  ) : (
                    pendingStudents.map(st => (
                      <tr key={st.id}>
                        <td>
                          <strong>{st.full_name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{st.username} | {st.email}</div>
                        </td>
                        <td>{st.roll_number}</td>
                        <td>{st.prn}</td>
                        <td>{st.department_name} ({st.class_name})</td>
                        <td>
                          <div>{st.guardian_name} ({st.guardian_relation})</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st.guardian_phone}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleApproveEnrollment(st.id, 'APPROVED')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleApproveEnrollment(st.id, 'REJECTED')}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* EDIT & CORRECT EXISTING ENROLMENTS */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Enrolled Students Database (Correction & Password Management)</div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{students.length} students</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>PRN</th>
                    <th>Class</th>
                    <th>Guardian Contact</th>
                    <th>Administrative Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(st => (
                    <tr key={st.id}>
                      <td><strong>{st.roll_number}</strong></td>
                      <td>
                        <div>{st.full_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.email}</div>
                      </td>
                      <td>{st.prn}</td>
                      <td>{st.class_name}</td>
                      <td>
                        <div>{st.guardian_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.guardian_phone}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => setEditingStudent({ ...st })}
                          >
                            Correct Profile
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => setResettingUser({ id: st.user_id, name: st.full_name, username: st.username })}
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEACHER SUBSTITUTION */}
      {activeTab === 'substitutions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <UserCheck size={20} color="var(--forest-green)" />
                Assign Teacher Substitution
              </div>
              <span className="badge badge-champagne">Enforced Permissions</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              When the regular teacher is absent, assigning a substitute teacher locks out the original teacher from starting that attendance session. Only the assigned substitute can activate the BLE beacon. Both original and substitute records are permanently preserved.
            </p>

            <form onSubmit={handleCreateSubstitution} className="grid-4" style={{ alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Lecture Slot</label>
                <select
                  value={subSlotId}
                  onChange={(e) => setSubSlotId(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                  required
                >
                  {timetable.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {slot.class_name} - {slot.subject_code} ({slot.day_of_week} {slot.start_time}-{slot.end_time}, Regular: {slot.teacher_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Assign Substitute Faculty</label>
                <select
                  value={subTeacherId}
                  onChange={(e) => setSubTeacherId(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                  required
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Date of Substitution</label>
                <input
                  type="date"
                  value={subDate}
                  onChange={(e) => setSubDate(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                  required
                />
              </div>

              <div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  <Plus size={16} /> Assign Substitute
                </button>
              </div>
            </form>
          </div>

          {/* ACTIVE SUBSTITUTIONS TABLE */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Registered Teacher Substitutions</div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{substitutions.length} active records</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Class & Slot</th>
                    <th>Original Faculty (Absent)</th>
                    <th>Assigned Substitute</th>
                    <th>Reason</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {substitutions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No substitutions currently recorded.</td>
                    </tr>
                  ) : (
                    substitutions.map(sub => (
                      <tr key={sub.id}>
                        <td><strong>{sub.date}</strong></td>
                        <td>{sub.class_name} - {sub.subject_code} ({sub.day_of_week} {sub.start_time})</td>
                        <td>
                          <span style={{ color: 'var(--danger-text)', fontWeight: 600 }}>{sub.original_teacher_name}</span>
                          <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>Locked Out</span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--forest-green)', fontWeight: 600 }}>{sub.substitute_teacher_name}</span>
                          <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>Authorized</span>
                        </td>
                        <td>{sub.reason}</td>
                        <td>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteSubstitution(sub.id)}
                            title="Revoke substitution"
                          >
                            <Trash2 size={14} /> Revoke
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TELEPHONY & PARENT CALL QUEUE */}
      {activeTab === 'telephony' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Explicit Status Banner */}
          <div className="telephony-banner">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <PhoneCall size={20} color={providerStatus?.isConfigured ? 'var(--forest-green)' : 'var(--danger-text)'} />
                <strong style={{ fontSize: '1rem' }}>
                  Provider: {providerStatus?.provider || 'Twilio Programmable Voice'}
                </strong>
                <span className={`badge ${providerStatus?.isConfigured ? 'badge-success' : 'badge-danger'}`}>
                  {providerStatus?.isConfigured ? 'CONFIGURED & READY' : 'NOT CONFIGURED (Real calling disabled)'}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {providerStatus?.statusMessage}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSyncCallQueue}>
              <RefreshCw size={14} /> Scan & Sync Low Attendance Defaulters (&lt;75%)
            </button>
          </div>

          {/* IVR Keypad Forwarding Flow Diagram */}
          <div className="card" style={{ background: '#FAF8F2' }}>
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '1rem' }}>
                Automated IVR Call Architecture & GFM Bridge
              </div>
              <span className="badge badge-champagne">TwiML Interactive Voice Response</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', textAlign: 'center', fontSize: '0.82rem' }}>
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}>
                <strong>Step 1: Outbound Call</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>System initiates voice call to registered parent mobile number</p>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}>
                <strong>Step 2: Voice Alert</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Speaks student name and current low attendance percentage</p>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}>
                <strong>Step 3: Keypad [1]</strong>
                <p style={{ color: 'var(--forest-green)', fontWeight: 600, marginTop: '4px' }}>Instantly bridges live call to Guardian Faculty Member (GFM)!</p>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}>
                <strong>Step 4: Keypad [2]</strong>
                <p style={{ color: 'var(--gold-dark)', fontWeight: 600, marginTop: '4px' }}>Parent acknowledges notification & logs confirmation</p>
              </div>
            </div>
          </div>

          {/* CALL QUEUE TABLE */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Parent Alert Call Queue</div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{callQueue.length} records</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Roll No</th>
                    <th>Current %</th>
                    <th>Guardian Name & Phone</th>
                    <th>Assigned GFM</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {callQueue.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.student_name}</strong></td>
                      <td>{item.roll_number}</td>
                      <td>
                        <span style={{ color: 'var(--danger-text)', fontWeight: 800 }}>{item.attendance_percentage}%</span>
                      </td>
                      <td>
                        <div>{item.guardian_name} ({item.guardian_relation})</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.guardian_phone}</div>
                      </td>
                      <td>
                        <div>{item.gfm_teacher_name || 'Unassigned'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--forest-green)' }}>{item.gfm_phone}</div>
                      </td>
                      <td>
                        <span className={`badge ${item.status === 'CONNECTED_TO_GFM' ? 'badge-success' : item.status === 'FAILED' ? 'badge-danger' : item.status === 'ACKNOWLEDGED' ? 'badge-champagne' : 'badge-warning'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => handleTriggerCall(item.id)}
                            title="Trigger automated phone call"
                          >
                            <PhoneCall size={14} /> Call Parent
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => handleSendSms(item.id)}
                            title="Send SMS attendance notice to guardian"
                          >
                            Send SMS
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RULES */}
      {activeTab === 'rules' && (
        <div className="card" style={{ maxWidth: '650px' }}>
          <div className="card-header">
            <div className="card-title">Attendance Policy Rules</div>
            <span className="badge badge-champagne">Global Settings</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Mandatory Attendance Threshold (%)
              </label>
              <input
                type="number"
                value={rules.min_threshold_percentage}
                onChange={(e) => setRules({ ...rules, min_threshold_percentage: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Students below this percentage are classified as defaulters and queued for parent calls.</span>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Session Timeout (Minutes)
              </label>
              <input
                type="number"
                value={rules.session_timeout_minutes}
                onChange={(e) => setRules({ ...rules, session_timeout_minutes: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="reqSelfie"
                checked={Boolean(rules.require_selfie)}
                onChange={(e) => setRules({ ...rules, require_selfie: e.target.checked ? 1 : 0 })}
              />
              <label htmlFor="reqSelfie" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Require Student Live Selfie Capture</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="reqBle"
                checked={Boolean(rules.require_ble)}
                onChange={(e) => setRules({ ...rules, require_ble: e.target.checked ? 1 : 0 })}
              />
              <label htmlFor="reqBle" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Require Bluetooth Low Energy Proximity Verification</label>
            </div>

            <button className="btn btn-primary" onClick={handleSaveRules}>
              Save Rules
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: STUDENTS DIRECTORY */}
      {activeTab === 'students' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Enrolled Students Directory</div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{students.length} students</span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>PRN</th>
                  <th>Student Name</th>
                  <th>Department & Class</th>
                  <th>Guardian Details</th>
                  <th>Assigned GFM</th>
                </tr>
              </thead>
              <tbody>
                {students.map(st => (
                  <tr key={st.id}>
                    <td><strong>{st.roll_number}</strong></td>
                    <td>{st.prn}</td>
                    <td>
                      <div>{st.full_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.email}</div>
                    </td>
                    <td>{st.department_name} ({st.class_name})</td>
                    <td>
                      <div>{st.guardian_name} ({st.guardian_relation})</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.guardian_phone}</div>
                    </td>
                    <td>{st.gfm_name || 'Not assigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: FACULTY DIRECTORY */}
      {activeTab === 'teachers' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Faculty Members</div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{teachers.length} teachers</span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Faculty Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.full_name}</strong></td>
                    <td>@{t.username}</td>
                    <td>{t.email}</td>
                    <td>{t.phone || '-'}</td>
                    <td>{t.created_at?.split(' ')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Chronological Audit Trail</div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Showing last 100 system events</span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.created_at}</td>
                    <td>
                      <span className="badge badge-champagne" style={{ fontFamily: 'monospace' }}>{log.action}</span>
                    </td>
                    <td>{log.user_full_name || 'System'}</td>
                    <td>{log.entity_type} #{log.entity_id}</td>
                    <td style={{ fontSize: '0.8rem' }}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ margin: 0 }}>Correct Student Enrolment Record</h3>
              <button onClick={() => setEditingStudent(null)} style={{ background: 'transparent' }}><RefreshCw size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Full Name</label>
                <input
                  type="text"
                  value={editingStudent.full_name || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })}
                  style={{ width: '100%', padding: '7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Roll Number</label>
                  <input
                    type="text"
                    value={editingStudent.roll_number || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, roll_number: e.target.value })}
                    style={{ width: '100%', padding: '7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>PRN</label>
                  <input
                    type="text"
                    value={editingStudent.prn || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, prn: e.target.value })}
                    style={{ width: '100%', padding: '7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Guardian Name</label>
                  <input
                    type="text"
                    value={editingStudent.guardian_name || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, guardian_name: e.target.value })}
                    style={{ width: '100%', padding: '7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Guardian Phone</label>
                  <input
                    type="text"
                    value={editingStudent.guardian_phone || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, guardian_phone: e.target.value })}
                    style={{ width: '100%', padding: '7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setEditingStudent(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveStudentEdit}>Save Corrections</button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ margin: 0 }}>Reset User Password</h3>
              <button onClick={() => setResettingUser(null)} style={{ background: 'transparent' }}><RefreshCw size={16} /></button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Resetting password for <strong>{resettingUser.name}</strong> (@{resettingUser.username}).
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>New Password</label>
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Min 6 characters"
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-cream)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setResettingUser(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdminResetPassword}>Confirm New Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
