package com.college.attendance.network

import com.college.attendance.model.LoginRequest
import com.college.attendance.model.LoginResponse
import com.college.attendance.model.MarkAttendanceResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface AttendanceApi {

    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @Multipart
    @POST("student/mark-attendance")
    suspend fun markAttendance(
        @Header("Authorization") token: String,
        @Part("sessionId") sessionId: RequestBody,
        @Part("sessionToken") sessionToken: RequestBody,
        @Part("rssi") rssi: RequestBody,
        @Part selfie: MultipartBody.Part?
    ): Response<MarkAttendanceResponse>

    @GET("student/active-session")
    suspend fun getActiveSession(
        @Header("Authorization") token: String
    ): Response<Any>
}
