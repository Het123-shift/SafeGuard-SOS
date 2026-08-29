package com.safeguard.sos.native

import android.app.*
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
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
 * Wired up to local cache (React Native AsyncStorage / SharedPreferences)
 * and hardware GPS location + Supabase REST API fallback.
 */
class SOSForegroundService : Service() {

    companion object {
        const val ACTION_TRIGGER_SOS = "com.safeguard.sos.ACTION_TRIGGER_SOS"
        const val ACTION_START_RECORDING = "com.safeguard.sos.ACTION_START_RECORDING"
        const val ACTION_STOP_RECORDING = "com.safeguard.sos.ACTION_STOP_RECORDING"
        const val ACTION_SMS_SENT = "com.safeguard.sos.ACTION_SMS_SENT"
        const val ACTION_SMS_DELIVERED = "com.safeguard.sos.ACTION_SMS_DELIVERED"
        const val EXTRA_SOURCE = "source"
        const val EXTRA_RECIPIENT = "recipient"

        private const val CHANNEL_ID = "sos_channel"
        private const val NOTIFICATION_ID = 1001

        private const val SUPABASE_URL = "https://qjrpmofyrrfyrapqqjrp.backend.onspace.ai"
        private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJvbnNwYWNlIiwicmVmIjoicWpycG1vZnlycmZ5cmFwcXFqcnAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4MjEyMDI5MSwiZXhwIjoyMDk3NDgwMjkxfQ.3KUsuKiWWi9RZRx9D-FDfqZqNxZp6s-ytfEnVVB142Y"
    }

    private var recorder: MediaRecorder? = null

