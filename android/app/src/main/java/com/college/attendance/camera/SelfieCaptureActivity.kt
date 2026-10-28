package com.college.attendance.camera

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class SelfieCaptureActivity : AppCompatActivity() {

    private var imageCapture: ImageCapture? = null
    private lateinit var cameraExecutor: ExecutorService

    companion object {
        private const val TAG = "SelfieCaptureActivity"
        const val EXTRA_IMAGE_URI = "extra_image_uri"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Simple programmatic layout with PreviewView and Capture Button
        val layout = androidx.constraintlayout.widget.ConstraintLayout(this)
        val previewView = PreviewView(this).apply { id = android.view.View.generateViewId() }
        val captureBtn = Button(this).apply {
            id = android.view.View.generateViewId()
            text = "Capture Live Selfie"
            setBackgroundColor(ContextCompat.getColor(context, android.R.color.holo_green_dark))
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
        }

        layout.addView(previewView)
        layout.addView(captureBtn)

        setContentView(layout)

        // Layout constraints
        val set = androidx.constraintlayout.widget.ConstraintSet()
        set.clone(layout)
        set.connect(previewView.id, androidx.constraintlayout.widget.ConstraintSet.TOP, layout.id, androidx.constraintlayout.widget.ConstraintSet.TOP)
        set.connect(previewView.id, androidx.constraintlayout.widget.ConstraintSet.BOTTOM, captureBtn.id, androidx.constraintlayout.widget.ConstraintSet.TOP)
        set.connect(previewView.id, androidx.constraintlayout.widget.ConstraintSet.START, layout.id, androidx.constraintlayout.widget.ConstraintSet.START)
        set.connect(previewView.id, androidx.constraintlayout.widget.ConstraintSet.END, layout.id, androidx.constraintlayout.widget.ConstraintSet.END)

        set.connect(captureBtn.id, androidx.constraintlayout.widget.ConstraintSet.BOTTOM, layout.id, androidx.constraintlayout.widget.ConstraintSet.BOTTOM, 48)
        set.connect(captureBtn.id, androidx.constraintlayout.widget.ConstraintSet.START, layout.id, androidx.constraintlayout.widget.ConstraintSet.START, 32)
        set.connect(captureBtn.id, androidx.constraintlayout.widget.ConstraintSet.END, layout.id, androidx.constraintlayout.widget.ConstraintSet.END, 32)
        set.applyTo(layout)

        cameraExecutor = Executors.newSingleThreadExecutor()

        startCamera(previewView)

        captureBtn.setOnClickListener {
            takePhoto()
        }
    }

    private fun startCamera(previewView: PreviewView) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            // Prioritize front camera for selfies
            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture)
            } catch (exc: Exception) {
                Log.e(TAG, "Use case binding failed", exc)
                Toast.makeText(this, "Could not open front camera: ${exc.message}", Toast.LENGTH_SHORT).show()
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun takePhoto() {
        val imageCapture = imageCapture ?: return

        val photoFile = File(
            cacheDir,
            "selfie_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())}.jpg"
        )

        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        imageCapture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onError(exc: ImageCaptureException) {
                    Log.e(TAG, "Photo capture failed: ${exc.message}", exc)
                    Toast.makeText(baseContext, "Photo capture failed", Toast.LENGTH_SHORT).show()
                }

                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val savedUri = Uri.fromFile(photoFile)
                    val resultIntent = Intent().apply {
                        putExtra(EXTRA_IMAGE_URI, savedUri.toString())
                    }
                    setResult(Activity.RESULT_OK, resultIntent)
                    finish()
                }
            }
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
