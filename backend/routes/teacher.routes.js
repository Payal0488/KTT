const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db, logAudit } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken, authorizeRoles('teacher', 'admin'));

// GET /api/teacher/dashboard-overview
router.get('/dashboard-overview', (req, res) => {
  const teacherId = req.user.id;
  const todayDate = new Date().toISOString().split('T')[0];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = daysOfWeek[new Date().getDay()];

  // 1. Assigned classes & subjects
  const assignedSlots = db.prepare(`
    SELECT ts.id as slot_id, ts.day_of_week, ts.start_time, ts.end_time, ts.room_number,
           c.id as class_id, c.name as class_name, c.division, c.academic_year,
           s.id as subject_id, s.name as subject_name, s.code as subject_code
    FROM timetable_slots ts
    JOIN classes c ON ts.class_id = c.id
    JOIN subjects s ON ts.subject_id = s.id
    WHERE ts.teacher_id = ?
    ORDER BY ts.start_time ASC
  `).all(teacherId);

  // 2. Check for substitutions where current teacher is the SUBSTITUTE for today
  const substituteSlots = db.prepare(`
    SELECT sub.id as substitution_id, sub.date, sub.reason,
           ts.id as slot_id, ts.day_of_week, ts.start_time, ts.end_time, ts.room_number,
           c.id as class_id, c.name as class_name,
           s.id as subject_id, s.name as subject_name, s.code as subject_code,
           orig_u.full_name as original_teacher_name, orig_u.id as original_teacher_id
    FROM teacher_substitutions sub
    JOIN timetable_slots ts ON sub.timetable_slot_id = ts.id
    JOIN classes c ON ts.class_id = c.id
    JOIN subjects s ON ts.subject_id = s.id
    JOIN users orig_u ON sub.original_teacher_id = orig_u.id
    WHERE sub.substitute_teacher_id = ? AND sub.date = ?
  `).all(teacherId, todayDate);

  // 3. Check if current teacher is marked absent (substituted) for today
  const myAbsentSubstitutions = db.prepare(`
    SELECT sub.id, sub.date, sub.reason, sub.timetable_slot_id,
           sub_u.full_name as substitute_teacher_name
    FROM teacher_substitutions sub
    JOIN users sub_u ON sub.substitute_teacher_id = sub_u.id
    WHERE sub.original_teacher_id = ? AND sub.date = ?
  `).all(teacherId, todayDate);

  // 4. Any currently active session for this teacher
  const activeSession = db.prepare(`
    SELECT s.*, c.name as class_name, sub.name as subject_name, sub.code as subject_code
    FROM attendance_sessions s
    JOIN classes c ON s.class_id = c.id
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE s.teacher_id = ? AND s.status = 'ACTIVE'
    ORDER BY s.id DESC
    LIMIT 1
  `).get(teacherId);

  // 5. Total sessions conducted by this teacher
  const totalSessionsConducted = db.prepare(`
    SELECT COUNT(*) as count FROM attendance_sessions WHERE teacher_id = ?
  `).get(teacherId).count;

  // 6. Pending selfie reviews count
  const pendingSelfiesCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE s.teacher_id = ? AND ar.selfie_status = 'PENDING' AND ar.selfie_url IS NOT NULL
  `).get(teacherId).count;

  res.json({
    teacher: {
      id: req.user.id,
      fullName: req.user.full_name,
      email: req.user.email
    },
    today: {
      date: todayDate,
      day: currentDay
    },
    assignedSlots,
    substituteSlots,
    myAbsentSubstitutions,
    activeSession,
    totalSessionsConducted,
    pendingSelfiesCount
  });
});

// POST /api/teacher/start-session
router.post('/start-session', (req, res) => {
  try {
    const teacherId = req.user.id;
    const { slotId, classId, subjectId, ttlMinutes = 10, isSubstitute = false } = req.body;

    if (!classId || !subjectId) {
      return res.status(400).json({ error: 'Class ID and Subject ID are required.' });
    }

    const todayDate = new Date().toISOString().split('T')[0];

    // Check Substitution lockdown
    if (slotId) {
      // Is regular teacher marked absent on this slot for today?
      const substitution = db.prepare(`
        SELECT * FROM teacher_substitutions 
        WHERE timetable_slot_id = ? AND date = ?
      `).get(slotId, todayDate);

      if (substitution) {
        if (substitution.original_teacher_id === teacherId && !req.body.overrideSubstitution) {
          return res.status(403).json({
            error: 'You have been marked absent/substituted by Admin for this lecture. Only the designated substitute teacher can start this attendance session. (You can clear the slot to start an ad-hoc session, or check override).',
            canOverride: true
          });
        }
        if (substitution.substitute_teacher_id !== teacherId && req.user.role !== 'admin' && !req.body.overrideSubstitution) {
          return res.status(403).json({
            error: 'You are neither the regular teacher nor the assigned substitute teacher for this lecture.',
            canOverride: true
          });
        }
      }
    }

    // Auto-close any existing active session for this teacher
    db.prepare(`
      UPDATE attendance_sessions 
      SET status = 'COMPLETED', end_time = CURRENT_TIMESTAMP 
      WHERE teacher_id = ? AND status = 'ACTIVE'
    `).run(teacherId);

    // Generate BLE advertising parameters
    const sessionToken = uuidv4().substring(0, 8).toUpperCase();
    const bleServiceUuid = uuidv4();
    const startTime = new Date().toISOString();

    let substituteId = null;
    if (isSubstitute) {
      substituteId = teacherId;
    }

    const insertResult = db.prepare(`
      INSERT INTO attendance_sessions (
        timetable_slot_id, class_id, subject_id, teacher_id, is_substitute,
        substitute_id, session_date, start_time, ttl_minutes, session_token,
        ble_service_uuid, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      slotId || null,
      classId,
      subjectId,
      teacherId,
      isSubstitute ? 1 : 0,
      substituteId,
      todayDate,
      startTime,
      parseInt(ttlMinutes, 10) || 10,
      sessionToken,
      bleServiceUuid
    );

    const sessionId = insertResult.lastInsertRowid;

    logAudit(
      teacherId,
      'START_ATTENDANCE_SESSION',
      'attendance_sessions',
      sessionId,
      `Teacher started BLE attendance session (Token: ${sessionToken}, TTL: ${ttlMinutes}m)`
    );

    res.status(201).json({
      message: 'Attendance session started successfully. BLE Beacon is active.',
      session: {
        id: sessionId,
        classId,
        subjectId,
        teacherId,
        sessionToken,
        bleServiceUuid,
        startTime,
        ttlMinutes: parseInt(ttlMinutes, 10) || 10,
        status: 'ACTIVE',
        // BLE Beacon payload formatted for teacher phone advertising
        blePayload: {
          header: 'COLL-ATT',
          sessionId,
          token: sessionToken,
          serviceUuid: bleServiceUuid,
          ttlMinutes: parseInt(ttlMinutes, 10) || 10
        }
      }
    });
  } catch (err) {
    console.error('Start session error:', err);
    res.status(500).json({ error: 'Failed to start attendance session.', details: err.message });
  }
});

