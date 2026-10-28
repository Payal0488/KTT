const express = require('express');
const router = express.Router();
const path = require('path');
const { db, logAudit } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { uploadSelfie } = require('../middleware/upload');

// All student routes require student role
router.use(authenticateToken, authorizeRoles('student'));

// Helper: Ensure student profile exists
function getStudentOrThrow(req, res) {
  const student = db.prepare(`
    SELECT s.*, c.name as class_name, c.division, c.academic_year, d.name as department_name, d.code as department_code,
           u.full_name as gfm_name, u.phone as gfm_phone, u.email as gfm_email
    FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN departments d ON s.department_id = d.id
    LEFT JOIN users u ON c.gfm_teacher_id = u.id
    WHERE s.user_id = ?
  `).get(req.user.id);

  if (!student) {
    res.status(404).json({ error: 'Student profile not found for this account.' });
    return null;
  }
  return student;
}

// GET /api/student/profile
router.get('/profile', (req, res) => {
  const student = getStudentOrThrow(req, res);
  if (!student) return;

  res.json({
    student: {
      id: student.id,
      userId: req.user.id,
      fullName: req.user.full_name,
      email: req.user.email,
      phone: req.user.phone,
      rollNumber: student.roll_number,
      prn: student.prn,
      className: student.class_name,
      division: student.division,
      academicYear: student.academic_year,
      department: student.department_name,
      guardianName: student.guardian_name,
      guardianPhone: student.guardian_phone,
      guardianEmail: student.guardian_email,
      guardianRelation: student.guardian_relation,
      gfm: {
        name: student.gfm_name || 'Not assigned',
        phone: student.gfm_phone || '',
        email: student.gfm_email || ''
      }
    }
  });
});

// GET /api/student/timetable
router.get('/timetable', (req, res) => {
  const student = getStudentOrThrow(req, res);
  if (!student) return;

  const timetable = db.prepare(`
    SELECT ts.id, ts.day_of_week, ts.start_time, ts.end_time, ts.room_number,
           s.name as subject_name, s.code as subject_code, s.credits,
           u.full_name as teacher_name, u.email as teacher_email
    FROM timetable_slots ts
    JOIN subjects s ON ts.subject_id = s.id
    JOIN users u ON ts.teacher_id = u.id
    WHERE ts.class_id = ?
    ORDER BY 
      CASE ts.day_of_week
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
        ELSE 7
      END, ts.start_time ASC
  `).all(student.class_id);

  res.json({ timetable });
});

