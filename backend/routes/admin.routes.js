const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db, logAudit } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken, authorizeRoles('admin'));

// GET /api/admin/overview
router.get('/overview', (req, res) => {
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  const totalTeachers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'").get().count;
  const totalClasses = db.prepare('SELECT COUNT(*) as count FROM classes').get().count;
  const totalSubjects = db.prepare('SELECT COUNT(*) as count FROM subjects').get().count;
  const totalSessions = db.prepare('SELECT COUNT(*) as count FROM attendance_sessions').get().count;
  const pendingCalls = db.prepare("SELECT COUNT(*) as count FROM parent_call_queue WHERE status = 'PENDING'").get().count;
  
  // Calculate students below threshold
  const rules = db.prepare('SELECT * FROM attendance_rules LIMIT 1').get() || { min_threshold_percentage: 75.0 };
  const allStudents = db.prepare(`
    SELECT s.id, s.roll_number, s.class_id, u.full_name
    FROM students s
    JOIN users u ON s.user_id = u.id
  `).all();

  let lowAttendanceCount = 0;
  allStudents.forEach(st => {
    const conducted = db.prepare(`
      SELECT COUNT(*) as count FROM attendance_sessions WHERE class_id = ? AND status IN ('COMPLETED', 'ACTIVE')
    `).get(st.class_id).count;

    if (conducted > 0) {
      const attended = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_records WHERE student_id = ? AND status = 'PRESENT'
      `).get(st.id).count;
      const pct = (attended / conducted) * 100;
      if (pct < rules.min_threshold_percentage) {
        lowAttendanceCount++;
      }
    }
  });

  res.json({
    totalStudents,
    totalTeachers,
    totalClasses,
    totalSubjects,
    totalSessions,
    pendingCalls,
    lowAttendanceCount,
    rules
  });
});

// GET /api/admin/rules
router.get('/rules', (req, res) => {
  const rules = db.prepare('SELECT * FROM attendance_rules LIMIT 1').get();
  res.json({ rules });
});

// PUT /api/admin/rules
router.put('/rules', (req, res) => {
  const { minThreshold, warningThreshold, sessionTimeout, requireSelfie, requireBle } = req.body;
  db.prepare(`
    UPDATE attendance_rules
    SET min_threshold_percentage = ?,
        warning_threshold_percentage = ?,
        session_timeout_minutes = ?,
        require_selfie = ?,
        require_ble = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    parseFloat(minThreshold) || 75.0,
    parseFloat(warningThreshold) || 80.0,
    parseInt(sessionTimeout, 10) || 10,
    requireSelfie ? 1 : 0,
    requireBle ? 1 : 0
  );

  logAudit(req.user.id, 'UPDATE_RULES', 'attendance_rules', 1, req.body);
  res.json({ message: 'Attendance rules updated successfully.' });
});

// GET /api/admin/students
router.get('/students', (req, res) => {
  const students = db.prepare(`
    SELECT s.*, u.username, u.email, u.full_name, u.phone as student_phone,
           c.name as class_name, d.name as department_name,
           gfm.full_name as gfm_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN classes c ON s.class_id = c.id
    JOIN departments d ON s.department_id = d.id
    LEFT JOIN users gfm ON c.gfm_teacher_id = gfm.id
    ORDER BY s.roll_number ASC
  `).all();
  res.json({ students });
});

// GET /api/admin/teachers
router.get('/teachers', (req, res) => {
  const teachers = db.prepare(`
    SELECT id, username, email, full_name, phone, created_at
    FROM users
    WHERE role = 'teacher'
    ORDER BY full_name ASC
  `).all();
  res.json({ teachers });
});

// POST /api/admin/teachers
router.post('/teachers', async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body;
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ error: 'Username, email, password, and full name are required.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, full_name, phone)
      VALUES (?, ?, ?, 'teacher', ?, ?)
    `).run(username, email, hash, fullName, phone || null);

    logAudit(req.user.id, 'CREATE_TEACHER', 'users', result.lastInsertRowid, `Created teacher ${fullName} (${username})`);
    res.status(201).json({ message: 'Teacher created successfully', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create teacher.', details: err.message });
  }
});

// GET /api/admin/departments
router.get('/departments', (req, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY name ASC').all();
  res.json({ departments });
});

// GET /api/admin/classes
router.get('/classes', (req, res) => {
  const classes = db.prepare(`
    SELECT c.*, d.name as department_name, d.code as department_code,
           u.full_name as gfm_teacher_name,
           (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id) as student_count,
           (SELECT COUNT(*) FROM attendance_sessions ses WHERE ses.class_id = c.id) as sessions_count
    FROM classes c
    JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON c.gfm_teacher_id = u.id
    ORDER BY c.name ASC
  `).all();
  res.json({ classes });
});

// POST /api/admin/classes - Add new class
router.post('/classes', (req, res) => {
  try {
    const { name, departmentId, academicYear, division, gfmTeacherId } = req.body;
    if (!name || !departmentId || !division) {
      return res.status(400).json({ error: 'Class name, department, and division are required.' });
    }

    const result = db.prepare(`
      INSERT INTO classes (name, department_id, academic_year, division, gfm_teacher_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), departmentId, academicYear || 'TE', division.trim().toUpperCase(), gfmTeacherId || null);

    logAudit(req.user.id, 'CREATE_CLASS', 'classes', result.lastInsertRowid, `Created class ${name}`);
    res.status(201).json({ message: 'Class created successfully', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create class.', details: err.message });
  }
});

// PUT /api/admin/classes/:id/gfm
router.put('/classes/:id/gfm', (req, res) => {
  const { gfmTeacherId } = req.body;
  const classId = req.params.id;

  db.prepare('UPDATE classes SET gfm_teacher_id = ? WHERE id = ?').run(gfmTeacherId || null, classId);
  logAudit(req.user.id, 'ASSIGN_GFM', 'classes', classId, `Assigned GFM teacher ID ${gfmTeacherId}`);
  res.json({ message: 'Guardian Faculty Member (GFM) assigned successfully.' });
});

// GET /api/admin/subjects
router.get('/subjects', (req, res) => {
  const subjects = db.prepare(`
    SELECT s.*, d.name as department_name, d.code as department_code
    FROM subjects s
    JOIN departments d ON s.department_id = d.id
    ORDER BY s.code ASC
  `).all();
  res.json({ subjects });
});

// GET /api/admin/timetable
router.get('/timetable', (req, res) => {
  const timetable = db.prepare(`
    SELECT ts.*, c.name as class_name, s.name as subject_name, s.code as subject_code,
           u.full_name as teacher_name
    FROM timetable_slots ts
    JOIN classes c ON ts.class_id = c.id
    JOIN subjects s ON ts.subject_id = s.id
    JOIN users u ON ts.teacher_id = u.id
    ORDER BY c.name ASC, 
      CASE ts.day_of_week
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
        ELSE 7
      END, ts.start_time ASC
  `).all();
  res.json({ timetable });
});

// POST /api/admin/timetable
router.post('/timetable', (req, res) => {
  try {
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, roomNumber } = req.body;
    if (!classId || !subjectId || !teacherId || !dayOfWeek || !startTime || !endTime || !roomNumber) {
      return res.status(400).json({ error: 'All timetable slot fields are required.' });
    }

    const result = db.prepare(`
      INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(classId, subjectId, teacherId, dayOfWeek, startTime, endTime, roomNumber);

    logAudit(req.user.id, 'CREATE_TIMETABLE_SLOT', 'timetable_slots', result.lastInsertRowid, req.body);
    res.status(201).json({ message: 'Timetable slot created successfully', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create timetable slot.', details: err.message });
  }
});

// --- TEACHER SUBSTITUTION SYSTEM ---
// GET /api/admin/substitutions
router.get('/substitutions', (req, res) => {
  const substitutions = db.prepare(`
    SELECT sub.*, 
           ts.day_of_week, ts.start_time, ts.end_time, ts.room_number,
           c.name as class_name,
           s.name as subject_name, s.code as subject_code,
           orig_u.full_name as original_teacher_name, orig_u.email as original_teacher_email,
           sub_u.full_name as substitute_teacher_name, sub_u.email as substitute_teacher_email,
           admin_u.full_name as assigned_by_name
    FROM teacher_substitutions sub
    JOIN timetable_slots ts ON sub.timetable_slot_id = ts.id
    JOIN classes c ON ts.class_id = c.id
    JOIN subjects s ON ts.subject_id = s.id
    JOIN users orig_u ON sub.original_teacher_id = orig_u.id
    JOIN users sub_u ON sub.substitute_teacher_id = sub_u.id
    LEFT JOIN users admin_u ON sub.assigned_by_admin_id = admin_u.id
    ORDER BY sub.date DESC, sub.id DESC
  `).all();
  res.json({ substitutions });
});

// POST /api/admin/substitutions
router.post('/substitutions', (req, res) => {
  try {
    const { slotId, substituteTeacherId, date, reason } = req.body;
    const adminId = req.user.id;

    if (!slotId || !substituteTeacherId || !date) {
      return res.status(400).json({ error: 'Timetable Slot ID, Substitute Teacher ID, and Date are required.' });
    }

    // Get original slot and teacher
    const slot = db.prepare('SELECT * FROM timetable_slots WHERE id = ?').get(slotId);
    if (!slot) {
      return res.status(404).json({ error: 'Timetable slot not found.' });
    }

    if (slot.teacher_id === parseInt(substituteTeacherId, 10)) {
      return res.status(400).json({ error: 'Substitute teacher cannot be the same as the original teacher for this slot.' });
    }

    // Check if duplicate substitution already exists for this slot on this date
    const existing = db.prepare(`
      SELECT id FROM teacher_substitutions WHERE timetable_slot_id = ? AND date = ?
    `).get(slotId, date);

    if (existing) {
      return res.status(409).json({ error: 'A substitution has already been registered for this slot on this date.' });
    }

    const result = db.prepare(`
      INSERT INTO teacher_substitutions (
        timetable_slot_id, original_teacher_id, substitute_teacher_id, date, reason, assigned_by_admin_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      slotId,
      slot.teacher_id,
      substituteTeacherId,
      date,
      reason || 'Teacher absent / official leave',
      adminId
    );

    logAudit(
      adminId,
      'ASSIGN_SUBSTITUTE_TEACHER',
      'teacher_substitutions',
      result.lastInsertRowid,
      `Marked Teacher ID ${slot.teacher_id} absent for slot ${slotId} on ${date}. Assigned Substitute Teacher ID ${substituteTeacherId}. Reason: ${reason}`
    );

    res.status(201).json({
      message: 'Teacher substitution assigned successfully. Regular teacher locked; only substitute can start session.',
      substitutionId: result.lastInsertRowid,
      originalTeacherId: slot.teacher_id,
      substituteTeacherId,
      date
    });
  } catch (err) {
    console.error('Substitution error:', err);
    res.status(500).json({ error: 'Failed to assign teacher substitution.', details: err.message });
  }
});

// DELETE /api/admin/substitutions/:id
router.delete('/substitutions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sub = db.prepare('SELECT * FROM teacher_substitutions WHERE id = ?').get(id);
    if (!sub) {
      return res.status(404).json({ error: 'Substitution record not found.' });
    }

    db.prepare('DELETE FROM teacher_substitutions WHERE id = ?').run(id);
    logAudit(req.user.id, 'DELETE_SUBSTITUTION', 'teacher_substitutions', id, 'Substitution revoked by admin.');

    res.json({ message: 'Teacher substitution revoked successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke substitution.', details: err.message });
  }
});

