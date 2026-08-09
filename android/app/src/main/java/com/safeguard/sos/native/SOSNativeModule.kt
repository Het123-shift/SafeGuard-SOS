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
        try {
            val intent = Intent(reactApplicationContext, SOSForegroundService::class.java).apply {
                action = SOSForegroundService.ACTION_TRIGGER_SOS
                putExtra(SOSForegroundService.EXTRA_SOURCE, source)
            }
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SOS_TRIGGER_FAILED", e)
        }
    }

    @ReactMethod
    fun startRecording(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SOSForegroundService::class.java).apply {
                action = SOSForegroundService.ACTION_START_RECORDING
            }
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_RECORDING_FAILED", e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SOSForegroundService::class.java).apply {
                action = SOSForegroundService.ACTION_STOP_RECORDING
            }
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_RECORDING_FAILED", e)
        }
    }

    @ReactMethod
    fun ensureForegroundServiceRunning(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, SOSForegroundService::class.java)
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_START_FAILED", e)
        }
    }

    @ReactMethod
    fun syncCachedData(contactsJson: String, lat: String, lng: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("safeguard_sos_prefs", Context.MODE_PRIVATE)
            prefs.edit().apply {
                if (contactsJson.isNotBlank()) putString("priority_contacts", contactsJson)
                if (lat.isNotBlank()) putString("last_lat", lat)
                if (lng.isNotBlank()) putString("last_lng", lng)
                apply()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SYNC_FAILED", e)
        }
    }
}
