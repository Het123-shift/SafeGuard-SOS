package com.safeguard.sos.native

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.telephony.SmsManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.safeguard.sos.MainActivity
import com.safeguard.sos.R
import org.json.JSONArray
import java.io.File

class SOSForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val ACTION_TRIGGER_SOS = "com.safeguard.sos.ACTION_TRIGGER_SOS"
        const val EXTRA_SOURCE = "source"
        private const val CHANNEL_ID = "safeguard_sos_fg_channel"
        private const val NOTIFICATION_ID = 2002
        private const val TAG = "SOSForegroundService"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("SafeGuard Emergency Active", "Dispatching emergency alerts..."))

        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SafeGuard:SOSForegroundWakeLock")?.apply {
                acquire(10 * 60 * 1000L) // Hold wake lock for up to 10 minutes during active emergency
            }
            Log.d(TAG, "Acquired PARTIAL_WAKE_LOCK for screen-off sensor/dispatch survival")
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock acquisition warning: ${e.message}")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val source = intent?.getStringExtra(EXTRA_SOURCE) ?: "unknown"
        Log.d(TAG, "onStartCommand: action=$action, source=$source")

        if (action == ACTION_TRIGGER_SOS) {
            triggerDirectSOS(source)
        }

        return START_STICKY
    }

    private fun triggerDirectSOS(source: String) {
        Log.d(TAG, "triggerDirectSOS: Executing background dispatch from source: $source")
        
        // 1. Dispatch SIM SMS to stored contacts if available
        try {
            val sharedPrefs = getSharedPreferences("SafeGuardSOSPrefs", Context.MODE_PRIVATE)
            val contactsJson = sharedPrefs.getString("cached_contacts", "[]") ?: "[]"
            val contactsArray = JSONArray(contactsJson)

            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val alertMsg = "EMERGENCY SOS: I need immediate assistance! Sent from SafeGuard 1-Tap Trigger ($source)."
            val parts = smsManager.divideMessage(alertMsg)

            for (i in 0 until contactsArray.length()) {
                val phone = contactsArray.optString(i)
                if (!phone.isNullOrBlank()) {
                    smsManager.sendMultipartTextMessage(phone, null, parts, null, null)
                    Log.d(TAG, "Dispatched widget SMS to $phone")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Direct SMS error in service: ${e.message}")
        }

        // 2. Update notification
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager?.notify(
            NOTIFICATION_ID,
            buildNotification("SOS Triggered ($source)", "Emergency contacts alerted successfully.")
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SafeGuard Emergency Alert",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Active emergency SOS status"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, body: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "Released PARTIAL_WAKE_LOCK on service destruction")
            }
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock release warning: ${e.message}")
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
