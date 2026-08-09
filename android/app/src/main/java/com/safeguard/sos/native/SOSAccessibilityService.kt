package com.safeguard.sos.native

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.util.Log

/**
 * Detects rapid screen on/off cycles (triple power-button press) while the
 * device is locked/screen-off. Android does NOT expose raw hardware power-
 * button KeyEvents to third-party apps — SCREEN_ON/SCREEN_OFF broadcasts are
 * the only legitimate signal available, so we count those instead.
 *
 * This only works while the OS is running (screen off / locked). A device
 * that is fully powered down cannot be intercepted by any app — there is no
 * software running to catch the button press.
 */
class SOSAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "SOSAccessibilityService"
        private const val PRESS_WINDOW_MS = 2000L   // all 3 presses must land inside this window
        private const val REQUIRED_PRESSES = 3
    }

    private val pressTimestamps = mutableListOf<Long>()

    private val screenStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_OFF -> registerPress()
                Intent.ACTION_SCREEN_ON -> registerPress()
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        }
        registerReceiver(screenStateReceiver, filter)
        Log.d(TAG, "SOS accessibility service connected")
    }

    private fun registerPress() {
        val now = SystemClock.elapsedRealtime()
        pressTimestamps.add(now)
        // drop anything outside the rolling window
        pressTimestamps.removeAll { now - it > PRESS_WINDOW_MS }

        if (pressTimestamps.size >= REQUIRED_PRESSES) {
            pressTimestamps.clear()
            triggerSOSWithRecording()
        }
    }

    private fun triggerSOSWithRecording() {
        Log.d(TAG, "Triple press detected — firing SOS trigger")

        // Recording is started inside SOSForegroundService.triggerSOS()
        // itself for every source — no need to fire a separate recording
        // intent here.
        val sosIntent = Intent(this, SOSForegroundService::class.java).apply {
            action = SOSForegroundService.ACTION_TRIGGER_SOS
            putExtra(SOSForegroundService.EXTRA_SOURCE, "power_button_triple_press")
        }
        startForegroundService(sosIntent)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used — we only need the service alive for the screen broadcasts.
        // Required override, intentionally empty.
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(screenStateReceiver)
        } catch (e: IllegalArgumentException) {
            // receiver was never registered — safe to ignore
        }
    }
}
