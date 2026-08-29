package com.safeguard.sos.native

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/**
 * Bridge so the JS/RN side (your existing SOS button in-app) can trigger
 * the exact same native flow used by the widget / lock-screen notification
 * / power-button detector — one code path, multiple entry points.
 */
class SOSNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SOSNativeModule"

    @ReactMethod
    fun triggerSOS(source: String, promise: Promise) {
        android.util.Log.d("SOS_DEBUG", "SOSNativeModule.triggerSOS() called from JS. Source: $source")
        try {
            val intent = Intent(reactApplicationContext, SOSForegroundService::class.java).apply {
                action = SOSForegroundService.ACTION_TRIGGER_SOS
                putExtra(SOSForegroundService.EXTRA_SOURCE, source)
            }
            reactApplicationContext.startForegroundService(intent)
            android.util.Log.d("SOS_DEBUG", "SOSNativeModule: startForegroundService intent sent successfully.")
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("SOS_DEBUG", "SOSNativeModule: triggerSOS failed", e)
            promise.reject("SOS_TRIGGER_FAILED", e)
        }
    }

    @ReactMethod
    fun startRecording(promise: Promise) {
        android.util.Log.d("SOS_DEBUG", "SOSNativeModule.startRecording() called")
        try {
            val intent = Intent(reactApplicationContext, SOSForegroundService::class.java).apply {
                action = SOSForegroundService.ACTION_START_RECORDING
            }
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("SOS_DEBUG", "SOSNativeModule: startRecording failed", e)
            promise.reject("START_RECORDING_FAILED", e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        android.util.Log.d("SOS_DEBUG", "SOSNativeModule.stopRecording() called")
        try {
            val intent = Intent(reactApplicationContext, SOSForegroundService::class.java).apply {
                action = SOSForegroundService.ACTION_STOP_RECORDING
            }
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("SOS_DEBUG", "SOSNativeModule: stopRecording failed", e)
            promise.reject("STOP_RECORDING_FAILED", e)
        }
    }

    @ReactMethod
    fun ensureForegroundServiceRunning(promise: Promise) {
        android.util.Log.d("SOS_DEBUG", "SOSNativeModule.ensureForegroundServiceRunning() called")
        try {
            val intent = Intent(reactApplicationContext, SOSForegroundService::class.java)
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("SOS_DEBUG", "SOSNativeModule: ensureForegroundServiceRunning failed", e)
            promise.reject("SERVICE_START_FAILED", e)
        }
    }

    @ReactMethod
    fun syncCachedData(contactsJson: String, lat: String, lng: String, promise: Promise) {
        android.util.Log.d("SOS_DEBUG", "SOSNativeModule.syncCachedData() called. contactsJson length=${contactsJson.length}, lat=$lat, lng=$lng")
        try {
            val prefs = reactApplicationContext.getSharedPreferences("safeguard_sos_prefs", Context.MODE_PRIVATE)
            prefs.edit().apply {
                if (contactsJson.isNotBlank()) putString("priority_contacts", contactsJson)
                if (lat.isNotBlank()) putString("last_lat", lat)
                if (lng.isNotBlank()) putString("last_lng", lng)
                apply()
            }
            android.util.Log.d("SOS_DEBUG", "SOSNativeModule.syncCachedData() saved into SharedPreferences successfully: $contactsJson")
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("SOS_DEBUG", "SOSNativeModule: syncCachedData failed", e)
            promise.reject("SYNC_FAILED", e)
        }
    }
}
