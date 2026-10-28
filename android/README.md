# AURA BLE Smart Attendance - Native Android Kotlin Application

Native Android Kotlin application engineered for institutional Bluetooth Low Energy (BLE) peripheral advertising and central scanning, integrated with Google CameraX anti-proxy facial verification and Retrofit HTTP synchronization.

---

## Architecture & Real Hardware Implementation

### 1. Teacher Mode (`TeacherBleAdvertiser.kt` & `BleAdvertisingService.kt`)
- Operates as a **BLE Peripheral**:
  - Encapsulated within an Android **Foreground Service** (`BleAdvertisingService`) with an ongoing notification to prevent Android OS memory killers from terminating beacon transmission when screen sleeps or apps switch.
  - Uses `BluetoothLeAdvertiser` with `ADVERTISE_MODE_LOW_LATENCY` and `ADVERTISE_TX_POWER_HIGH`.
  - Injects dynamic 8-character cryptographic session token into Service Data packet (`UUID: 0000FEAA-0000-1000-8000-00805F9B34FB`).
  - Hosts a local GATT Server (`BluetoothGattServer`) for bidirectional token verification with student devices.

### 2. Student Mode (`StudentBleScanner.kt`)
- Operates as a **BLE Central Scanner**:
  - Uses `BluetoothLeScanner` with `ScanFilter` strictly targeting the college attendance Service UUID.
  - Enforces physical presence verification using an RSSI threshold (`MIN_CLASSROOM_RSSI = -78 dBm`), preventing students from claiming attendance from outside the lecture hall.
  - Automatically parses and populates the broadcast session token upon discovery.

### 3. Anti-Proxy Facial Verification (`SelfieCaptureActivity.kt`)
- CameraX Front-Facing Camera Integration (`CameraSelector.DEFAULT_FRONT_CAMERA`):
  - Captures verified live camera snapshot at check-in time.
  - Packages and uploads multipart image alongside BLE RSSI signal proof to the Node.js backend.

### 4. Dynamic Network Configuration (`RetrofitClient.kt`)
- On real Android phones, testing over Wi-Fi requires connecting to your development machine's local LAN IP.
- Tap **"Configure College Server IP"** on the main screen to enter your computer's local Wi-Fi IP (e.g. `192.168.1.15`).

---

## Real Android Phone Testing Protocol (2 Real Devices)

### Prerequisites:
1. Ensure both Android phones and your development PC are connected to the **same Wi-Fi network**.
2. Find your PC's local Wi-Fi IP via `ipconfig` (e.g. `192.168.1.15`).
3. Ensure backend is running: `node backend/server.js` (listening on port 5000).

### Device A (Teacher's Phone):
1. Open the app and grant Bluetooth, Notification, and Location permissions.
2. Tap **"Broadcast Classroom BLE Beacon"**.
3. A persistent notification appears indicating the classroom beacon is active with an 8-character token (e.g. `A7B9C3D1`).

### Device B (Student's Phone):
1. Open the app and tap **"Configure College Server IP"** -> Enter your PC's IP (`192.168.1.15`).
2. Enter the active Session ID from the teacher dashboard.
3. Tap **"Scan for Teacher BLE Beacon"**.
4. The beacon is discovered over the air; RSSI signal strength (e.g. `-64 dBm`) and token are verified.
5. Tap **"Capture Anti-Proxy Selfie"** -> take a photo with the front camera.
6. Tap **"Transmit Attendance with BLE Proof"**.
7. The record is instantly received and logged by the server.

---

## Google Play Store Readiness Checklist

- [x] Package Name: `com.college.attendance`
- [x] Target SDK: `34` (Android 14) / Min SDK: `26` (Android 8.0)
- [x] Runtime Permissions for Android 12+ (`BLUETOOTH_ADVERTISE`, `BLUETOOTH_SCAN` with `neverForLocation`, `BLUETOOTH_CONNECT`, `POST_NOTIFICATIONS`)
- [x] ProGuard rules configured in `app/proguard-rules.pro` for code shrinking and obfuscation
- [x] Foreground Service configured with `foregroundServiceType="connectedDevice"` per Google Play Policy
- [x] Cleartext traffic enabled for local development; switch to HTTPS domain for production store deployment
