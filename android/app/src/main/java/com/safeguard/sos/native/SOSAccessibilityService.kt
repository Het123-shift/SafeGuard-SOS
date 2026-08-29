package com.safeguard.sos.native

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.util.Log

/**
 * Detects rapid hardware key sequences while the device is locked/backgrounded:
 * 1. Volume button triple-press via KeyEvent filtering (preferred, highly reliable).
 * 2. Rapid screen on/off cycles (power button proxy) via BroadcastReceiver.
 */
class SOSAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "SOSAccessibilityService"
        private const val PRESS_WINDOW_MS = 1500L   // all 3 presses must land inside this window
        private const val REQUIRED_PRESSES = 3
    }

    private val powerPressTimestamps = mutableListOf<Long>()
    private val volumePressTimestamps = mutableListOf<Long>()

    private val screenStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_OFF -> registerPowerPress()
                Intent.ACTION_SCREEN_ON -> registerPowerPress()
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
        Log.d(TAG, "SOS accessibility service connected — Volume and Power monitoring active")
    }

    override fun onKeyEvent(event: KeyEvent?): Boolean {
        if (event == null) return false

        if (event.action == KeyEvent.ACTION_DOWN) {
            val keyCode = event.keyCode
            if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                val now = SystemClock.elapsedRealtime()
                volumePressTimestamps.add(now)
                volumePressTimestamps.removeAll { now - it > PRESS_WINDOW_MS }

                if (volumePressTimestamps.size >= REQUIRED_PRESSES) {
                    volumePressTimestamps.clear()
                    Log.d(TAG, "Hardware volume triple-press detected — launching SOS")
                    triggerSOS("volume_button_triple_press")
                }
            }
        }
        return super.onKeyEvent(event)
    }

    private fun registerPowerPress() {
        val now = SystemClock.elapsedRealtime()
        powerPressTimestamps.add(now)
        powerPressTimestamps.removeAll { now - it > PRESS_WINDOW_MS }

        if (powerPressTimestamps.size >= REQUIRED_PRESSES) {
            powerPressTimestamps.clear()
            Log.d(TAG, "Power button cycle triple-press detected — launching SOS")
            triggerSOS("power_button_triple_press")
        }
    }

    private fun triggerSOS(source: String) {
        val sosIntent = Intent(this, SOSForegroundService::class.java).apply {
            action = SOSForegroundService.ACTION_TRIGGER_SOS
            putExtra(SOSForegroundService.EXTRA_SOURCE, source)
        }
        startForegroundService(sosIntent)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used — required override
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