    private val smsStatusReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val recipient = intent.getStringExtra(EXTRA_RECIPIENT) ?: "contact"
            when (intent.action) {
                ACTION_SMS_SENT -> {
                    when (resultCode) {
                        android.app.Activity.RESULT_OK -> {
                            android.util.Log.i("SOSForegroundService", "✅ SMS SENT CONFIRMED by carrier to: $recipient")
                        }
                        SmsManager.RESULT_ERROR_NO_SERVICE -> {
                            android.util.Log.e("SOSForegroundService", "❌ SMS SEND FAILED: No Cellular Service available for $recipient")
                        }
                        SmsManager.RESULT_ERROR_RADIO_OFF -> {
                            android.util.Log.e("SOSForegroundService", "❌ SMS SEND FAILED: Airplane mode or Cellular Radio OFF for $recipient")
                        }
                        SmsManager.RESULT_ERROR_NULL_PDU -> {
                            android.util.Log.e("SOSForegroundService", "❌ SMS SEND FAILED: Null PDU for $recipient")
                        }
                        else -> {
                            android.util.Log.e("SOSForegroundService", "❌ SMS SEND FAILED: ResultCode $resultCode for $recipient")
                        }
                    }
                }
                ACTION_SMS_DELIVERED -> {
                    when (resultCode) {
                        android.app.Activity.RESULT_OK -> {
                            android.util.Log.i("SOSForegroundService", "📬 SMS DELIVERED to recipient handset: $recipient")
                        }
                        else -> {
                            android.util.Log.w("SOSForegroundService", "⚠️ SMS Delivery receipt failed with code $resultCode for: $recipient")
                        }
                    }
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildSOSNotification())

        val filter = android.content.IntentFilter().apply {
            addAction(ACTION_SMS_SENT)
            addAction(ACTION_SMS_DELIVERED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsStatusReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(smsStatusReceiver, filter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(smsStatusReceiver)
        } catch (e: Exception) {
            // Safe ignore if receiver was not registered
        }
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
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_dialog_alert, "SOS NOW", sosPendingIntent)
            .setOngoing(true)
            .build()
    }

    // ---------- SOS trigger: call + SMS per contact ----------

    private fun triggerSOS(source: String) {
        // Start recording FIRST, automatically for every trigger source
        startVoiceRecording()

        // Execute dispatch on background thread to handle network & telephony safely
        Thread {
            val contacts = getPriorityContacts()
            val locationLink = getLastKnownLocationLink()
            val alertMessage = buildAlertMessage(locationLink)

            for (contact in contacts) {
                val normalizedPhone = normalizePhoneNumberToE164(contact.phoneNumber) ?: contact.phoneNumber
                callContact(normalizedPhone)
                sendSMS(normalizedPhone, alertMessage)
            }

            // WhatsApp fallback for first contact (deep-link wa.me via ACTION_VIEW)
            openWhatsAppForFirstContact(contacts, alertMessage)

            logSOSEvent(source, contacts.size)
        }.start()
    }

    private fun callContact(phoneNumber: String) {
        if (phoneNumber.isBlank()) return
        try {
            val callIntent = Intent(Intent.ACTION_CALL).apply {
                data = android.net.Uri.parse("tel:$phoneNumber")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(callIntent)
        } catch (e: Exception) {
            android.util.Log.e("SOSForegroundService", "Failed to place call to $phoneNumber: ${e.message}")
        }
    }

    private fun sendSMS(phoneNumber: String, message: String) {
        if (phoneNumber.isBlank()) return
        val targetPhone = normalizePhoneNumberToE164(phoneNumber) ?: phoneNumber
        try {
            val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }
            val parts = smsManager.divideMessage(message)

            val sentIntents = ArrayList<PendingIntent>()
            val deliveredIntents = ArrayList<PendingIntent>()

            for (i in parts.indices) {
                val sentIntent = Intent(ACTION_SMS_SENT).apply {
                    putExtra(EXTRA_RECIPIENT, targetPhone)
                    setPackage(packageName)
                }
                val deliveredIntent = Intent(ACTION_SMS_DELIVERED).apply {
                    putExtra(EXTRA_RECIPIENT, targetPhone)
                    setPackage(packageName)
                }
                val sentPI = PendingIntent.getBroadcast(
                    this,
                    (System.currentTimeMillis() + i).toInt(),
                    sentIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val deliveredPI = PendingIntent.getBroadcast(
                    this,
                    (System.currentTimeMillis() + i + 500).toInt(),
                    deliveredIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                sentIntents.add(sentPI)
                deliveredIntents.add(deliveredPI)
            }

            smsManager.sendMultipartTextMessage(targetPhone, null, parts, sentIntents, deliveredIntents)
            android.util.Log.i("SOSForegroundService", "Dispatched multipart SMS (${parts.size} parts) via native SmsManager to: $targetPhone")
        } catch (e: SecurityException) {
            android.util.Log.e("SOSForegroundService", "❌ SecurityException: SEND_SMS runtime permission has NOT been granted for $targetPhone: ${e.message}")
        } catch (e: Exception) {
            android.util.Log.e("SOSForegroundService", "❌ Failed to send SMS to $targetPhone: ${e.message}")
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
        val trackingId = "sos_${System.currentTimeMillis()}"
        val liveTrackingUrl = "https://safeguard-sos.app/track/$trackingId"
        return "EMERGENCY SOS ALERT — I need urgent help!\nTrack Live: $liveTrackingUrl\nGoogle Maps: $locationLink (at $timestamp) — sent via SafeGuard SOS"
    }

    // ---------- Voice recording (parallel to SOS dispatch) ----------

    private fun startVoiceRecording() {
        if (recorder != null) return

        val outputFile = File(getExternalFilesDir(null), "sos_evidence_${System.currentTimeMillis()}.m4a")
        recorder = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setOutputFile(outputFile.absolutePath)
                prepare()
                start()
            }
        } catch (e: Exception) {
            android.util.Log.e("SOSForegroundService", "Failed to start audio recording: ${e.message}")
            null
        }
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

    // ---------- Wired helper implementations ----------

    private data class Contact(val phoneNumber: String, val name: String)

    private fun getPriorityContacts(): List<Contact> {
        val result = mutableListOf<Contact>()

        // 1. Try reading from React Native AsyncStorage SQLite DB (RKStorage / AsyncStorage.db)
        try {
            val dbFile = getDatabasePath("RKStorage")
            val altDbFile = getDatabasePath("AsyncStorage.db")
            val targetFile = if (dbFile.exists()) dbFile else if (altDbFile.exists()) altDbFile else null

            if (targetFile != null) {
                val db = android.database.sqlite.SQLiteDatabase.openDatabase(
                    targetFile.absolutePath,
                    null,
                    android.database.sqlite.SQLiteDatabase.OPEN_READONLY
                )
                val cursor = db.rawQuery(
                    "SELECT value FROM catalystLocalStorage WHERE key = ?",
                    arrayOf("@safeguard_contacts")
                )
                if (cursor.moveToFirst()) {
                    val jsonVal = cursor.getString(0)
                    val jsonArray = JSONArray(jsonVal)
                    for (i in 0 until jsonArray.length()) {
                        val obj = jsonArray.getJSONObject(i)
                        val phone = obj.optString("phone", "")
                        val name = obj.optString("name", "")
                        val isPriority = obj.optBoolean("isPriority", false)
                        if (phone.isNotEmpty() && (isPriority || result.isEmpty())) {
                            result.add(Contact(phone, name))
                        }
                    }
                }
                cursor.close()
                db.close()
            }
        } catch (e: Exception) {
            android.util.Log.w("SOSForegroundService", "Error reading contacts from AsyncStorage DB: ${e.message}")
        }

        // 2. Fallback to SharedPreferences "safeguard_sos_prefs"
        if (result.isEmpty()) {
            try {
                val prefs = getSharedPreferences("safeguard_sos_prefs", Context.MODE_PRIVATE)
                val jsonVal = prefs.getString("priority_contacts", null)
                if (jsonVal != null) {
                    val jsonArray = JSONArray(jsonVal)
                    for (i in 0 until jsonArray.length()) {
                        val obj = jsonArray.getJSONObject(i)
                        val phone = obj.optString("phone", "")
                        val name = obj.optString("name", "")
                        if (phone.isNotEmpty()) {
                            result.add(Contact(phone, name))
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.w("SOSForegroundService", "Error reading contacts from SharedPreferences: ${e.message}")
            }
        }

        // 3. Fallback to Supabase / OnSpace REST API fetch if network is available
        if (result.isEmpty()) {
            val httpContacts = fetchContactsFromSupabase()
            result.addAll(httpContacts)
        }

        return result
    }

    private fun fetchContactsFromSupabase(): List<Contact> {
        val result = mutableListOf<Contact>()
        try {
            val url = java.net.URL("$SUPABASE_URL/rest/v1/contacts?select=name,phone,is_priority")
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY)
            conn.setRequestProperty("Authorization", "Bearer $SUPABASE_ANON_KEY")
            conn.connectTimeout = 3000
            conn.readTimeout = 3000
            if (conn.responseCode == 200) {
                val stream = conn.inputStream
                val text = stream.bufferedReader().use { it.readText() }
                val jsonArray = JSONArray(text)
                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    val phone = obj.optString("phone", "")
                    val name = obj.optString("name", "")
                    val isPriority = obj.optBoolean("is_priority", false)
                    if (phone.isNotEmpty() && (isPriority || result.isEmpty())) {
                        result.add(Contact(phone, name))
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("SOSForegroundService", "Supabase HTTP fetch error: ${e.message}")
        }
        return result
    }

    private fun getLastKnownLocationLink(): String {
        try {
            val locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            if (locationManager != null) {
                val providers = locationManager.getProviders(true)
                var bestLocation: Location? = null
                for (provider in providers) {
                    val l = try {
                        locationManager.getLastKnownLocation(provider)
                    } catch (e: SecurityException) { null }
                    if (l != null && (bestLocation == null || l.accuracy < bestLocation.accuracy)) {
                        bestLocation = l
                    }
                }
                if (bestLocation != null) {
                    return "https://maps.google.com/?q=${bestLocation.latitude},${bestLocation.longitude}"
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("SOSForegroundService", "Error getting location: ${e.message}")
        }

        try {
            val prefs = getSharedPreferences("safeguard_sos_prefs", Context.MODE_PRIVATE)
            val cachedLat = prefs.getString("last_lat", null)
            val cachedLng = prefs.getString("last_lng", null)
            if (cachedLat != null && cachedLng != null) {
                return "https://maps.google.com/?q=$cachedLat,$cachedLng"
            }
        } catch (e: Exception) {
            // ignore
        }

        return "https://maps.google.com/?q=0,0"
    }

    private fun logSOSEvent(source: String, contactCount: Int) {
        try {
            val prefs = getSharedPreferences("safeguard_sos_prefs", Context.MODE_PRIVATE)
            val timestamp = System.currentTimeMillis()
            val eventJson = JSONObject().apply {
                put("timestamp", timestamp)
                put("source", source)
                put("contactCount", contactCount)
            }.toString()
            prefs.edit().putString("last_sos_event", eventJson).apply()
        } catch (e: Exception) {
            android.util.Log.w("SOSForegroundService", "Failed to log SOS event: ${e.message}")
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
