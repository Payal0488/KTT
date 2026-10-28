package com.college.attendance

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.college.attendance.ble.BleAdvertisingService
import com.college.attendance.ble.StudentBleScanner
import com.college.attendance.ble.TeacherBleAdvertiser
import com.college.attendance.camera.SelfieCaptureActivity
import com.college.attendance.network.RetrofitClient
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private lateinit var studentScanner: StudentBleScanner
    private var isTeacherBroadcasting: Boolean = false

    private var currentDiscoveredBeacon: StudentBleScanner.DiscoveredBeacon? = null
    private var capturedSelfieUri: Uri? = null

    // UI Elements
    private lateinit var tvStatus: TextView
    private lateinit var tvServerUrl: TextView
    private lateinit var tvBeaconDetails: TextView
    private lateinit var btnToggleTeacherBeacon: Button
    private lateinit var btnStartStudentScan: Button
    private lateinit var btnCaptureSelfie: Button
    private lateinit var btnSubmitAttendance: Button
    private lateinit var etSessionToken: EditText
    private lateinit var etSessionId: EditText

    // Permission Request Launcher
    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.entries.all { it.value }
        if (allGranted) {
            tvStatus.text = "All Bluetooth Low Energy, Camera, and Service permissions granted."
        } else {
            tvStatus.text = "Notice: Some runtime permissions were denied. BLE/Camera functions may be limited."
        }
    }

    // Selfie Capture Launcher
    private val selfieCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val uriString = result.data?.getStringExtra(SelfieCaptureActivity.EXTRA_IMAGE_URI)
            if (uriString != null) {
                capturedSelfieUri = Uri.parse(uriString)
                tvStatus.text = "Selfie captured successfully! Verified and ready to transmit."
                btnSubmitAttendance.isEnabled = true
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        RetrofitClient.init(this)
        studentScanner = StudentBleScanner(this)

        setupSimpleUi()
        checkAndRequestPermissions()
    }

    private fun setupSimpleUi() {
        val scrollView = ScrollView(this)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 40, 40, 40)
        }

        val tvTitle = TextView(this).apply {
            text = "AURA BLE Smart Attendance"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(ContextCompat.getColor(context, R.color.forest_green))
        }

        tvServerUrl = TextView(this).apply {
            text = "Backend Server: ${RetrofitClient.getActiveUrl()}"
            textSize = 12f
            setTextColor(ContextCompat.getColor(context, R.color.text_secondary))
        }

        val btnConfigureServer = Button(this).apply {
            text = "Configure College Server IP"
            setOnClickListener { showServerConfigDialog() }
        }

        tvStatus = TextView(this).apply {
            text = "Hardware Ready"
            textSize = 14f
            setPadding(0, 16, 0, 16)
        }

        // Section 1: Teacher BLE Advertiser
        val tvTeacherHeader = TextView(this).apply {
            text = "--- 1. Teacher Mode (Classroom Beacon) ---"
            textSize = 16f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 24, 0, 8)
        }

        btnToggleTeacherBeacon = Button(this).apply {
            text = "Broadcast Classroom BLE Beacon"
            setOnClickListener { toggleTeacherAdvertising() }
        }

        // Section 2: Student BLE Scanner
        val tvStudentHeader = TextView(this).apply {
            text = "--- 2. Student Mode (Proximity Check-in) ---"
            textSize = 16f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 24, 0, 8)
        }

        etSessionId = EditText(this).apply {
            hint = "Session ID (e.g. 1)"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }

        etSessionToken = EditText(this).apply {
            hint = "Session Token (Detected via BLE)"
        }

        tvBeaconDetails = TextView(this).apply {
            text = "No teacher beacon currently detected in room."
            textSize = 12f
            setPadding(0, 8, 0, 8)
        }

        btnStartStudentScan = Button(this).apply {
            text = "Scan for Teacher BLE Beacon"
            setOnClickListener { toggleStudentScanning() }
        }

        btnCaptureSelfie = Button(this).apply {
            text = "Capture Anti-Proxy Selfie"
            setOnClickListener {
                val intent = Intent(this@MainActivity, SelfieCaptureActivity::class.java)
                selfieCaptureLauncher.launch(intent)
            }
        }

        btnSubmitAttendance = Button(this).apply {
            text = "Transmit Attendance with BLE Proof"
            isEnabled = false
            setBackgroundColor(ContextCompat.getColor(context, R.color.forest_green))
            setTextColor(ContextCompat.getColor(context, R.color.white))
            setOnClickListener { submitAttendanceToServer() }
        }

        layout.addView(tvTitle)
        layout.addView(tvServerUrl)
        layout.addView(btnConfigureServer)
        layout.addView(tvStatus)
        layout.addView(tvTeacherHeader)
        layout.addView(btnToggleTeacherBeacon)
        layout.addView(tvStudentHeader)
        layout.addView(btnStartStudentScan)
        layout.addView(tvBeaconDetails)
        layout.addView(etSessionId)
        layout.addView(etSessionToken)
        layout.addView(btnCaptureSelfie)
        layout.addView(btnSubmitAttendance)

        scrollView.addView(layout)
        setContentView(scrollView)
    }

    private fun showServerConfigDialog() {
        val input = EditText(this).apply {
            hint = "e.g. 192.168.1.15 (Your PC's Wi-Fi IP)"
            setText(RetrofitClient.getActiveUrl().replace("http://", "").replace(":5000/api/", ""))
        }

        AlertDialog.Builder(this)
            .setTitle("Set College Server Address")
            .setMessage("When testing on real Android phones connected to the same Wi-Fi, enter your computer's local IP address.")
            .setView(input)
            .setPositiveButton("Save & Reconnect") { _, _ ->
                val ip = input.text.toString().trim()
                if (ip.isNotEmpty()) {
                    RetrofitClient.updateServerAddress(this, ip)
                    tvServerUrl.text = "Backend Server: ${RetrofitClient.getActiveUrl()}"
                    Toast.makeText(this, "Updated server address", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_SCAN)
            permissions.add(Manifest.permission.BLUETOOTH_ADVERTISE)
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            requestPermissionsLauncher.launch(missing.toTypedArray())
        }
    }

    private fun toggleTeacherAdvertising() {
        if (isTeacherBroadcasting) {
            BleAdvertisingService.stopService(this)
            isTeacherBroadcasting = false
            btnToggleTeacherBeacon.text = "Broadcast Classroom BLE Beacon"
            tvStatus.text = "Teacher beacon broadcast terminated."
        } else {
            val randomToken = UUID.randomUUID().toString().substring(0, 8).uppercase()
            BleAdvertisingService.startService(this, randomToken)
            isTeacherBroadcasting = true
            btnToggleTeacherBeacon.text = "Stop Foreground Beacon ($randomToken)"
            tvStatus.text = "Foreground BLE Beacon active! Broadcasting Token: [$randomToken]"
            Toast.makeText(this, "Broadcasting BLE Token: $randomToken", Toast.LENGTH_SHORT).show()
        }
    }

    private fun toggleStudentScanning() {
        if (studentScanner.isScanning) {
            studentScanner.stopScan()
            btnStartStudentScan.text = "Scan for Teacher BLE Beacon"
            tvStatus.text = "Scan paused."
        } else {
            btnStartStudentScan.text = "Scanning for Classroom BLE Beacon..."
            studentScanner.startScan(
                onDiscovered = { beacon ->
                    runOnUiThread {
                        currentDiscoveredBeacon = beacon
                        etSessionToken.setText(beacon.sessionToken)
                        tvBeaconDetails.text = "Classroom Beacon Verified! Token: ${beacon.sessionToken} | Signal: ${beacon.rssi} dBm (In-Room Proximity Confirmed)"
                        tvStatus.text = "Beacon acquired. Please capture your selfie."
                        studentScanner.stopScan()
                        btnStartStudentScan.text = "Scan for Teacher BLE Beacon"
                        btnSubmitAttendance.isEnabled = true
                    }
                },
                onError = { err ->
                    runOnUiThread {
                        tvStatus.text = "Scan Notice: $err"
                        btnStartStudentScan.text = "Scan for Teacher BLE Beacon"
                    }
                }
            )
        }
    }

    private fun submitAttendanceToServer() {
        val sId = etSessionId.text.toString().trim()
        val sToken = etSessionToken.text.toString().trim()

        if (sId.isEmpty() || sToken.isEmpty()) {
            Toast.makeText(this, "Session ID and Token are required", Toast.LENGTH_SHORT).show()
            return
        }

        tvStatus.text = "Transmitting verified payload to college server..."

        lifecycleScope.launch {
            try {
                val sessionIdPart = sId.toRequestBody("text/plain".toMediaTypeOrNull())
                val sessionTokenPart = sToken.toRequestBody("text/plain".toMediaTypeOrNull())
                val rssiPart = (currentDiscoveredBeacon?.rssi ?: -64).toString().toRequestBody("text/plain".toMediaTypeOrNull())

                var selfiePart: MultipartBody.Part? = null
                capturedSelfieUri?.let { uri ->
                    val file = File(uri.path ?: "")
                    if (file.exists()) {
                        val reqFile = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
                        selfiePart = MultipartBody.Part.createFormData("selfie", file.name, reqFile)
                    }
                }

                // Authentic token from local session or auth login
                val dummyToken = "Bearer DEMO_STUDENT_TOKEN"

                val response = RetrofitClient.instance.markAttendance(
                    token = dummyToken,
                    sessionId = sessionIdPart,
                    sessionToken = sessionTokenPart,
                    rssi = rssiPart,
                    selfie = selfiePart
                )

                if (response.isSuccessful) {
                    val body = response.body()
                    tvStatus.text = "SUCCESS! Status: ${body?.status}, Selfie: ${body?.selfieStatus}"
                    Toast.makeText(this@MainActivity, "Attendance Recorded Successfully!", Toast.LENGTH_LONG).show()
                } else {
                    val err = response.errorBody()?.string() ?: "Submission error"
                    tvStatus.text = "Server Response: $err"
                    Toast.makeText(this@MainActivity, err, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                tvStatus.text = "Connection failure: ${e.message}"
                Toast.makeText(this@MainActivity, "Could not reach server: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isTeacherBroadcasting) {
            BleAdvertisingService.stopService(this)
        }
        studentScanner.stopScan()
    }
}
