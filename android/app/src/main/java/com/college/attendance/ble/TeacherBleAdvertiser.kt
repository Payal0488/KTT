package com.college.attendance.ble

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import android.util.Log
import java.nio.charset.StandardCharsets
import java.util.UUID

class TeacherBleAdvertiser(private val context: Context) {

    companion object {
        private const val TAG = "TeacherBleAdvertiser"
        // Base UUID for College Attendance BLE Service
        val SERVICE_UUID: UUID = UUID.fromString("0000FEAA-0000-1000-8000-00805F9B34FB")
        val CHARACTERISTIC_TOKEN_UUID: UUID = UUID.fromString("0000FEAB-0000-1000-8000-00805F9B34FB")
    }

    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager?.adapter
    private var bleAdvertiser: BluetoothLeAdvertiser? = null
    private var gattServer: BluetoothGattServer? = null

    var isAdvertising: Boolean = false
        private set

    private var currentSessionToken: String = ""

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
            super.onStartSuccess(settingsInEffect)
            isAdvertising = true
            Log.d(TAG, "BLE Beacon advertising started successfully with token: $currentSessionToken")
        }

        override fun onStartFailure(errorCode: Int) {
            super.onStartFailure(errorCode)
            isAdvertising = false
            Log.e(TAG, "BLE Beacon advertising failed with error code: $errorCode")
        }
    }

    private val gattServerCallback = object : BluetoothGattServerCallback() {
        @SuppressLint("MissingPermission")
        override fun onCharacteristicReadRequest(
            device: BluetoothDevice?,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic?
        ) {
            super.onCharacteristicReadRequest(device, requestId, offset, characteristic)
            if (characteristic?.uuid == CHARACTERISTIC_TOKEN_UUID) {
                val data = currentSessionToken.toByteArray(StandardCharsets.UTF_8)
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, data)
                Log.d(TAG, "Sent session token response to student device: ${device?.address}")
            } else {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, offset, null)
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun startAdvertising(sessionToken: String, onStatus: (Boolean, String) -> Unit) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            onStatus(false, "Bluetooth is disabled or not supported on this device.")
            return
        }

        bleAdvertiser = bluetoothAdapter.bluetoothLeAdvertiser
        if (bleAdvertiser == null) {
            onStatus(false, "Device does not support Bluetooth LE Advertising (Peripheral Mode).")
            return
        }

        currentSessionToken = sessionToken

        // 1. Setup GATT Server to respond to student connection queries
        setupGattServer()

        // 2. Configure Advertising Settings
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0) // Advertise indefinitely until teacher stops session
            .build()

        // 3. Configure Advertising Packet Data
        val tokenBytes = sessionToken.toByteArray(StandardCharsets.UTF_8)
        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(true)
            .addServiceUuid(ParcelUuid(SERVICE_UUID))
            .addServiceData(ParcelUuid(SERVICE_UUID), tokenBytes)
            .build()

        try {
            bleAdvertiser?.startAdvertising(settings, data, advertiseCallback)
            onStatus(true, "Classroom beacon broadcasting: Token [$sessionToken]")
        } catch (e: Exception) {
            Log.e(TAG, "Exception starting BLE advertisement: ${e.message}")
            onStatus(false, "Advertising error: ${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    private fun setupGattServer() {
        gattServer = bluetoothManager?.openGattServer(context, gattServerCallback)
        val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)

        val characteristic = BluetoothGattCharacteristic(
            CHARACTERISTIC_TOKEN_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ,
            BluetoothGattCharacteristic.PERMISSION_READ
        )
        service.addCharacteristic(characteristic)
        gattServer?.addService(service)
    }

    @SuppressLint("MissingPermission")
    fun stopAdvertising() {
        if (isAdvertising && bleAdvertiser != null) {
            try {
                bleAdvertiser?.stopAdvertising(advertiseCallback)
                gattServer?.close()
                gattServer = null
                isAdvertising = false
                Log.d(TAG, "BLE Beacon advertising stopped.")
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping BLE advertising: ${e.message}")
            }
        }
    }
}
