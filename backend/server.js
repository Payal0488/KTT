require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./config/db');
const { seedData } = require('./config/seed');

const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const teacherRoutes = require('./routes/teacher.routes');
const adminRoutes = require('./routes/admin.routes');
const telephonyRoutes = require('./routes/telephony.routes');
const reportsRoutes = require('./routes/reports.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads', 'selfies');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: '*', // Allow Vite frontend during development
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded selfies statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/telephony', telephonyRoutes);
app.use('/api/reports', reportsRoutes);

// Health & System Info Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'BLE-Based Smart College Attendance Management System',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: 'SQLite (Persistent node:sqlite engine)',
    telephonyStatus: Boolean(process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.includes('your_'))
  });
});

// Root Landing Page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>AURA BLE Backend API Server</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #FDFBF7;
          color: #2D3E2F;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 1rem;
        }
        .card {
          background: #FFFFFF;
          border: 1px solid #E8E2D5;
          border-radius: 12px;
          padding: 2.5rem;
          max-width: 550px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          text-align: center;
        }
        .badge {
          display: inline-block;
          background: #E8ECE6;
          color: #2D3E2F;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 1rem;
        }
        h1 { margin: 0 0 0.5rem 0; font-size: 1.6rem; color: #1E2D20; }
        p { color: #5F6F52; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }
        .btn {
          display: inline-block;
          background: #2D3E2F;
          color: #FFFFFF;
          text-decoration: none;
          padding: 10px 24px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.95rem;
          margin: 0.3rem;
          transition: background 0.2s;
        }
        .btn:hover { background: #1E2D20; }
        .btn-outline {
          background: transparent;
          color: #2D3E2F;
          border: 1px solid #C5A880;
        }
        .btn-outline:hover { background: #F5F1E8; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">BACKEND API ONLINE</span>
        <h1>AURA BLE Smart Attendance API</h1>
        <p>
          The Node.js & Express REST API server is running on <strong>port 5000</strong> with persistent SQLite storage.
          <br><br>
          To access the user dashboard, click below to open your <strong>Frontend Web Application</strong>:
        </p>
        <div>
          <a href="http://localhost:5174" class="btn">Open Frontend (Port 5174)</a>
          <a href="http://localhost:5173" class="btn">Open Frontend (Port 5173)</a>
          <br><br>
          <a href="/api/health" class="btn btn-outline" style="font-size: 0.8rem; padding: 6px 14px;">View /api/health JSON</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    error: 'An internal server error occurred',
    message: err.message
  });
});

// Initialize database and start server
async function startServer() {
  try {
    initDatabase();
    await seedData();

    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` BLE Smart College Attendance API Server running`);
      console.log(` Port:    http://localhost:${PORT}`);
      console.log(` Health:  http://localhost:${PORT}/api/health`);
      console.log(` DB:      SQLite persistent storage`);
      console.log(`====================================================`);
    });

    return server;
  } catch (err) {
    console.error('Fatal: Server startup failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