// GET /api/student/attendance-stats
router.get('/attendance-stats', (req, res) => {
  const student = getStudentOrThrow(req, res);
  if (!student) return;

  // Fetch configured rules
  const rules = db.prepare('SELECT * FROM attendance_rules LIMIT 1').get() || { min_threshold_percentage: 75.0, warning_threshold_percentage: 80.0 };
  const minThreshold = rules.min_threshold_percentage;

  // 1. All conducted sessions for this student's class
  const totalConducted = db.prepare(`
    SELECT COUNT(*) as count 
    FROM attendance_sessions 
    WHERE class_id = ? AND status IN ('COMPLETED', 'ACTIVE')
  `).get(student.class_id).count;

  // 2. Attended sessions for this student
  const totalAttended = db.prepare(`
    SELECT COUNT(*) as count
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE ar.student_id = ? AND ar.status = 'PRESENT' AND s.class_id = ?
  `).get(student.id, student.class_id).count;

  const finalizedAbsent = Math.max(0, totalConducted - totalAttended);

  const pendingVerification = db.prepare(`
    SELECT COUNT(*) as count
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE ar.student_id = ? AND s.class_id = ? AND ar.selfie_status = 'PENDING' AND ar.selfie_url IS NOT NULL
  `).get(student.id, student.class_id).count;

  const overallPercentage = totalConducted > 0 
    ? Number(((totalAttended / totalConducted) * 100).toFixed(1))
    : 0;

  // Monthly Summaries
  const monthRows = db.prepare(`
    SELECT DISTINCT substr(session_date, 1, 7) as month_key
    FROM attendance_sessions
    WHERE class_id = ? AND status IN ('COMPLETED', 'ACTIVE')
    ORDER BY month_key DESC
  `).all(student.class_id);

  const monthlySummaries = monthRows.map(m => {
    const mConducted = db.prepare(`
      SELECT COUNT(*) as count FROM attendance_sessions
      WHERE class_id = ? AND substr(session_date, 1, 7) = ? AND status IN ('COMPLETED', 'ACTIVE')
    `).get(student.class_id, m.month_key).count;

    const mAttended = db.prepare(`
      SELECT COUNT(*) as count FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE ar.student_id = ? AND s.class_id = ? AND substr(s.session_date, 1, 7) = ? AND ar.status = 'PRESENT'
    `).get(student.id, student.class_id, m.month_key).count;

    const mPercentage = mConducted > 0 ? Number(((mAttended / mConducted) * 100).toFixed(1)) : 0;

    return {
      monthKey: m.month_key,
      conducted: mConducted,
      attended: mAttended,
      absent: Math.max(0, mConducted - mAttended),
      percentage: mPercentage,
      isBelowThreshold: mPercentage < minThreshold && mConducted > 0
    };
  });

  // Semester Summary
  const semesterSummary = {
    term: `Academic Year ${student.academic_year || 'TE'} - Division ${student.division || 'A'}`,
    minThreshold,
    warningThreshold: rules.warning_threshold_percentage,
    totalConducted,
    totalAttended,
    finalizedAbsent,
    pendingVerification,
    overallPercentage,
    status: overallPercentage >= minThreshold ? 'ELIGIBLE' : 'DEFAULTER_WARNING'
  };

  // 3. Calculator logic
  // Formula:
  // If overallPercentage < minThreshold:
  // (A + X) / (N + X) >= T / 100
  // X * (1 - T/100) >= (T/100)*N - A
  // X >= ((T/100)*N - A) / (1 - T/100)
  const T = minThreshold / 100;
  let requiredLecturesToCatchUp = 0;
  let safeLecturesToBunk = 0;

  if (totalConducted > 0) {
    if (overallPercentage < minThreshold) {
      const numerator = (T * totalConducted) - totalAttended;
      const denominator = 1 - T;
      requiredLecturesToCatchUp = Math.ceil(numerator / denominator);
      if (requiredLecturesToCatchUp < 0) requiredLecturesToCatchUp = 0;
    } else {
      // Safe to miss: A / (N + Y) >= T => Y <= (A - T * N) / T
      const maxMiss = Math.floor((totalAttended - (T * totalConducted)) / T);
      safeLecturesToBunk = maxMiss >= 0 ? maxMiss : 0;
    }
  }

  // 4. Subject-wise breakdown
  const subjects = db.prepare(`
    SELECT id, name, code, credits FROM subjects WHERE department_id = ?
  `).all(student.department_id);

  const subjectStats = subjects.map(sub => {
    const conducted = db.prepare(`
      SELECT COUNT(*) as count
      FROM attendance_sessions
      WHERE class_id = ? AND subject_id = ? AND status IN ('COMPLETED', 'ACTIVE')
    `).get(student.class_id, sub.id).count;

    const attended = db.prepare(`
      SELECT COUNT(*) as count
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE ar.student_id = ? AND s.subject_id = ? AND ar.status = 'PRESENT'
    `).get(student.id, sub.id).count;

    const percentage = conducted > 0 
      ? Number(((attended / conducted) * 100).toFixed(1)) 
      : 0;

    let subCatchUp = 0;
    let subSafeBunk = 0;
    if (conducted > 0) {
      if (percentage < minThreshold) {
        subCatchUp = Math.ceil(((T * conducted) - attended) / (1 - T));
        if (subCatchUp < 0) subCatchUp = 0;
      } else {
        const canMiss = Math.floor((attended - (T * conducted)) / T);
        subSafeBunk = canMiss >= 0 ? canMiss : 0;
      }
    }

    return {
      subjectId: sub.id,
      name: sub.name,
      code: sub.code,
      credits: sub.credits,
      conducted,
      attended,
      percentage,
      isBelowThreshold: percentage < minThreshold && conducted > 0,
      requiredToCatchUp: subCatchUp,
      safeToMiss: subSafeBunk
    };
  });

  // 5. Detailed Attendance History
  const history = db.prepare(`
    SELECT ar.id, ar.status, ar.ble_verified, ar.ble_rssi, ar.ble_timestamp,
           ar.selfie_url, ar.selfie_status, ar.selfie_rejection_reason, ar.created_at,
           s.session_date, s.start_time, s.session_token,
           sub.name as subject_name, sub.code as subject_code,
           u.full_name as teacher_name
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    JOIN subjects sub ON s.subject_id = sub.id
    JOIN users u ON s.teacher_id = u.id
    WHERE ar.student_id = ?
    ORDER BY s.session_date DESC, s.start_time DESC
  `).all(student.id);

  res.json({
    stats: {
      totalConducted,
      totalAttended,
      finalizedAbsent,
      pendingVerification,
      overallPercentage,
      minThreshold,
      warningThreshold: rules.warning_threshold_percentage,
      isBelowThreshold: overallPercentage < minThreshold && totalConducted > 0,
      requiredLecturesToCatchUp,
      safeLecturesToBunk,
      monthlySummaries,
      semesterSummary,
      subjectStats
    },
    history
  });
});

