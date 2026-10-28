# ProGuard rules for Smart College Attendance (Google Play Store Release)

# Retain Retrofit & OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature
-keepattributes Exceptions
-keepattributes *Annotation*

# Retain Gson Models
-keep class com.college.attendance.model.** { *; }
-keepclassmembers class com.college.attendance.model.** { *; }

# Retain CameraX
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# Bluetooth LE Callbacks
-keepclassmembers class * extends android.bluetooth.le.AdvertiseCallback {
    public void onStartSuccess(android.bluetooth.le.AdvertiseSettings);
    public void onStartFailure(int);
}

-keepclassmembers class * extends android.bluetooth.le.ScanCallback {
    public void onScanResult(int, android.bluetooth.le.ScanResult);
    public void onBatchScanResults(java.util.List);
    public void onScanFailed(int);
}
