const bcrypt = require('bcryptjs');
const { db, initDatabase, logAudit } = require('./db');
const { v4: uuidv4 } = require('uuid');

async function seedData() {
  initDatabase();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log('Database already contains records. Skipping seed.');
    return;
  }

  console.log('Seeding initial demo data...');

  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const teacherPassword = await bcrypt.hash('teacher123', salt);
  const studentPassword = await bcrypt.hash('student123', salt);

  // 1. Create Users
  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, role, full_name, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const adminRes = insertUser.run('admin', 'admin@college.edu', adminPassword, 'admin', 'Dr. Arvind Kulkarni (Admin - Demo)', '+919800000001');
  const tPatilRes = insertUser.run('prof.patil', 'patil@college.edu', teacherPassword, 'teacher', 'Prof. Rajesh Patil (Regular Teacher - Demo)', '+919800000002');
  const tDeshmukhRes = insertUser.run('prof.deshmukh', 'deshmukh@college.edu', teacherPassword, 'teacher', 'Prof. Snehal Deshmukh (GFM & Teacher - Demo)', '+919800000003');
  const tShindeRes = insertUser.run('prof.shinde', 'shinde@college.edu', teacherPassword, 'teacher', 'Prof. Amit Shinde (Substitute Teacher - Demo)', '+919800000004');

  const sAaravUser = insertUser.run('student.aarav', 'aarav@college.edu', studentPassword, 'student', 'Aarav Sharma (Student - Demo)', '+919800000005');
  const sAnanyaUser = insertUser.run('student.ananya', 'ananya@college.edu', studentPassword, 'student', 'Ananya Iyer (Student - Demo)', '+919800000006');
  const sRohanUser = insertUser.run('student.rohan', 'rohan@college.edu', studentPassword, 'student', 'Rohan Verma (Student - Demo)', '+919800000007');
  const sPriyaUser = insertUser.run('student.priya', 'priya@college.edu', studentPassword, 'student', 'Priya Nair (Student - Demo)', '+919800000008');
  const sAdityaUser = insertUser.run('student.aditya', 'aditya@college.edu', studentPassword, 'student', 'Aditya Joshi (Student - Demo)', '+919800000009');

  // 2. Departments
  const insertDept = db.prepare('INSERT INTO departments (name, code) VALUES (?, ?)');
  const deptCSE = insertDept.run('Computer Engineering', 'CSE');
  const deptIT = insertDept.run('Information Technology', 'IT');

  // 3. Classes
  const insertClass = db.prepare('INSERT INTO classes (department_id, academic_year, division, name, gfm_teacher_id) VALUES (?, ?, ?, ?, ?)');
  const classTE = insertClass.run(deptCSE.lastInsertRowid, 'TE', 'A', 'TE-CSE-A', tDeshmukhRes.lastInsertRowid);
  const classBE = insertClass.run(deptCSE.lastInsertRowid, 'BE', 'A', 'BE-CSE-A', tPatilRes.lastInsertRowid);

  // 4. Students details
  const insertStudent = db.prepare(`
    INSERT INTO students (user_id, roll_number, prn, class_id, department_id, guardian_name, guardian_phone, guardian_email, guardian_relation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const studentAarav = insertStudent.run(sAaravUser.lastInsertRowid, 'TE-CSE-01', 'PRN2024001', classTE.lastInsertRowid, deptCSE.lastInsertRowid, 'Mr. Suresh Sharma', '+919876543210', 'suresh.sharma@example.com', 'Father');
  const studentAnanya = insertStudent.run(sAnanyaUser.lastInsertRowid, 'TE-CSE-02', 'PRN2024002', classTE.lastInsertRowid, deptCSE.lastInsertRowid, 'Mrs. Meena Iyer', '+919876543211', 'meena.iyer@example.com', 'Mother');
  const studentRohan = insertStudent.run(sRohanUser.lastInsertRowid, 'TE-CSE-03', 'PRN2024003', classTE.lastInsertRowid, deptCSE.lastInsertRowid, 'Mr. Ramesh Verma', '+919876543212', 'ramesh.verma@example.com', 'Father');
  const studentPriya = insertStudent.run(sPriyaUser.lastInsertRowid, 'TE-CSE-04', 'PRN2024004', classTE.lastInsertRowid, deptCSE.lastInsertRowid, 'Dr. K. Nair', '+919876543213', 'k.nair@example.com', 'Father');
  const studentAditya = insertStudent.run(sAdityaUser.lastInsertRowid, 'TE-CSE-05', 'PRN2024005', classTE.lastInsertRowid, deptCSE.lastInsertRowid, 'Mr. Nitin Joshi', '+919876543214', 'nitin.joshi@example.com', 'Father');

  const studentIds = [
    studentAarav.lastInsertRowid,
    studentAnanya.lastInsertRowid,
    studentRohan.lastInsertRowid,
    studentPriya.lastInsertRowid,
    studentAditya.lastInsertRowid
  ];

  // 5. Subjects
  const insertSubject = db.prepare('INSERT INTO subjects (name, code, department_id, credits) VALUES (?, ?, ?, ?)');
  const subDBMS = insertSubject.run('Database Management Systems', 'CS301', deptCSE.lastInsertRowid, 4);
  const subCN = insertSubject.run('Computer Networks', 'CS302', deptCSE.lastInsertRowid, 4);
  const subOS = insertSubject.run('Operating Systems', 'CS303', deptCSE.lastInsertRowid, 3);
  const subSE = insertSubject.run('Software Engineering', 'CS304', deptCSE.lastInsertRowid, 3);

  // 6. Timetable Slots
  const insertSlot = db.prepare(`
    INSERT INTO timetable_slots (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const slot1 = insertSlot.run(classTE.lastInsertRowid, subDBMS.lastInsertRowid, tPatilRes.lastInsertRowid, 'Monday', '09:00', '10:00', 'Room 302');
  const slot2 = insertSlot.run(classTE.lastInsertRowid, subCN.lastInsertRowid, tDeshmukhRes.lastInsertRowid, 'Monday', '10:15', '11:15', 'Room 302');
  const slot3 = insertSlot.run(classTE.lastInsertRowid, subOS.lastInsertRowid, tPatilRes.lastInsertRowid, 'Tuesday', '09:00', '10:00', 'Room 304');
  const slot4 = insertSlot.run(classTE.lastInsertRowid, subSE.lastInsertRowid, tDeshmukhRes.lastInsertRowid, 'Wednesday', '11:30', '12:30', 'Room 302');
  const slot5 = insertSlot.run(classTE.lastInsertRowid, subDBMS.lastInsertRowid, tPatilRes.lastInsertRowid, 'Thursday', '14:00', '15:00', 'Room 302');

  // 7. Seed Past Attendance Sessions & Real Records
  const insertSession = db.prepare(`
    INSERT INTO attendance_sessions (timetable_slot_id, class_id, subject_id, teacher_id, is_substitute, session_date, start_time, end_time, session_token, ble_service_uuid, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
  `);

  const insertRecord = db.prepare(`
    INSERT INTO attendance_records (session_id, student_id, status, ble_verified, ble_rssi, ble_timestamp, selfie_status, marked_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const pastDates = [
    '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20',
    '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27'
  ];

  // Attendance matrix:
  // Aarav: 7 / 8 (87.5%)
  // Ananya: 8 / 8 (100%)
  // Rohan: 4 / 8 (50%) -> Under 75%
  // Priya: 6 / 8 (75%)
  // Aditya: 5 / 8 (62.5%) -> Under 75%
  const attendanceMatrix = [
    // [Aarav, Ananya, Rohan, Priya, Aditya]
    [1, 1, 0, 1, 1], // Session 1 (CS301)
    [1, 1, 1, 1, 0], // Session 2 (CS302)
    [1, 1, 0, 1, 1], // Session 3 (CS301)
    [0, 1, 0, 0, 0], // Session 4 (CS303)
    [1, 1, 1, 1, 1], // Session 5 (CS304)
    [1, 1, 1, 0, 1], // Session 6 (CS301)
    [1, 1, 0, 1, 0], // Session 7 (CS302)
    [1, 1, 1, 1, 1], // Session 8 (CS301)
  ];

  pastDates.forEach((date, idx) => {
    const subjectId = (idx % 2 === 0) ? subDBMS.lastInsertRowid : subCN.lastInsertRowid;
    const teacherId = (idx % 2 === 0) ? tPatilRes.lastInsertRowid : tDeshmukhRes.lastInsertRowid;
    const slotId = (idx % 2 === 0) ? slot1.lastInsertRowid : slot2.lastInsertRowid;

    const sRes = insertSession.run(
      slotId,
      classTE.lastInsertRowid,
      subjectId,
      teacherId,
      0,
      date,
      `${date} 09:00:00`,
      `${date} 09:55:00`,
      uuidv4().substring(0, 8).toUpperCase(),
      uuidv4()
    );

    const sessionId = sRes.lastInsertRowid;

    studentIds.forEach((sId, sIdx) => {
      const isPresent = attendanceMatrix[idx][sIdx] === 1;
      insertRecord.run(
        sessionId,
        sId,
        isPresent ? 'PRESENT' : 'ABSENT',
        isPresent ? 1 : 0,
        isPresent ? -62 - Math.floor(Math.random() * 15) : null,
        isPresent ? `${date} 09:05:00` : null,
        isPresent ? 'APPROVED' : 'PENDING',
        isPresent ? 'STUDENT_BLE' : 'TEACHER_MANUAL'
      );
    });
  });

  // 8. Seed parent call queue for students under 75% threshold (Rohan: 50%, Aditya: 62.5%)
  const insertCallQueue = db.prepare(`
    INSERT INTO parent_call_queue (student_id, gfm_teacher_id, guardian_phone, attendance_percentage, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertCallQueue.run(
    studentRohan.lastInsertRowid,
    tDeshmukhRes.lastInsertRowid,
    '+919876543212',
    50.0,
    'PENDING',
    'Attendance critical (50.0%). Auto-warning queued for GFM follow-up with father Mr. Ramesh Verma.'
  );

  insertCallQueue.run(
    studentAditya.lastInsertRowid,
    tDeshmukhRes.lastInsertRowid,
    '+919876543214',
    62.5,
    'PENDING',
    'Attendance below 75% threshold (62.5%). Automated call required.'
  );

  logAudit(adminRes.lastInsertRowid, 'SEED_DATABASE', 'SYSTEM', 1, 'Initial demo dataset seeded successfully');

  console.log('Seed completed successfully! Demo accounts created:');
  console.log('  Admin:    admin / admin123');
  console.log('  Teacher:  prof.patil / teacher123');
  console.log('  GFM/Teach: prof.deshmukh / teacher123');
  console.log('  Substitute: prof.shinde / teacher123');
  console.log('  Student:  student.aarav / student123 (87.5% attendance)');
  console.log('  Student:  student.rohan / student123 (50.0% attendance, alerts active)');
}

module.exports = { seedData };

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
