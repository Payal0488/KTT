# BLE-Based Smart College Attendance Management System

**Institutional Smart College Attendance Platform featuring Bluetooth Low Energy (BLE) Beacon Discovery, CameraX Anti-Proxy Facial Verification, Administrator Enrolment Verification, Teacher Substitution Control, and Real-Time IVR/SMS Guardian Alerts.**

Engineered using an academic visual aesthetic: **Warm Ivory (`#FDFBF7`), Cream (`#F5F1E8`), Muted Olive Green (`#5F6F52`), Deep Forest Green (`#2D3E2F`), and Champagne Gold (`#C5A880`)**.

---

## Tooling & Verification Matrix

| Subsystem / Feature | Status | Verification & Evidence |
|---------------------|--------|-------------------------|
| **Node.js Environment** | **WORKING** | `v24.16.0`, `npm 11.13.0` active |
| **Java JDK** | **WORKING** | Oracle JDK 25 verified at `C:\Program Files\Java\jdk-25` |
| **Automated Test Suite** | **WORKING** | **20/20** automated integration tests green (`node backend/test/api.test.js`) |
| **Persistent SQLite Database** | **WORKING** | `college_attendance.db` initialized with WAL mode, foreign keys, and migrations |
| **Web Portal (React + Vite)** | **WORKING** | Production bundle compiled and verified (`frontend/dist/`) |
| **Real Entry Point & Auth Portal** | **WORKING** | Full-page institutional login, student self-registration, and password recovery (`AuthPortal.jsx`) |
| **Admin Enrolment Management** | **WORKING** | Admin approves/rejects pending enrolments, corrects student/guardian details, and resets passwords |
| **Math Calculator & Summaries** | **WORKING** | Exact mathematical calculation for catch-up lectures (&lt;75%) and safe bunks (&ge;75%), plus monthly & semester summaries |
| **Teacher Substitution Security Lock** | **WORKING** | Admin assigns substitute; original regular teacher locked out; only substitute can broadcast beacon |
| **Selfie Verification Center** | **WORKING** | Live HTML5 / CameraX capture; teacher review queue with mandatory rejection reason and audit logging |
| **Telephony Voice IVR & SMS** | **WORKING** | Twilio IVR keypad flow (1 to connect to GFM, 2 to acknowledge); SMS dispatch; explicitly reports unconfigured status when credentials absent |
| **Attendance Reports & CSV Export** | **WORKING** | Real-time CSV generation and download with subject breakdown |
| **Native Android Kotlin BLE Codebase** | **NOT TESTED** | Production-ready Kotlin app in `/android` with `BleAdvertisingService`, `StudentBleScanner`, `CameraX`, and ProGuard rules |
| **Native APK Compilation** | **BLOCKED** | Android SDK, Gradle CLI, and Android Studio are not installed on this host system |

---

## Quick Start Commands

### Option A: One-Click Launch (Windows)
Double-click `start.bat` in the project root to start the backend API and frontend Vite server in parallel.

### Option B: Command Line Launch

#### 1. Run Automated Test Suite (20 Tests)
```powershell
cd "c:\Users\Om Lokhande\OneDrive\Desktop\SmartCollegeAttendance"
node backend/test/api.test.js
```

#### 2. Start Backend API Server (Port 5000)
```powershell
cd "c:\Users\Om Lokhande\OneDrive\Desktop\SmartCollegeAttendance\backend"
node server.js
```
*Health Check: http://localhost:5000/api/health*

#### 3. Start Frontend Web Application (Port 5173)
```powershell
cd "c:\Users\Om Lokhande\OneDrive\Desktop\SmartCollegeAttendance\frontend"
npm run dev
```
*Web Application: http://localhost:5173*

---

## Authorized Demo Accounts (Development & Testing)

| Role | Username | Password | Profile Description |
|------|----------|----------|---------------------|
| **Dean / Administrator** | `admin` | `admin123` | Dr. Arvind Kulkarni (Full administrative oversight) |
| **Regular Teacher** | `prof.patil` | `teacher123` | Prof. Rajesh Patil (DBMS & OS Lecturer) |
| **GFM / Class Teacher** | `prof.deshmukh` | `teacher123` | Prof. Snehal Deshmukh (GFM for Class TE-CSE-A) |
| **Substitute Teacher** | `prof.shinde` | `teacher123` | Prof. Amit Shinde (Designated substitute faculty) |
| **Student (Safe)** | `student.aarav` | `student123` | Aarav Sharma (87.5% attendance - Eligible) |
| **Student (Defaulter)** | `student.rohan` | `student123` | Rohan Verma (50.0% attendance - Warning Active) |

---

## Native Android BLE Mobile App (`/android`)

The native Android app in [`/android`](file:///c:/Users/Om%20Lokhande/OneDrive/Desktop/SmartCollegeAttendance/android) is ready for Android Studio and Play Store release:
- **Foreground BLE Beacon Service** (`BleAdvertisingService.kt`): Ongoing notification keeps the teacher's BLE beacon broadcasting even when the phone locks or apps switch.
- **BLE Central Scanner** (`StudentBleScanner.kt`): Targets Service UUID `0000FEAA-0000-1000-8000-00805F9B34FB` with `MIN_CLASSROOM_RSSI = -78 dBm` physical room proximity gate.
- **Anti-Proxy CameraX Capture** (`SelfieCaptureActivity.kt`): Front-facing facial capture transmitted via multipart request.
- **Dynamic Server Configuration** (`RetrofitClient.kt`): Tap "Configure College Server IP" on real phones to enter your PC's Wi-Fi IP (e.g. `192.168.1.15`).
- **Google Play Store Optimization**: `app/proguard-rules.pro` configured for release builds.
