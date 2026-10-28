const express = require('express');
const router = express.Router();
const https = require('https');
const { db, logAudit } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Telephony Provider Configuration Check
function getProviderStatus() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const isConfigured = Boolean(
    accountSid &&
    authToken &&
    fromNumber &&
    accountSid.trim() !== '' &&
    !accountSid.includes('your_') &&
    authToken.trim() !== ''
  );

  return {
    isConfigured,
    provider: 'Twilio Programmable Voice',
    fromNumber: isConfigured ? fromNumber : 'Not configured',
    accountSidMasked: accountSid && accountSid.length > 8 ? `${accountSid.substring(0, 4)}...${accountSid.substring(accountSid.length - 4)}` : null,
    statusMessage: isConfigured
      ? 'Telephony provider configured and active.'
      : 'Telephony Provider Not Configured. Real calls are unavailable. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in backend/.env to enable live automated calls.'
  };
}

// GET /api/telephony/provider-status (Public/authenticated check)
router.get('/provider-status', (req, res) => {
  res.json(getProviderStatus());
});

// GET /api/telephony/call-queue
router.get('/call-queue', authenticateToken, authorizeRoles('teacher', 'admin'), (req, res) => {
  const queue = db.prepare(`
    SELECT pq.*, 
           s.roll_number, s.prn, s.guardian_name, s.guardian_relation,
           stu_u.full_name as student_name,
           c.name as class_name,
           gfm_u.full_name as gfm_teacher_name, gfm_u.phone as gfm_phone,
           sub.name as subject_name
    FROM parent_call_queue pq
    JOIN students s ON pq.student_id = s.id
    JOIN users stu_u ON s.user_id = stu_u.id
    JOIN classes c ON s.class_id = c.id
    LEFT JOIN users gfm_u ON pq.gfm_teacher_id = gfm_u.id
    LEFT JOIN subjects sub ON pq.subject_id = sub.id
    ORDER BY 
      CASE pq.status
        WHEN 'PENDING' THEN 1
        WHEN 'CALLING' THEN 2
        WHEN 'CONNECTED_TO_GFM' THEN 3
        WHEN 'ACKNOWLEDGED' THEN 4
        ELSE 5
      END, pq.attendance_percentage ASC
  `).all();

  res.json({
    queue,
    providerStatus: getProviderStatus()
  });
});

// POST /api/telephony/sync-low-attendance (Auto-scans and populates queue for all students < 75%)
router.post('/sync-low-attendance', authenticateToken, authorizeRoles('teacher', 'admin'), (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM attendance_rules LIMIT 1').get() || { min_threshold_percentage: 75.0 };
    const minThreshold = rules.min_threshold_percentage;

    const allStudents = db.prepare(`
      SELECT s.id, s.roll_number, s.class_id, s.guardian_phone, s.guardian_name,
             c.gfm_teacher_id, u.full_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
    `).all();

    let queuedCount = 0;

    allStudents.forEach(st => {
      const conducted = db.prepare(`
        SELECT COUNT(*) as count FROM attendance_sessions WHERE class_id = ? AND status IN ('COMPLETED', 'ACTIVE')
      `).get(st.class_id).count;

      if (conducted > 0) {
        const attended = db.prepare(`
          SELECT COUNT(*) as count FROM attendance_records WHERE student_id = ? AND status = 'PRESENT'
        `).get(st.id).count;

        const percentage = Number(((attended / conducted) * 100).toFixed(1));

        if (percentage < minThreshold) {
          // Check if already in queue with PENDING or CALLING
          const existing = db.prepare(`
            SELECT id FROM parent_call_queue 
            WHERE student_id = ? AND status IN ('PENDING', 'CALLING')
          `).get(st.id);

          if (!existing) {
            db.prepare(`
              INSERT INTO parent_call_queue (student_id, gfm_teacher_id, guardian_phone, attendance_percentage, status, notes, triggered_by)
              VALUES (?, ?, ?, ?, 'PENDING', ?, ?)
            `).run(
              st.id,
              st.gfm_teacher_id,
              st.guardian_phone,
              percentage,
              `Auto-detected low attendance (${percentage}% < ${minThreshold}%). Guardian alert required.`,
              req.user.id
            );
            queuedCount++;
          }
        }
      }
    });

    logAudit(req.user.id, 'SYNC_PARENT_CALL_QUEUE', 'parent_call_queue', queuedCount, `Synced call queue. Added ${queuedCount} low-attendance students.`);

    res.json({
      message: `Sync completed. ${queuedCount} new low-attendance alerts added to the call queue.`,
      newlyQueuedCount: queuedCount
    });
  } catch (err) {
    console.error('Sync queue error:', err);
    res.status(500).json({ error: 'Failed to sync call queue.', details: err.message });
  }
});