// POST /api/teacher/end-session
router.post('/end-session', (req, res) => {
  try {
    const { sessionId } = req.body;
    const teacherId = req.user.id;

    const session = db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (session.teacher_id !== teacherId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to close this session.' });
    }

    // 1. Find all students in this class who have NOT yet marked attendance
    const unrecordedStudents = db.prepare(`
      SELECT s.id 
      FROM students s 
      WHERE s.class_id = ? 
      AND s.id NOT IN (
        SELECT ar.student_id FROM attendance_records ar WHERE ar.session_id = ?
      )
    `).all(session.class_id, session.id);

    // 2. Mark remaining unrecorded students as ABSENT
    const insertAbsent = db.prepare(`
      INSERT INTO attendance_records (session_id, student_id, status, ble_verified, marked_by)
      VALUES (?, ?, 'ABSENT', 0, 'SYSTEM_SESSION_CLOSE')
    `);

    unrecordedStudents.forEach(st => {
      insertAbsent.run(session.id, st.id);
    });

    // 3. Mark session COMPLETED
    db.prepare(`
      UPDATE attendance_sessions 
      SET status = 'COMPLETED', end_time = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(sessionId);

    logAudit(teacherId, 'END_ATTENDANCE_SESSION', 'attendance_sessions', sessionId, `Session closed. ${unrecordedStudents.length} students auto-marked ABSENT.`);

    res.json({
      message: 'Attendance session ended successfully.',
      sessionId,
      autoMarkedAbsentCount: unrecordedStudents.length
    });
  } catch (err) {
    console.error('End session error:', err);
    res.status(500).json({ error: 'Failed to end session.', details: err.message });
  }
});

// GET /api/teacher/session-roster/:sessionId
router.get('/session-roster/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  const session = db.prepare(`
    SELECT s.*, c.name as class_name, sub.name as subject_name, sub.code as subject_code,
           u.full_name as teacher_name
    FROM attendance_sessions s
    JOIN classes c ON s.class_id = c.id
    JOIN subjects sub ON s.subject_id = sub.id
    JOIN users u ON s.teacher_id = u.id
    WHERE s.id = ?
  `).get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  // Get all students enrolled in this class with their attendance status for this session
  const roster = db.prepare(`
    SELECT s.id as student_id, s.roll_number, s.prn, s.guardian_name, s.guardian_phone,
           u.full_name as student_name, u.email as student_email,
           ar.id as record_id, ar.status as attendance_status,
           ar.ble_verified, ar.ble_rssi, ar.ble_timestamp,
           ar.selfie_url, ar.selfie_status, ar.selfie_rejection_reason,
           ar.marked_by, ar.created_at as marked_at
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN attendance_records ar ON s.id = ar.student_id AND ar.session_id = ?
    WHERE s.class_id = ?
    ORDER BY s.roll_number ASC
  `).all(sessionId, session.class_id);

  const summary = {
    totalStudents: roster.length,
    presentCount: roster.filter(r => r.attendance_status === 'PRESENT').length,
    absentCount: roster.filter(r => r.attendance_status === 'ABSENT' || !r.attendance_status).length,
    pendingSelfies: roster.filter(r => r.selfie_status === 'PENDING' && r.selfie_url).length
  };

  res.json({ session, roster, summary });
});

// POST /api/teacher/review-selfie
router.post('/review-selfie', (req, res) => {
  try {
    const { recordId, decision, rejectionReason } = req.body;
    const reviewerId = req.user.id;

    if (!recordId || !['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: "Record ID and valid decision ('APPROVED' or 'REJECTED') are required." });
    }

    if (decision === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required when rejecting a selfie.' });
    }

    const record = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    // Update selfie status
    // If rejected, also mark status as ABSENT or keep PRESENT with flag
    const newAttendanceStatus = decision === 'REJECTED' ? 'ABSENT' : 'PRESENT';

    db.prepare(`
      UPDATE attendance_records
      SET selfie_status = ?,
          selfie_reviewed_by = ?,
          selfie_rejection_reason = ?,
          status = ?
      WHERE id = ?
    `).run(
      decision,
      reviewerId,
      decision === 'REJECTED' ? rejectionReason : null,
      newAttendanceStatus,
      recordId
    );

    logAudit(
      reviewerId,
      'SELFIE_REVIEW',
      'attendance_records',
      recordId,
      `Selfie ${decision}. Reason: ${rejectionReason || 'Approved'}. Status updated to ${newAttendanceStatus}.`
    );

    res.json({
      message: `Selfie review recorded: ${decision}`,
      recordId,
      decision,
      attendanceStatus: newAttendanceStatus
    });
  } catch (err) {
    console.error('Selfie review error:', err);
    res.status(500).json({ error: 'Failed to record selfie review.', details: err.message });
  }
});

// POST /api/teacher/manual-override
router.post('/manual-override', (req, res) => {
  try {
    const { sessionId, studentId, status, reason } = req.body;
    const teacherId = req.user.id;

    if (!sessionId || !studentId || !['PRESENT', 'ABSENT', 'EXCUSED'].includes(status)) {
      return res.status(400).json({ error: 'Session ID, Student ID, and valid status (PRESENT, ABSENT, EXCUSED) are required.' });
    }

    // Check if record exists
    const existing = db.prepare('SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?').get(sessionId, studentId);

    if (existing) {
      db.prepare(`
        UPDATE attendance_records
        SET status = ?, marked_by = 'TEACHER_MANUAL', selfie_rejection_reason = ?
        WHERE id = ?
      `).run(status, reason ? `Override note: ${reason}` : null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO attendance_records (session_id, student_id, status, ble_verified, marked_by, selfie_rejection_reason)
        VALUES (?, ?, ?, 0, 'TEACHER_MANUAL', ?)
      `).run(sessionId, studentId, status, reason ? `Override note: ${reason}` : null);
    }

    logAudit(teacherId, 'MANUAL_ATTENDANCE_OVERRIDE', 'attendance_records', `${sessionId}-${studentId}`, `Manual status set to ${status}. Reason: ${reason || 'Teacher override'}`);

    res.json({ message: `Attendance updated to ${status} for student.` });
  } catch (err) {
    console.error('Manual override error:', err);
    res.status(500).json({ error: 'Failed to override attendance.', details: err.message });
  }
});

