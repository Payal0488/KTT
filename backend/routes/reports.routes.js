const express = require('express');
const router = express.Router();
const { db } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/reports/class-summary/:classId
router.get('/class-summary/:classId', authorizeRoles('teacher', 'admin'), (req, res) => {
  const { classId } = req.params;

  const targetClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  if (!targetClass) {
    return res.status(404).json({ error: 'Class not found.' });
  }

  const students = db.prepare(`
    SELECT s.id, s.roll_number, s.prn, s.guardian_name, s.guardian_phone,
           u.full_name as student_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.class_id = ?
    ORDER BY s.roll_number ASC
  `).all(classId);

  const subjects = db.prepare(`
    SELECT s.id, s.name, s.code FROM subjects s
    WHERE s.department_id = ?
  `).all(targetClass.department_id);

  // Total sessions for this class
  const totalSessions = db.prepare(`
    SELECT COUNT(*) as count FROM attendance_sessions
    WHERE class_id = ? AND status IN ('COMPLETED', 'ACTIVE')
  `).get(classId).count;

  const summary = students.map(st => {
    const attendedSessions = db.prepare(`
      SELECT COUNT(*) as count FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE ar.student_id = ? AND s.class_id = ? AND ar.status = 'PRESENT'
    `).get(st.id, classId).count;

    const percentage = totalSessions > 0
      ? Number(((attendedSessions / totalSessions) * 100).toFixed(1))
      : 0;

    // Subject-wise percentage
    const subjectWise = {};
    subjects.forEach(sub => {
      const subConducted = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_sessions
        WHERE class_id = ? AND subject_id = ? AND status IN ('COMPLETED', 'ACTIVE')
      `).get(classId, sub.id).count;

      const subAttended = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE ar.student_id = ? AND s.subject_id = ? AND ar.status = 'PRESENT'
      `).get(st.id, sub.id).count;

      subjectWise[sub.code] = {
        conducted: subConducted,
        attended: subAttended,
        percentage: subConducted > 0 ? Number(((subAttended / subConducted) * 100).toFixed(1)) : 0
      };
    });

    return {
      studentId: st.id,
      rollNumber: st.roll_number,
      prn: st.prn,
      studentName: st.student_name,
      guardianName: st.guardian_name,
      guardianPhone: st.guardian_phone,
      totalSessions,
      attendedSessions,
      percentage,
      isDefaulter: percentage < 75.0 && totalSessions > 0,
      subjectWise
    };
  });

  res.json({
    class: targetClass,
    subjects,
    totalSessions,
    defaultersCount: summary.filter(s => s.isDefaulter).length,
    students: summary
  });
});

// GET /api/reports/export-csv/:classId
router.get('/export-csv/:classId', authorizeRoles('teacher', 'admin'), (req, res) => {
  const { classId } = req.params;

  const targetClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  if (!targetClass) {
    return res.status(404).send('Class not found.');
  }

  const students = db.prepare(`
    SELECT s.id, s.roll_number, s.prn, s.guardian_name, s.guardian_phone,
           u.full_name as student_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.class_id = ?
    ORDER BY s.roll_number ASC
  `).all(classId);

  const subjects = db.prepare(`
    SELECT s.id, s.name, s.code FROM subjects s
    WHERE s.department_id = ?
  `).all(targetClass.department_id);

  const totalSessions = db.prepare(`
    SELECT COUNT(*) as count FROM attendance_sessions
    WHERE class_id = ? AND status IN ('COMPLETED', 'ACTIVE')
  `).get(classId).count;

  // Build CSV headers
  const subjectHeaders = subjects.map(s => `"${s.code} (%)"`).join(',');
  let csv = `"Roll Number","PRN","Student Name","Guardian Phone","Total Lectures","Attended",${subjectHeaders},"Overall %","Status"\n`;

  students.forEach(st => {
    const attendedSessions = db.prepare(`
      SELECT COUNT(*) as count FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE ar.student_id = ? AND s.class_id = ? AND ar.status = 'PRESENT'
    `).get(st.id, classId).count;

    const percentage = totalSessions > 0
      ? Number(((attendedSessions / totalSessions) * 100).toFixed(1))
      : 0;

    const subPcts = subjects.map(sub => {
      const subConducted = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_sessions
        WHERE class_id = ? AND subject_id = ? AND status IN ('COMPLETED', 'ACTIVE')
      `).get(classId, sub.id).count;

      const subAttended = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE ar.student_id = ? AND s.subject_id = ? AND ar.status = 'PRESENT'
      `).get(st.id, sub.id).count;

      return subConducted > 0 ? `${((subAttended / subConducted) * 100).toFixed(1)}%` : '0%';
    }).join(',');

    const statusLabel = percentage >= 75 ? 'ELIGIBLE' : 'DEFAULTER';

    csv += `"${st.roll_number}","${st.prn}","${st.student_name}","${st.guardian_phone}",${totalSessions},${attendedSessions},${subPcts},"${percentage}%","${statusLabel}"\n`;
  });

  res.header('Content-Type', 'text/csv');
  res.attachment(`Attendance_Report_${targetClass.name}_${new Date().toISOString().split('T')[0]}.csv`);
  res.send(csv);
});

// GET /api/reports/audit-logs
router.get('/audit-logs', authorizeRoles('admin'), (req, res) => {
  const logs = db.prepare(`
    SELECT al.*, u.full_name as user_full_name, u.role as user_role, u.username
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.id DESC
    LIMIT 100
  `).all();

  res.json({ logs });
});

module.exports = router;
