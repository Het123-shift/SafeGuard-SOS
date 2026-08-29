package com.safeguardsos.native

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * Single foreground service that:
 *  - stays alive so it can be triggered while the phone is locked
 *  - posts a lock-screen-visible notification with a direct SOS action
 *  - handles the actual SOS trigger: call + SMS to each contact
 *  - handles parallel voice recording
 *
 * Wire this up to your Supabase/OnSpace contacts table + live-location
 * link generator — the TODOs below are exactly where that plugs in.
 */
class SOSForegroundService : Service() {

    companion object {
        const val ACTION_TRIGGER_SOS = "com.safeguardsos.ACTION_TRIGGER_SOS"
        const val ACTION_START_RECORDING = "com.safeguardsos.ACTION_START_RECORDING"
        const val ACTION_STOP_RECORDING = "com.safeguardsos.ACTION_STOP_RECORDING"
        const val EXTRA_SOURCE = "source" // e.g. "power_button_triple_press", "widget", "lock_screen_notification"

        private const val CHANNEL_ID = "sos_channel"
        private const val NOTIFICATION_ID = 1001
    }

    private var recorder: MediaRecorder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        // Keep this service alive with a persistent, lock-screen-visible
        // notification the moment the app starts — this is what lets SOS
        // fire even when the phone is locked.
        startForeground(NOTIFICATION_ID, buildSOSNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TRIGGER_SOS -> {
                val source = intent.getStringExtra(EXTRA_SOURCE) ?: "unknown"
                triggerSOS(source)
            }
            ACTION_START_RECORDING -> startVoiceRecording()
            ACTION_STOP_RECORDING -> stopVoiceRecording()
        }
        return START_STICKY
    }

    /**
     * Recording is started HERE, inside triggerSOS() itself — not left to
     * each caller to remember to also fire ACTION_START_RECORDING. This is
     * what guarantees every trigger source (power button, lock-screen
     * notification, home-screen widget, in-app button, smartwatch relay,
     * fall detection, impact detection) starts recording identically,
     * without needing N separate call sites to stay in sync.
     */

    // ---------- Notification (lock-screen SOS button) ----------

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SafeGuard SOS",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Persistent SOS trigger, visible on lock screen"
                setShowBadge(true)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildSOSNotification(): Notification {
        val sosIntent = Intent(this, SOSForegroundService::class.java).apply {
            action = ACTION_TRIGGER_SOS
            putExtra(EXTRA_SOURCE, "lock_screen_notification")
        }
        val sosPendingIntent = PendingIntent.getService(
            this, 0, sosIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SafeGuard SOS active")
            .setContentText("Tap the SOS action to send an alert instantly")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            // Visible on lock screen without unlocking:
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_dialog_alert, "SOS NOW", sosPendingIntent)
            .setOngoing(true)
            .build()
    }

    // ---------- SOS trigger: call + SMS per contact ----------

    private fun triggerSOS(source: String) {
        // Start recording FIRST, before anything else
        startVoiceRecording()

        val contacts = getPriorityContacts()
        val locationLink = getLastKnownLocationLink()
        val alertMessage = buildAlertMessage(locationLink)

        for (contact in contacts) {
            callContact(contact.phoneNumber)
            sendSMS(contact.phoneNumber, alertMessage)
        }

        // WhatsApp fallback for first contact (deep-link wa.me via ACTION_VIEW)
        openWhatsAppForFirstContact(contacts, alertMessage)

        // Log the event centrally so it's auditable even if a single send fails.
        logSOSEvent(source, contacts.size)
    }

    private fun callContact(phoneNumber: String) {
        val callIntent = Intent(Intent.ACTION_CALL).apply {
            data = android.net.Uri.parse("tel:$phoneNumber")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        // Requires CALL_PHONE permission — checked before this point in production code.
        startActivity(callIntent)
    }

    private fun sendSMS(phoneNumber: String, message: String) {
        try {
            val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }
            // Split long messages automatically — location links can exceed 160 chars.
            val parts = smsManager.divideMessage(message)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
        } catch (e: Exception) {
            // TODO: queue for retry — see offline-retry note from earlier planning.
        }
    }

    private fun normalizePhoneNumberToE164(phone: String, defaultCountryCode: String = "91"): String? {
        if (phone.isBlank()) return null
        var cleaned = phone.replace(Regex("[^0-9+]"), "")
        if (cleaned.startsWith("+")) {
            cleaned = cleaned.substring(1)
        } else if (cleaned.startsWith("0") && cleaned.length == 11) {
            cleaned = defaultCountryCode + cleaned.substring(1)
        } else if (cleaned.length == 10) {
            cleaned = defaultCountryCode + cleaned
        }

        return if (cleaned.matches(Regex("^[0-9]{10,15}$"))) {
            cleaned
        } else {
            android.util.Log.w("SOSForegroundService", "Contact number failed E.164 normalization: $phone -> $cleaned")
            null
        }
    }

    private fun openWhatsAppForFirstContact(contacts: List<Contact>, message: String) {
        for (contact in contacts) {
            val normalized = normalizePhoneNumberToE164(contact.phoneNumber) ?: continue
            try {
                val encodedMsg = java.net.URLEncoder.encode(message, "UTF-8")
                val url = "https://wa.me/$normalized?text=$encodedMsg"
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = android.net.Uri.parse(url)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(intent)
                android.util.Log.d("SOSForegroundService", "WhatsApp deep-link opened for first contact: $normalized")
                break // Only open the first contact's WhatsApp chat automatically to avoid stacked UX
            } catch (e: Exception) {
                // If WhatsApp is not installed or intent fails, log and fail silently
                android.util.Log.w("SOSForegroundService", "WhatsApp not installed or intent failed for $normalized: ${e.message}")
            }
        }
    }

    private fun buildAlertMessage(locationLink: String): String {
        val timestamp = SimpleDateFormat("HH:mm:ss dd/MM", Locale.getDefault()).format(Date())
        return "SOS ALERT — I need help. Location: $locationLink (as of $timestamp) — sent via SafeGuard SOS"
    }

    // ---------- Voice recording (parallel to SOS dispatch) ----------

    private fun startVoiceRecording() {
        if (recorder != null) return // already recording

        val outputFile = File(getExternalFilesDir(null), "sos_evidence_${System.currentTimeMillis()}.m4a")
        recorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setOutputFile(outputFile.absolutePath)
            try {
                prepare()
                start()
            } catch (e: Exception) {
                recorder = null
                return
            }
        }
        // TODO: after recording stops, encrypt + upload to Evidence Vault
        // bucket (AES-256, same pattern as your existing vault implementation).
    }

    private fun stopVoiceRecording() {
        recorder?.apply {
            try {
                stop()
            } catch (e: Exception) { /* ignore — recording may be too short */ }
            release()
        }
        recorder = null
    }

    // ---------- Stubs to wire to your existing backend ----------

    private data class Contact(val phoneNumber: String, val name: String)

    private fun getPriorityContacts(): List<Contact> {
        // TODO: read from local cache first (works offline), fall back to
        // Supabase/OnSpace fetch when online.
        return emptyList()
    }

    private fun getLastKnownLocationLink(): String {
        // TODO: pull last cached GPS fix, format as https://maps.google.com/?q=lat,lng
        return "https://maps.google.com/?q=0,0"
    }

    private fun logSOSEvent(source: String, contactCount: Int) {
        // TODO: write to sos_events table for audit trail.
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
