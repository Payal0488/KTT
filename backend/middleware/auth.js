const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'hackathon_ble_smart_college_attendance_super_secret_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, email, role, full_name, phone FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists or session invalid.' });
    }

    req.user = user;

    // If student, attach student details
    if (user.role === 'student') {
      const studentDetails = db.prepare(`
        SELECT s.*, c.name as class_name, d.name as department_name, c.gfm_teacher_id
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN departments d ON s.department_id = d.id
        WHERE s.user_id = ?
      `).get(user.id);
      req.student = studentDetails;
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.', details: err.message });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}. Current role: ${req.user ? req.user.role : 'none'}`
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  JWT_SECRET
};