// GET /api/student/active-session
router.get('/active-session', (req, res) => {
  const student = getStudentOrThrow(req, res);
  if (!student) return;

  // Find active session for student's class
  const activeSession = db.prepare(`
    SELECT s.id, s.session_token, s.ble_service_uuid, s.session_date, s.start_time, s.ttl_minutes,
           sub.name as subject_name, sub.code as subject_code,
           u.full_name as teacher_name,
           s.is_substitute,
           sub_u.full_name as substitute_teacher_name
    FROM attendance_sessions s
    JOIN subjects sub ON s.subject_id = sub.id
    JOIN users u ON s.teacher_id = u.id
    LEFT JOIN users sub_u ON s.substitute_id = sub_u.id
    WHERE s.class_id = ? AND s.status = 'ACTIVE'
    ORDER BY s.id DESC
    LIMIT 1
  `).get(student.class_id);

  if (!activeSession) {
    return res.json({ activeSession: null });
  }

  // Check if session has expired based on TTL
  const startTime = new Date(activeSession.start_time).getTime();
  const now = Date.now();
  const ttlMs = activeSession.ttl_minutes * 60 * 1000;

  if (now > startTime + ttlMs) {
    // Automatically close expired session
    db.prepare("UPDATE attendance_sessions SET status = 'EXPIRED' WHERE id = ?").run(activeSession.id);
    return res.json({ activeSession: null, expired: true });
  }

  // Check if student already submitted attendance for this active session
  const alreadyMarked = db.prepare(`
    SELECT id, status, ble_verified, selfie_status 
    FROM attendance_records 
    WHERE session_id = ? AND student_id = ?
  `).get(activeSession.id, student.id);

  res.json({
    activeSession: {
      ...activeSession,
      expiresAt: new Date(startTime + ttlMs).toISOString(),
      remainingSeconds: Math.max(0, Math.floor((startTime + ttlMs - now) / 1000)),
      alreadyMarked: alreadyMarked || null
    }
  });
});

// POST /api/student/mark-attendance
router.post('/mark-attendance', uploadSelfie.single('selfie'), (req, res) => {
  try {
    const student = getStudentOrThrow(req, res);
    if (!student) return;

    const { sessionId, sessionToken, rssi, bleMac } = req.body;

    if (!sessionId || !sessionToken) {
      return res.status(400).json({ error: 'Session ID and Session Token are required.' });
    }

    const session = db.prepare(`
      SELECT * FROM attendance_sessions WHERE id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found.' });
    }

    if (session.status !== 'ACTIVE') {
      return res.status(400).json({ error: `Session is closed. Current status: ${session.status}` });
    }

    // Verify student belongs to this class
    if (session.class_id !== student.class_id) {
      return res.status(403).json({ error: 'You are not enrolled in the class for this attendance session.' });
    }

    // Verify session token
    if (session.session_token.toUpperCase() !== sessionToken.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Invalid BLE session token. Must match teacher broadcast.' });
    }

    // Check expiration
    const startTime = new Date(session.start_time).getTime();
    const ttlMs = session.ttl_minutes * 60 * 1000;
    if (Date.now() > startTime + ttlMs) {
      db.prepare("UPDATE attendance_sessions SET status = 'EXPIRED' WHERE id = ?").run(session.id);
      return res.status(400).json({ error: 'Attendance session has expired. Verification window closed.' });
    }

    // Prevent duplicate attendance
    const existingRecord = db.prepare(`
      SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?
    `).get(session.id, student.id);

    if (existingRecord) {
      return res.status(409).json({ error: 'Attendance already submitted for this session. Duplicate requests are rejected.' });
    }

    // Handle Selfie Upload
    let selfiePath = null;
    if (req.file) {
      selfiePath = `/uploads/selfies/${req.file.filename}`;
    }

    const parsedRssi = rssi ? parseInt(rssi, 10) : -65;

    const result = db.prepare(`
      INSERT INTO attendance_records (
        session_id, student_id, status, ble_verified, ble_rssi, ble_timestamp,
        selfie_url, selfie_status, marked_by
      ) VALUES (?, ?, 'PRESENT', 1, ?, CURRENT_TIMESTAMP, ?, 'PENDING', 'STUDENT_BLE')
    `).run(
      session.id,
      student.id,
      parsedRssi,
      selfiePath
    );

    logAudit(
      req.user.id,
      'ATTENDANCE_MARKED_BLE',
      'attendance_records',
      result.lastInsertRowid,
      `Student ${student.roll_number} verified attendance for session ${session.id} (RSSI: ${parsedRssi} dBm)`
    );

    res.status(201).json({
      message: 'Attendance submitted successfully with BLE verification and selfie!',
      recordId: result.lastInsertRowid,
      status: 'PRESENT',
      bleVerified: true,
      selfieStatus: 'PENDING',
      selfieUrl: selfiePath
    });
  } catch (err) {
    console.error('Mark attendance error:', err);
    res.status(500).json({ error: 'Failed to record attendance.', details: err.message });
  }
});

module.exports = router;