// GET /api/teacher/students - All students & records accessible by Teacher & GFM
router.get('/students', (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM attendance_rules LIMIT 1').get() || { min_threshold_percentage: 75.0 };
    const minThreshold = rules.min_threshold_percentage;

    const students = db.prepare(`
      SELECT s.*, 
             u.full_name as student_name, u.email as student_email, u.phone as student_phone,
             c.name as class_name, c.division, c.academic_year,
             d.name as department_name, d.code as department_code,
             gfm.full_name as gfm_name, gfm.phone as gfm_phone, gfm.email as gfm_email
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN users gfm ON c.gfm_teacher_id = gfm.id
      ORDER BY c.name ASC, s.roll_number ASC
    `).all();

    const studentRecords = students.map(st => {
      const conducted = db.prepare(`
        SELECT COUNT(*) as count 
        FROM attendance_sessions 
        WHERE class_id = ? AND status IN ('COMPLETED', 'ACTIVE')
      `).get(st.class_id).count;

      const attended = db.prepare(`
        SELECT COUNT(*) as count 
        FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE ar.student_id = ? AND ar.status = 'PRESENT'
      `).get(st.id).count;

      const percentage = conducted > 0 ? Number(((attended / conducted) * 100).toFixed(1)) : 0;
      const absent = Math.max(0, conducted - attended);

      return {
        ...st,
        conducted,
        attended,
        absent,
        percentage,
        isDefaulter: percentage < minThreshold && conducted > 0
      };
    });

    res.json({ students: studentRecords });
  } catch (err) {
    console.error('Teacher get students error:', err);
    res.status(500).json({ error: 'Failed to fetch student records.', details: err.message });
  }
});

// GET /api/teacher/classes - All college classes accessible by faculty
router.get('/classes', (req, res) => {
  const classes = db.prepare(`
    SELECT c.*, d.name as department_name, d.code as department_code,
           u.full_name as gfm_teacher_name
    FROM classes c
    JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON c.gfm_teacher_id = u.id
    ORDER BY c.name ASC
  `).all();
  res.json({ classes });
});

// GET /api/teacher/subjects - All college subjects accessible by faculty
router.get('/subjects', (req, res) => {
  const subjects = db.prepare(`
    SELECT s.*, d.name as department_name, d.code as department_code
    FROM subjects s
    JOIN departments d ON s.department_id = d.id
    ORDER BY s.code ASC
  `).all();
  res.json({ subjects });
});

module.exports = router;
