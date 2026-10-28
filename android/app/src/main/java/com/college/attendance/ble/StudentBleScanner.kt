package com.college.attendance.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import android.util.Log
import java.nio.charset.StandardCharsets

class StudentBleScanner(private val context: Context) {

    companion object {
        private const val TAG = "StudentBleScanner"
        const val MIN_CLASSROOM_RSSI = -78 // Require student to be physically inside lecture hall
    }

    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager?.adapter
    private var bleScanner: BluetoothLeScanner? = null

    var isScanning: Boolean = false
        private set

    data class DiscoveredBeacon(
        val sessionToken: String,
        val rssi: Int,
        val deviceAddress: String,
        val serviceUuid: String
    )

    private var onBeaconDiscovered: ((DiscoveredBeacon) -> Unit)? = null

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            super.onScanResult(callbackType, result)
            result?.let { handleScanResult(it) }
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>?) {
            super.onBatchScanResults(results)
            results?.forEach { handleScanResult(it) }
        }

        override fun onScanFailed(errorCode: Int) {
            super.onScanFailed(errorCode)
            isScanning = false
            Log.e(TAG, "BLE Scan failed with error code: $errorCode")
        }
    }

    private fun handleScanResult(result: ScanResult) {
        val record = result.scanRecord ?: return
        val serviceData = record.getServiceData(ParcelUuid(TeacherBleAdvertiser.SERVICE_UUID))

        val sessionToken = if (serviceData != null && serviceData.isNotEmpty()) {
            String(serviceData, StandardCharsets.UTF_8)
        } else {
            ""
        }

        val rssi = result.rssi
        val deviceAddress = result.device.address

        Log.d(TAG, "Discovered Beacon: Token=[$sessionToken], RSSI=$rssi dBm, MAC=$deviceAddress")

        val beacon = DiscoveredBeacon(
            sessionToken = sessionToken,
            rssi = rssi,
            deviceAddress = deviceAddress,
            serviceUuid = TeacherBleAdvertiser.SERVICE_UUID.toString()
        )

        onBeaconDiscovered?.invoke(beacon)
    }

    @SuppressLint("MissingPermission")
    fun startScan(onDiscovered: (DiscoveredBeacon) -> Unit, onError: (String) -> Unit) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            onError("Bluetooth is turned off. Please enable Bluetooth to scan for lecture beacon.")
            return
        }

        bleScanner = bluetoothAdapter.bluetoothLeScanner
        if (bleScanner == null) {
            onError("BLE Scanner is unavailable on this device.")
            return
        }

        this.onBeaconDiscovered = onDiscovered

        // Filter exclusively for College Attendance Service UUID
        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(TeacherBleAdvertiser.SERVICE_UUID))
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setReportDelay(0)
            .build()

        try {
            isScanning = true
            bleScanner?.startScan(listOf(filter), settings, scanCallback)
            Log.d(TAG, "BLE scan started for service: ${TeacherBleAdvertiser.SERVICE_UUID}")
        } catch (e: Exception) {
            isScanning = false
            Log.e(TAG, "Exception starting scan: ${e.message}")
            onError("Scan error: ${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    fun stopScan() {
        if (isScanning && bleScanner != null) {
            try {
                bleScanner?.stopScan(scanCallback)
                isScanning = false
                Log.d(TAG, "BLE scan stopped.")
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping scan: ${e.message}")
            }
        }
    }
}
