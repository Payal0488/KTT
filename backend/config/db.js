const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'college_attendance.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
      full_name TEXT NOT NULL,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      password_reset_token TEXT,
      password_reset_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      academic_year TEXT NOT NULL,
      division TEXT NOT NULL,
      name TEXT NOT NULL,
      gfm_teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      roll_number TEXT NOT NULL,
      prn TEXT UNIQUE NOT NULL,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      guardian_name TEXT NOT NULL,
      guardian_phone TEXT NOT NULL,
      guardian_email TEXT,
      guardian_relation TEXT DEFAULT 'Parent',
      profile_photo TEXT,
      ble_device_mac TEXT,
      enrollment_status TEXT DEFAULT 'APPROVED' CHECK(enrollment_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      credits INTEGER DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS timetable_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room_number TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_substitutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timetable_slot_id INTEGER NOT NULL REFERENCES timetable_slots(id) ON DELETE CASCADE,
      original_teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      substitute_teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      reason TEXT,
      assigned_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timetable_slot_id INTEGER REFERENCES timetable_slots(id) ON DELETE SET NULL,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_substitute INTEGER DEFAULT 0,
      substitute_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_date TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      ttl_minutes INTEGER DEFAULT 10,
      session_token TEXT UNIQUE NOT NULL,
      ble_service_uuid TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'EXPIRED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT', 'EXCUSED')),
      ble_verified INTEGER DEFAULT 0,
      ble_rssi INTEGER,
      ble_timestamp DATETIME,
      selfie_url TEXT,
      selfie_status TEXT DEFAULT 'PENDING' CHECK(selfie_status IN ('PENDING', 'APPROVED', 'REJECTED')),
      selfie_reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      selfie_rejection_reason TEXT,
      marked_by TEXT DEFAULT 'STUDENT_BLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS parent_call_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      gfm_teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      guardian_phone TEXT NOT NULL,
      attendance_percentage REAL NOT NULL,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'CALLING', 'CONNECTED_TO_GFM', 'FAILED', 'ACKNOWLEDGED')),
      call_sid TEXT,
      notes TEXT,
      triggered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      min_threshold_percentage REAL DEFAULT 75.0,
      warning_threshold_percentage REAL DEFAULT 80.0,
      session_timeout_minutes INTEGER DEFAULT 10,
      require_selfie INTEGER DEFAULT 1,
      require_ble INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Run safe migrations for existing tables
  try {
    const studentCols = db.prepare("PRAGMA table_info(students)").all().map(c => c.name);
    if (!studentCols.includes('enrollment_status')) {
      db.exec("ALTER TABLE students ADD COLUMN enrollment_status TEXT DEFAULT 'APPROVED';");
    }
    if (!studentCols.includes('approved_by')) {
      db.exec("ALTER TABLE students ADD COLUMN approved_by INTEGER REFERENCES users(id);");
    }
    if (!studentCols.includes('approved_at')) {
      db.exec("ALTER TABLE students ADD COLUMN approved_at DATETIME;");
    }

    const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!userCols.includes('is_active')) {
      db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;");
    }
    if (!userCols.includes('password_reset_token')) {
      db.exec("ALTER TABLE users ADD COLUMN password_reset_token TEXT;");
    }
    if (!userCols.includes('password_reset_expires')) {
      db.exec("ALTER TABLE users ADD COLUMN password_reset_expires DATETIME;");
    }
  } catch (mErr) {
    console.warn('Migration note:', mErr.message);
  }

  // Ensure default attendance rules row exists
  const existingRules = db.prepare('SELECT id FROM attendance_rules LIMIT 1').get();
  if (!existingRules) {
    db.prepare(`
      INSERT INTO attendance_rules (min_threshold_percentage, warning_threshold_percentage, session_timeout_minutes, require_selfie, require_ble)
      VALUES (75.0, 80.0, 10, 1, 1)
    `).run();
  }
}

function logAudit(userId, action, entityType, entityId, details, ipAddress = null) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId || null, action, entityType, String(entityId || ''), typeof details === 'object' ? JSON.stringify(details) : String(details || ''), ipAddress);
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = {
  db,
  initDatabase,
  logAudit,
  dbPath
};
