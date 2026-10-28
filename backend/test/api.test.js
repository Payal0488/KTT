const { app } = require('../server');
const { db, initDatabase } = require('../config/db');
const assert = require('assert');

async function runTests() {
  initDatabase();
  console.log('--- Starting API Integration Tests ---');
  
  const server = app.listen(5099);
  const BASE_URL = 'http://127.0.0.1:5099';

  try {
    // 1. Health Check
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ONLINE');
    console.log('✓ Health check passed');

    // 2. Telephony Status Check (Must show unconfigured / never fake success)
    const telRes = await fetch(`${BASE_URL}/api/telephony/provider-status`);
    assert.strictEqual(telRes.status, 200);
    const telData = await telRes.json();
    assert.strictEqual(typeof telData.isConfigured, 'boolean');
    assert.strictEqual(telData.isConfigured, false, 'Telephony should report unconfigured without env vars');
    console.log('✓ Telephony provider unconfigured verification passed');

    // 3. Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login should succeed');
    const adminLoginData = await adminLoginRes.json();
    assert.ok(adminLoginData.token, 'Should return JWT token');
    assert.strictEqual(adminLoginData.user.role, 'admin');
    const adminToken = adminLoginData.token;
    console.log('✓ Admin login passed');

    // 4. Teacher Login
    const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'prof.patil', password: 'teacher123' })
    });
    assert.strictEqual(teacherLoginRes.status, 200);
    const teacherLoginData = await teacherLoginRes.json();
    const teacherToken = teacherLoginData.token;
    console.log('✓ Teacher login passed');

    // 5. Student Login & Real Attendance Percentage / Calculator Check
    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'student.aarav', password: 'student123' })
    });
    assert.strictEqual(studentLoginRes.status, 200);
    const studentLoginData = await studentLoginRes.json();
    const studentToken = studentLoginData.token;
    console.log('✓ Student login passed');

    // 6. Student Attendance Stats
    const statsRes = await fetch(`${BASE_URL}/api/student/attendance-stats`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert.strictEqual(statsRes.status, 200);
    const statsData = await statsRes.json();
    assert.ok(statsData.stats.totalConducted > 0, 'Total conducted sessions should be > 0');
    assert.ok(statsData.stats.overallPercentage > 0, 'Percentage should be computed');
    assert.ok(Array.isArray(statsData.stats.subjectStats), 'Should include subject-wise breakdown');
    console.log(`✓ Student stats verified: Aarav attendance = ${statsData.stats.overallPercentage}% (${statsData.stats.totalAttended}/${statsData.stats.totalConducted})`);

    // 7. Low Attendance Student Check (Rohan Verma: 50%)
    const rohanLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'student.rohan', password: 'student123' })
    });
    const rohanToken = (await rohanLoginRes.json()).token;
    const rohanStatsRes = await fetch(`${BASE_URL}/api/student/attendance-stats`, {
      headers: { 'Authorization': `Bearer ${rohanToken}` }
    });
    const rohanStats = await rohanStatsRes.json();
    assert.strictEqual(rohanStats.stats.isBelowThreshold, true, 'Rohan must be below 75% threshold');
    assert.ok(rohanStats.stats.requiredLecturesToCatchUp > 0, 'Must calculate required lectures to reach 75%');
    console.log(`✓ Low attendance & calculator verified: Rohan attendance = ${rohanStats.stats.overallPercentage}%, needs ${rohanStats.stats.requiredLecturesToCatchUp} consecutive lectures to reach 75%`);

    // 8. Teacher Session Creation & BLE Token Generation
    const startSessionRes = await fetch(`${BASE_URL}/api/teacher/start-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        classId: 1,
        subjectId: 1,
        ttlMinutes: 15
      })
    });
    assert.strictEqual(startSessionRes.status, 201);
    const sessionData = await startSessionRes.json();
    assert.ok(sessionData.session.sessionToken, 'Must generate BLE session token');
    assert.ok(sessionData.session.bleServiceUuid, 'Must generate BLE service UUID');
    console.log(`✓ Teacher session started: ID ${sessionData.session.id}, BLE Token: ${sessionData.session.sessionToken}`);

    // 9. Student Mark Attendance via BLE
    const markRes = await fetch(`${BASE_URL}/api/student/mark-attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        sessionId: sessionData.session.id,
        sessionToken: sessionData.session.sessionToken,
        rssi: -62
      })
    });
    assert.strictEqual(markRes.status, 201);
    const markData = await markRes.json();
    assert.strictEqual(markData.bleVerified, true);
    console.log('✓ Student attendance marked via BLE session payload');

    // 10. Duplicate Attendance Prevention
    const dupRes = await fetch(`${BASE_URL}/api/student/mark-attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        sessionId: sessionData.session.id,
        sessionToken: sessionData.session.sessionToken,
        rssi: -62
      })
    });
    assert.strictEqual(dupRes.status, 409, 'Duplicate attendance submission must be rejected with 409');
    console.log('✓ Duplicate attendance rejection verified');

    // 11. Teacher End Session & Auto-mark absent for non-attendees
    const endSessionRes = await fetch(`${BASE_URL}/api/teacher/end-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({ sessionId: sessionData.session.id })
    });
    assert.strictEqual(endSessionRes.status, 200);
    const endData = await endSessionRes.json();
    assert.ok(endData.autoMarkedAbsentCount >= 0);
    console.log(`✓ Teacher session ended: Auto-marked ${endData.autoMarkedAbsentCount} absent students`);

    // 12. Teacher Substitution Test
    // Clean up any pre-existing substitution for this slot on today's date to ensure test idempotency
    const today = new Date().toISOString().split('T')[0];
    db.prepare('DELETE FROM teacher_substitutions WHERE timetable_slot_id = ? AND date = ?').run(1, today);

    // Admin marks Prof. Patil absent on slot 1, assigns Prof. Shinde
    const subAssignRes = await fetch(`${BASE_URL}/api/admin/substitutions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        slotId: 1,
        substituteTeacherId: 4, // prof.shinde
        date: today,
        reason: 'Medical Leave'
      })
    });
    assert.strictEqual(subAssignRes.status, 201);
    console.log('✓ Admin assigned teacher substitution');

    // Regular teacher tries to start session on slot 1 -> MUST BE BLOCKED
    const blockedPatilRes = await fetch(`${BASE_URL}/api/teacher/start-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        slotId: 1,
        classId: 1,
        subjectId: 1
      })
    });
    assert.strictEqual(blockedPatilRes.status, 403, 'Original teacher must be blocked from starting substituted session');
    console.log('✓ Teacher substitution security lock verified (regular teacher blocked)');
    // Clean up test substitution so regular teacher can conduct sessions in subsequent runs / manual tests
    db.prepare('DELETE FROM teacher_substitutions WHERE timetable_slot_id = ? AND date = ?').run(1, today);

    // 13. Telephony Unconfigured Call Rejection (Never fake call)
    const callRes = await fetch(`${BASE_URL}/api/telephony/trigger-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ queueId: 1 })
    });
    assert.strictEqual(callRes.status, 503, 'Must return 503 when provider unconfigured, never fake call');
    console.log('✓ Unconfigured call rejection confirmed (No fake calls)');

    // 14. Report & CSV Export
    const csvRes = await fetch(`${BASE_URL}/api/reports/export-csv/1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(csvRes.status, 200);
    const csvContent = await csvRes.text();
    assert.ok(csvContent.includes('Roll Number'), 'CSV must contain headers');
    assert.ok(csvContent.includes('Aarav Sharma'), 'CSV must contain student records');
    console.log('✓ Attendance CSV export generated successfully');

    // 15. Student Self-Registration & Enrolment Verification Workflow
    const testUsername = `student.test${Date.now()}`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        email: `${testUsername}@college.edu`,
        password: 'password123',
        fullName: 'Test Enrolment Student',
        phone: '+919999999999',
        rollNumber: `TE-TEST-${Date.now().toString().slice(-4)}`,
        prn: `PRN${Date.now()}`,
        classId: 1,
        departmentId: 1,
        guardianName: 'Guardian Test',
        guardianPhone: '+919888888888'
      })
    });
    assert.strictEqual(regRes.status, 201, 'Student self-registration should succeed');
    const regData = await regRes.json();
    console.log('✓ Student self-registration passed');

    // 16. Admin Correction of Student Enrolment
    const updateRes = await fetch(`${BASE_URL}/api/admin/students/${regData.user.student.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        fullName: 'Test Enrolment Student (Corrected)',
        guardianName: 'Guardian Test Senior'
      })
    });
    assert.strictEqual(updateRes.status, 200);
    console.log('✓ Admin student profile correction verified');

    // 17. Password Reset Workflow
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUsername })
    });
    assert.strictEqual(forgotRes.status, 200);
    const forgotData = await forgotRes.json();
    assert.ok(forgotData.resetToken, 'Must generate password reset token');

    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: forgotData.resetToken,
        newPassword: 'newsecurepassword123'
      })
    });
    assert.strictEqual(resetRes.status, 200);

    // Verify login with new password
    const testLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password: 'newsecurepassword123' })
    });
    assert.strictEqual(testLoginRes.status, 200, 'Login with new password should succeed');
    console.log('✓ Secure password reset workflow verified');

    // 18. Admin Direct Password Reset
    const adminResetRes = await fetch(`${BASE_URL}/api/admin/users/${regData.user.id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ newPassword: 'adminassignedpassword123' })
    });
    assert.strictEqual(adminResetRes.status, 200);
    console.log('✓ Admin direct password reset verified');

    // 19. Monthly & Semester Attendance Summaries Verification
    assert.ok(Array.isArray(statsData.stats.monthlySummaries), 'Should contain monthly summaries array');
    assert.ok(statsData.stats.semesterSummary, 'Should contain semester summary object');
    assert.ok(statsData.stats.finalizedAbsent >= 0, 'Should calculate finalized absent lectures');
    console.log(`✓ Monthly and semester summaries verified (Final Absent: ${statsData.stats.finalizedAbsent})`);

    // 20. Telephony Unconfigured SMS Rejection (No fake SMS)
    const smsRes = await fetch(`${BASE_URL}/api/telephony/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ queueId: 1 })
    });
    assert.strictEqual(smsRes.status, 503, 'Must return 503 when provider is unconfigured, never fake SMS');
    console.log('✓ Unconfigured SMS dispatch rejection confirmed (No fake SMS)');

    console.log('\n>>> ALL 20 BACKEND INTEGRATION TESTS PASSED PERFECTLY! <<<');
  } catch (err) {
    console.error('Test failure:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
