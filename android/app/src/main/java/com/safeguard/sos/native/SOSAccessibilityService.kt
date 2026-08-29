package com.safeguard.sos.native

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

/**
 * Detects rapid Volume button triple-presses (Volume Down or Up x3 within 3500ms)
 * to trigger emergency SOS.
 */
class SOSAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "SOSAccessibilityService"
        private const val PRESS_WINDOW_MS = 3500L
        private const val REQUIRED_PRESSES = 3
    }

    private val volumePressTimestamps = mutableListOf<Long>()

    override fun onKeyEvent(event: KeyEvent?): Boolean {
        if (event == null) return false

        if (event.action == KeyEvent.ACTION_DOWN) {
            val keyCode = event.keyCode
            if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                val now = SystemClock.elapsedRealtime()
                volumePressTimestamps.add(now)
                volumePressTimestamps.removeAll { now - it > PRESS_WINDOW_MS }

                Log.d(TAG, "Hardware Volume key press recorded (${volumePressTimestamps.size}/$REQUIRED_PRESSES)")

                if (volumePressTimestamps.size >= REQUIRED_PRESSES) {
                    volumePressTimestamps.clear()
                    triggerHardwareSOS()
                }
            }
        }
        return super.onKeyEvent(event)
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "SOSAccessibilityService CONNECTED and ACTIVE on device.")
    }

    private fun triggerHardwareSOS() {
        Log.d(TAG, "Volume triple-press confirmed! Opening app and triggering emergency SOS...")
        
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            val wakeLock = powerManager?.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "safeguardsos:wake_volume_sos"
            )
            wakeLock?.acquire(3000)
        } catch (e: Exception) {
            Log.w(TAG, "Could not acquire wakelock: ${e.message}")
        }

        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            action = "TRIGGER_SOS_HARDWARE"
            putExtra("source", "volume_button_triple_press")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        if (intent != null) {
            startActivity(intent)
        }

        SOSNativeModule.notifyHardwareTrigger(this, "volume_button_triple_press")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {
        Log.d(TAG, "SOSAccessibilityService interrupted.")
    }
}
