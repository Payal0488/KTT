package com.college.attendance.network

import android.content.Context
import android.content.SharedPreferences
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    private const val PREFS_NAME = "attendance_network_prefs"
    private const val KEY_BASE_URL = "key_base_url"
    const val DEFAULT_EMULATOR_URL = "http://10.0.2.2:5000/api/"

    private var activeBaseUrl: String = DEFAULT_EMULATOR_URL
    private var cachedApi: AttendanceApi? = null

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        activeBaseUrl = prefs.getString(KEY_BASE_URL, DEFAULT_EMULATOR_URL) ?: DEFAULT_EMULATOR_URL
        rebuildClient()
    }

    fun updateServerAddress(context: Context, newHost: String, port: Int = 5000) {
        val formatted = if (newHost.startsWith("http://") || newHost.startsWith("https://")) {
            if (newHost.endsWith("/")) "${newHost}api/" else "$newHost/api/"
        } else {
            "http://$newHost:$port/api/"
        }

        activeBaseUrl = formatted
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_BASE_URL, formatted).apply()
        rebuildClient()
    }

    fun getActiveUrl(): String = activeBaseUrl

    private fun rebuildClient() {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()

        cachedApi = Retrofit.Builder()
            .baseUrl(activeBaseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AttendanceApi::class.java)
    }

    val instance: AttendanceApi
        get() {
            if (cachedApi == null) {
                rebuildClient()
            }
            return cachedApi!!
        }
}
