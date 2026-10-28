package com.college.attendance.ble

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.college.attendance.MainActivity
import com.college.attendance.R

class BleAdvertisingService : Service() {

    companion object {
        const val CHANNEL_ID = "ble_attendance_beacon_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.college.attendance.action.START_BEACON"
        const val ACTION_STOP = "com.college.attendance.action.STOP_BEACON"
        const val EXTRA_SESSION_TOKEN = "extra_session_token"

        fun startService(context: Context, sessionToken: String) {
            val intent = Intent(context, BleAdvertisingService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_SESSION_TOKEN, sessionToken)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, BleAdvertisingService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private lateinit var advertiser: TeacherBleAdvertiser

    override fun onCreate() {
        super.onCreate()
        advertiser = TeacherBleAdvertiser(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val token = intent.getStringExtra(EXTRA_SESSION_TOKEN) ?: "CLASS101"
                startForeground(NOTIFICATION_ID, buildNotification(token))
                advertiser.startAdvertising(token) { success, msg ->
                    // Notification updated if needed
                }
            }
            ACTION_STOP -> {
                advertiser.stopAdvertising()
                stopForeground(true)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun buildNotification(token: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Classroom Attendance Beacon Active")
            .setContentText("Broadcasting BLE Session Token: [$token]")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "BLE Beacon Broadcasting Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifies that classroom Bluetooth LE attendance broadcast is currently active."
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        advertiser.stopAdvertising()
    }
}
