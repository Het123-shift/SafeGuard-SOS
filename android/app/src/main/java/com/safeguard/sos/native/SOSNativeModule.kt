package com.safeguard.sos.native

import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.SmsManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SOSNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "SOSNativeModule"
        var pendingTriggerSource: String? = null
        var currentInstance: SOSNativeModule? = null

        fun notifyHardwareTrigger(context: Context?, source: String) {
            pendingTriggerSource = source
            currentInstance?.sendEvent("onHardwareSOSTriggered", source)
        }
    }

    init {
        currentInstance = this
    }

    override fun getName() = "SOSNativeModule"

    private fun sendEvent(eventName: String, params: Any?) {
        try {
            if (reactApplicationContext.hasActiveReactInstance()) {
                reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, params)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event: $eventName", e)
        }
    }

    @ReactMethod
    fun getPendingTrigger(promise: Promise) {
        val src = pendingTriggerSource
        pendingTriggerSource = null
        promise.resolve(src)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun sendDirectSMS(phones: ReadableArray, message: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(message)

            for (i in 0 until phones.size()) {
                val rawPhone = phones.getString(i) ?: continue
                val cleanPhone = rawPhone.replace(Regex("[^0-9+]"), "")
                if (cleanPhone.isBlank()) continue

                try {
                    smsManager.sendMultipartTextMessage(cleanPhone, null, parts, null, null)
                    Log.d(TAG, "Direct SMS successfully queued for: $cleanPhone")
                } catch (smsErr: Exception) {
                    Log.e(TAG, "Failed sending SMS to $cleanPhone: ${smsErr.message}")
                }
            }

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "sendDirectSMS top-level error: ${e.message}", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun triggerSOS(source: String, promise: Promise) {
        try {
            Log.d(TAG, "triggerSOS invoked from source: $source")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SOS_TRIGGER_FAILED", e)
        }
    }

    @ReactMethod
    fun startRecording(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun ensureForegroundServiceRunning(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun syncCachedData(contactsJson: String, latStr: String, lngStr: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("SafeGuardSOSPrefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("cached_contacts", contactsJson)
                .putString("cached_lat", latStr)
                .putString("cached_lng", lngStr)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
