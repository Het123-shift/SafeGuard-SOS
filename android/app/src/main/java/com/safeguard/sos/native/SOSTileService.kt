package com.safeguard.sos.native

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class SOSTileService : TileService() {

    companion object {
        private const val TAG = "SOSTileService"
    }

    override fun onStartListening() {
        super.onStartListening()
        val tile = qsTile ?: return
        tile.state = Tile.STATE_INACTIVE
        tile.label = "SafeGuard SOS"
        tile.updateTile()
    }

    override fun onClick() {
        super.onClick()
        Log.d(TAG, "Quick Settings Tile clicked! Initiating Emergency SOS from lock screen...")

        val tile = qsTile
        if (tile != null) {
            tile.state = Tile.STATE_ACTIVE
            tile.updateTile()
        }

        // 1. Wake the device
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            val wakeLock = powerManager?.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "safeguardsos:wake_tile_sos"
            )
            wakeLock?.acquire(5000)
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock acquisition error: ${e.message}")
        }

        // 2. Start Foreground Service immediately (dispatches SMS from lock screen)
        try {
            val serviceIntent = Intent(this, SOSForegroundService::class.java).apply {
                action = SOSForegroundService.ACTION_TRIGGER_SOS
                putExtra(SOSForegroundService.EXTRA_SOURCE, "quick_settings_tile")
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start SOSForegroundService from tile: ${e.message}")
        }

        // 3. Launch UI over lock screen
        try {
            val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                action = "TRIGGER_SOS_HARDWARE"
                putExtra("source", "quick_settings_tile")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            }
            if (intent != null) {
                if (isLocked) {
                    unlockAndRun {
                        startActivityAndCollapse(intent)
                    }
                } else {
                    startActivityAndCollapse(intent)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Tile launch UI error: ${e.message}")
        }
    }
}
