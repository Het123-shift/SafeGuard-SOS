package com.safeguard.sos.native

import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi

/**
 * Android Quick Settings Tile allowing instant one-tap emergency trigger
 * directly from the system notification / quick settings shade.
 */
@RequiresApi(Build.VERSION_CODES.N)
class SOSTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        val tile = qsTile ?: return
        tile.state = Tile.STATE_INACTIVE
        tile.label = "SafeGuard SOS"
        tile.contentDescription = "Trigger Emergency SafeGuard SOS Alert"
        tile.updateTile()
    }

    override fun onClick() {
        super.onClick()
        val tile = qsTile
        if (tile != null) {
            tile.state = Tile.STATE_ACTIVE
            tile.updateTile()
        }

        val sosIntent = Intent(this, SOSForegroundService::class.java).apply {
            action = SOSForegroundService.ACTION_TRIGGER_SOS
            putExtra(SOSForegroundService.EXTRA_SOURCE, "quick_settings_tile")
        }
        startForegroundService(sosIntent)

        // Reset tile state after brief visual feedback
        if (tile != null) {
            tile.state = Tile.STATE_INACTIVE
            tile.updateTile()
        }
    }
}