// POST /api/telephony/trigger-call
router.post('/trigger-call', authenticateToken, authorizeRoles('teacher', 'admin'), (req, res) => {
  const { queueId } = req.body;
  const provider = getProviderStatus();

  // STAGE CHECK: NEVER fake successful calls when provider is unconfigured!
  if (!provider.isConfigured) {
    return res.status(503).json({
      error: 'Real calls unavailable: Telephony provider is not configured.',
      providerStatus: provider,
      actionRequired: 'To enable real automated calling with keypad IVR to the Guardian Faculty Member, configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in backend/.env.'
    });
  }

  // If credentials exist, initiate the actual outbound call via Twilio Voice API
  const item = db.prepare(`
    SELECT pq.*, s.guardian_name, stu_u.full_name as student_name,
           gfm_u.full_name as gfm_teacher_name, gfm_u.phone as gfm_phone
    FROM parent_call_queue pq
    JOIN students s ON pq.student_id = s.id
    JOIN users stu_u ON s.user_id = stu_u.id
    LEFT JOIN users gfm_u ON pq.gfm_teacher_id = gfm_u.id
    WHERE pq.id = ?
  `).get(queueId);

  if (!item) {
    return res.status(404).json({ error: 'Call queue entry not found.' });
  }

  // Real Twilio REST API execution
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const baseUrl = process.env.TWILIO_STATUS_CALLBACK_URL || `${req.protocol}://${req.get('host')}`;
    const twimlUrl = `${baseUrl}/api/telephony/twiml/parent-ivr?queueId=${queueId}`;

    const postData = new URLSearchParams({
      To: item.guardian_phone,
      From: fromPhone,
      Url: twimlUrl
    }).toString();

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Calls.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const twilioReq = https.request(options, (twilioRes) => {
      let body = '';
      twilioRes.on('data', chunk => body += chunk);
      twilioRes.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (twilioRes.statusCode >= 200 && twilioRes.statusCode < 300) {
            db.prepare(`
              UPDATE parent_call_queue 
              SET status = 'CALLING', call_sid = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(parsed.sid, queueId);

            logAudit(req.user.id, 'TRIGGER_PARENT_CALL', 'parent_call_queue', queueId, `Initiated real automated call (SID: ${parsed.sid}) to ${item.guardian_phone}`);

            res.json({
              message: 'Live automated call initiated via Twilio.',
              callSid: parsed.sid,
              status: 'CALLING',
              to: item.guardian_phone
            });
          } else {
            db.prepare("UPDATE parent_call_queue SET status = 'FAILED', notes = ? WHERE id = ?")
              .run(`Provider rejected: ${parsed.message || 'Twilio Error'}`, queueId);

            res.status(502).json({
              error: 'Telephony provider failed to initiate call.',
              providerError: parsed
            });
          }
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse provider response', raw: body });
        }
      });
    });

    twilioReq.on('error', (e) => {
      db.prepare("UPDATE parent_call_queue SET status = 'FAILED', notes = ? WHERE id = ?")
        .run(`Network error: ${e.message}`, queueId);
      res.status(502).json({ error: 'Failed to connect to telephony provider network.', details: e.message });
    });

    twilioReq.write(postData);
    twilioReq.end();
  } catch (err) {
    console.error('Trigger call exception:', err);
    res.status(500).json({ error: 'Error initiating voice call', details: err.message });
  }
});

// TWIML IVR Webhook: Initial message + keypad prompt
router.all('/twiml/parent-ivr', (req, res) => {
  const queueId = req.query.queueId;
  const item = db.prepare(`
    SELECT pq.*, s.guardian_name, stu_u.full_name as student_name,
           gfm_u.full_name as gfm_teacher_name, gfm_u.phone as gfm_phone
    FROM parent_call_queue pq
    JOIN students s ON pq.student_id = s.id
    JOIN users stu_u ON s.user_id = stu_u.id
    LEFT JOIN users gfm_u ON pq.gfm_teacher_id = gfm_u.id
    WHERE pq.id = ?
  `).get(queueId);

  const studentName = item ? item.student_name : 'your student';
  const attendancePct = item ? item.attendance_percentage : 0;
  const gfmName = item ? (item.gfm_teacher_name || 'the class teacher') : 'the faculty advisor';

  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/api/telephony/twiml/handle-keypad?queueId=${queueId}" method="POST" timeout="10">
    <Say voice="Polly.Aditi" language="en-IN">
      Greetings from Smart College Attendance System. This is an urgent attendance notification regarding ${studentName}. 
      Current attendance is critically low at ${attendancePct} percent, which is below the mandatory 75 percent university threshold. 
      Press 1 on your keypad to connect directly to the Guardian Faculty Member, ${gfmName}. 
      Press 2 to acknowledge this automated notification.
    </Say>
  </Gather>
  <Say voice="Polly.Aditi">We did not receive any input. Goodbye.</Say>
</Response>`);
});

// TWIML IVR Webhook: Keypad processing
router.all('/twiml/handle-keypad', (req, res) => {
  const digits = req.body.Digits || req.query.Digits;
  const queueId = req.query.queueId;

  const item = db.prepare(`
    SELECT pq.*, gfm_u.phone as gfm_phone, gfm_u.full_name as gfm_teacher_name
    FROM parent_call_queue pq
    LEFT JOIN users gfm_u ON pq.gfm_teacher_id = gfm_u.id
    WHERE pq.id = ?
  `).get(queueId);

  res.type('text/xml');

  if (digits === '1') {
    const gfmPhone = item && item.gfm_phone ? item.gfm_phone : null;
    if (gfmPhone) {
      db.prepare("UPDATE parent_call_queue SET status = 'CONNECTED_TO_GFM', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(queueId);
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">Connecting your call to ${item.gfm_teacher_name || 'the Guardian Faculty Member'}. Please hold.</Say>
  <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}">${gfmPhone}</Dial>
</Response>`);
    } else {
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">The Guardian Faculty Member phone number is currently not configured in the system. An email alert has been dispatched. Thank you.</Say>
</Response>`);
    }
  } else if (digits === '2') {
    db.prepare("UPDATE parent_call_queue SET status = 'ACKNOWLEDGED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(queueId);
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">Thank you. Your acknowledgment has been recorded in the college attendance records.</Say>
</Response>`);
  } else {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Invalid input received. Goodbye.</Say>
</Response>`);
  }
});

// POST /api/telephony/send-sms
router.post('/send-sms', authenticateToken, authorizeRoles('teacher', 'admin'), (req, res) => {
  const { queueId, customMessage } = req.body;
  const provider = getProviderStatus();

  if (!provider.isConfigured) {
    return res.status(503).json({
      error: 'SMS dispatch unavailable: Telephony provider is not configured.',
      providerStatus: provider,
      actionRequired: 'Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in backend/.env to dispatch real SMS messages.'
    });
  }

  const item = db.prepare(`
    SELECT pq.*, s.guardian_name, stu_u.full_name as student_name,
           gfm_u.full_name as gfm_teacher_name, gfm_u.phone as gfm_phone
    FROM parent_call_queue pq
    JOIN students s ON pq.student_id = s.id
    JOIN users stu_u ON s.user_id = stu_u.id
    LEFT JOIN users gfm_u ON pq.gfm_teacher_id = gfm_u.id
    WHERE pq.id = ?
  `).get(queueId);

  if (!item) {
    return res.status(404).json({ error: 'Call queue entry not found.' });
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    const messageBody = customMessage || 
      `Dear ${item.guardian_name}, this is an urgent notice from Smart College Attendance System. Your ward ${item.student_name}'s attendance is critically low at ${item.attendance_percentage}%. Contact GFM ${item.gfm_teacher_name} (${item.gfm_phone || 'College Office'}) immediately.`;

    const postData = new URLSearchParams({
      To: item.guardian_phone,
      From: fromPhone,
      Body: messageBody
    }).toString();

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const twilioReq = https.request(options, (twilioRes) => {
      let body = '';
      twilioRes.on('data', chunk => body += chunk);
      twilioRes.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (twilioRes.statusCode >= 200 && twilioRes.statusCode < 300) {
            db.prepare("UPDATE parent_call_queue SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
              .run(`SMS Dispatched (SID: ${parsed.sid})`, queueId);

            logAudit(req.user.id, 'DISPATCH_PARENT_SMS', 'parent_call_queue', queueId, `Real SMS dispatched to ${item.guardian_phone}`);

            res.json({
              message: 'Live SMS dispatched successfully via Twilio.',
              messageSid: parsed.sid,
              to: item.guardian_phone
            });
          } else {
            res.status(502).json({
              error: 'Telephony provider failed to dispatch SMS.',
              providerError: parsed
            });
          }
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse SMS provider response', raw: body });
        }
      });
    });

    twilioReq.on('error', (e) => {
      res.status(502).json({ error: 'Failed to connect to SMS provider network.', details: e.message });
    });

    twilioReq.write(postData);
    twilioReq.end();
  } catch (err) {
    res.status(500).json({ error: 'Error sending SMS', details: err.message });
  }
});

module.exports = router;
