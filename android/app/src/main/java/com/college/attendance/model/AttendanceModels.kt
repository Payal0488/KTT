package com.college.attendance.model

import com.google.gson.annotations.SerializedName

data class BleSessionPayload(
    val sessionId: Long,
    val token: String,
    val serviceUuid: String,
    val ttlMinutes: Int,
    val timestamp: Long = System.currentTimeMillis()
)

data class LoginRequest(
    val username: String,
    val password: String
)

data class LoginResponse(
    val message: String,
    val token: String,
    val user: UserInfo
)

data class UserInfo(
    val id: Long,
    val username: String,
    val role: String,
    val fullName: String,
    val phone: String?
)

data class MarkAttendanceResponse(
    val message: String,
    val recordId: Long,
    val status: String,
    val bleVerified: Boolean,
    val selfieStatus: String,
    val selfieUrl: String?
)
