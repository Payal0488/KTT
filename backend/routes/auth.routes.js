const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, logAudit } = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    const user = db.prepare(`
      SELECT * FROM users WHERE username = ? OR email = ?
    `).get(username.trim(), username.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact college administration.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    let studentData = null;
    if (user.role === 'student') {
      studentData = db.prepare(`
        SELECT s.*, c.name as class_name, d.name as department_name, c.gfm_teacher_id
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN departments d ON s.department_id = d.id
        WHERE s.user_id = ?
      `).get(user.id);

      if (studentData && studentData.enrollment_status === 'REJECTED') {
        return res.status(403).json({ error: 'Your student enrollment has been rejected. Please contact college administration.' });
      }
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logAudit(user.id, 'USER_LOGIN', 'users', user.id, `User logged in from ${req.ip}`, req.ip);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        phone: user.phone,
        student: studentData
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      fullName: req.user.full_name,
      phone: req.user.phone,
      student: req.student || null
    }
  });
});

// POST /api/auth/register-student
router.post('/register-student', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      phone,
      rollNumber,
      prn,
      classId,
      className,
      departmentId,
      guardianName,
      guardianPhone,
      guardianEmail,
      guardianRelation
    } = req.body;

    let targetDeptId = parseInt(departmentId, 10) || 1;
    let targetClassId = classId ? parseInt(classId, 10) : null;

    // Handle manual class name input if provided
    if (className && typeof className === 'string' && className.trim()) {
      const customName = className.trim();
      const existingClass = db.prepare('SELECT id, department_id FROM classes WHERE LOWER(name) = LOWER(?)').get(customName);
      if (existingClass) {
        targetClassId = existingClass.id;
        targetDeptId = existingClass.department_id;
      } else {
        const parts = customName.split('-');
        const academicYear = parts[0] ? parts[0].trim() : 'TE';
        const division = parts.length > 2 ? parts[2].trim() : (parts.length > 1 ? parts[1].trim() : 'A');

        const newClass = db.prepare(`
          INSERT INTO classes (department_id, academic_year, division, name)
          VALUES (?, ?, ?, ?)
        `).run(targetDeptId, academicYear, division, customName);
        targetClassId = newClass.lastInsertRowid;
      }
    }

    if (!targetClassId) {
      targetClassId = 1;
    }

    const trimmedUsername = username ? String(username).trim() : '';
    const trimmedEmail = email ? String(email).trim().toLowerCase() : '';
    const trimmedFullName = fullName ? String(fullName).trim() : '';
    const trimmedRoll = rollNumber ? String(rollNumber).trim() : '';
    const trimmedPRN = prn ? String(prn).trim() : '';
    const trimmedGuardianName = guardianName ? String(guardianName).trim() : '';
    const trimmedGuardianPhone = guardianPhone ? String(guardianPhone).trim() : '';

    if (!trimmedUsername) return res.status(400).json({ error: 'Account username is required.' });
    if (!trimmedEmail) return res.status(400).json({ error: 'College email is required.' });
    if (!password) return res.status(400).json({ error: 'Account password is required.' });
    if (!trimmedFullName) return res.status(400).json({ error: 'Full name is required.' });
    if (!trimmedRoll) return res.status(400).json({ error: 'Student roll number is required.' });
    if (!trimmedPRN) return res.status(400).json({ error: 'University PRN / Enrolment ID is required.' });
    if (!trimmedGuardianName) return res.status(400).json({ error: 'Guardian / Parent name is required.' });
    if (!trimmedGuardianPhone) return res.status(400).json({ error: 'Guardian / Parent phone number is required.' });

    // Check unique username, email, prn
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(trimmedUsername, trimmedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already taken.' });
    }

    const existingPRN = db.prepare('SELECT id FROM students WHERE prn = ?').get(trimmedPRN);
    if (existingPRN) {
      return res.status(400).json({ error: 'PRN already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRes = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, full_name, phone)
      VALUES (?, ?, ?, 'student', ?, ?)
    `).run(trimmedUsername, trimmedEmail, passwordHash, trimmedFullName, phone || null);

    const studentRes = db.prepare(`
      INSERT INTO students (user_id, roll_number, prn, class_id, department_id, guardian_name, guardian_phone, guardian_email, guardian_relation, enrollment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED')
    `).run(
      userRes.lastInsertRowid,
      trimmedRoll,
      trimmedPRN,
      targetClassId,
      targetDeptId,
      trimmedGuardianName,
      trimmedGuardianPhone,
      guardianEmail || null,
      guardianRelation || 'Father'
    );

    logAudit(userRes.lastInsertRowid, 'REGISTER_STUDENT', 'students', studentRes.lastInsertRowid, `New student registered: ${trimmedFullName} (${trimmedRoll})`);

    const token = jwt.sign(
      { id: userRes.lastInsertRowid, username: trimmedUsername, role: 'student' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Student registered successfully',
      token,
      user: {
        id: userRes.lastInsertRowid,
        username: trimmedUsername,
        email: trimmedEmail,
        role: 'student',
        fullName: trimmedFullName,
        phone: phone || null,
        student: {
          id: studentRes.lastInsertRowid,
          roll_number: trimmedRoll,
          prn: trimmedPRN,
          class_id: targetClassId,
          department_id: targetDeptId
        }
      }
    });
  } catch (err) {
    console.error('Student registration error:', err);
    res.status(500).json({ error: 'Failed to register student.', details: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Username or email is required.' });
    }

    const user = db.prepare('SELECT id, email, username FROM users WHERE username = ? OR email = ?').get(identifier.trim(), identifier.trim().toLowerCase());
    if (!user) {
      // Don't reveal account absence for security, return standard message
      return res.json({ message: 'If an account exists with that identifier, a password reset link has been dispatched.' });
    }

    const resetToken = require('crypto').randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?').run(resetToken, expiresAt, user.id);
    logAudit(user.id, 'PASSWORD_RESET_REQUESTED', 'users', user.id, `Password reset token requested for @${user.username}`);

    res.json({
      message: 'Password reset token generated. In a production college environment this is emailed or sent via SMS.',
      resetToken, // Provided for prototype demonstration
      expiresIn: '1 hour'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process password reset request.', details: err.message });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE password_reset_token = ?').get(token.trim());
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    if (new Date(user.password_reset_expires).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Password reset token has expired. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    db.prepare('UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?').run(hash, user.id);
    logAudit(user.id, 'PASSWORD_RESET_COMPLETED', 'users', user.id, 'Password was updated successfully.');

    res.json({ message: 'Password has been reset successfully. You may now sign in with your new password.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password.', details: err.message });
  }
});

module.exports = router;