// --- STUDENT ENROLMENT & VERIFICATION MANAGEMENT ---

// GET /api/admin/pending-students
router.get('/pending-students', (req, res) => {
  const pending = db.prepare(`
    SELECT s.*, u.username, u.email, u.full_name, u.phone as student_phone,
           c.name as class_name, d.name as department_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN classes c ON s.class_id = c.id
    JOIN departments d ON s.department_id = d.id
    WHERE s.enrollment_status = 'PENDING_APPROVAL'
    ORDER BY s.id DESC
  `).all();
  res.json({ pending });
});

// PUT /api/admin/students/:id/approve
router.put('/students/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body; // 'APPROVED' or 'REJECTED'
    const adminId = req.user.id;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be 'APPROVED' or 'REJECTED'." });
    }

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.' });
    }

    db.prepare(`
      UPDATE students 
      SET enrollment_status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, adminId, id);

    logAudit(adminId, 'ENROLLMENT_DECISION', 'students', id, `Enrolment set to ${status}. Note: ${note || 'Admin decision'}`);

    res.json({ message: `Student enrolment has been ${status.toLowerCase()} successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update enrolment status.', details: err.message });
  }
});

// PUT /api/admin/students/:id (Correct enrolment mistakes)
router.put('/students/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      phone,
      rollNumber,
      prn,
      classId,
      departmentId,
      guardianName,
      guardianPhone,
      guardianEmail,
      guardianRelation
    } = req.body;

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.' });
    }

    // Update students table
    db.prepare(`
      UPDATE students
      SET roll_number = ?, prn = ?, class_id = ?, department_id = ?,
          guardian_name = ?, guardian_phone = ?, guardian_email = ?, guardian_relation = ?
      WHERE id = ?
    `).run(
      rollNumber || student.roll_number,
      prn || student.prn,
      classId || student.class_id,
      departmentId || student.department_id,
      guardianName || student.guardian_name,
      guardianPhone || student.guardian_phone,
      guardianEmail !== undefined ? guardianEmail : student.guardian_email,
      guardianRelation || student.guardian_relation,
      id
    );

    // Update associated users row
    if (fullName || phone) {
      db.prepare(`
        UPDATE users
        SET full_name = COALESCE(?, full_name),
            phone = COALESCE(?, phone)
        WHERE id = ?
      `).run(fullName || null, phone || null, student.user_id);
    }

    logAudit(req.user.id, 'UPDATE_STUDENT_PROFILE', 'students', id, `Updated student profile ${rollNumber} (${fullName})`);

    res.json({ message: 'Student profile updated and verified successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update student profile.', details: err.message });
  }
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    logAudit(req.user.id, 'ADMIN_RESET_PASSWORD', 'users', id, `Admin reset password for user ID ${id}`);

    res.json({ message: 'User password reset successfully by administrator.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset user password.', details: err.message });
  }
});

module.exports = router;
