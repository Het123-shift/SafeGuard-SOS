package com.safeguard.sos.native

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.safeguard.sos.R

/**
 * Home-screen widget: a single SOS button that fires the trigger directly,
 * with NO round-trip through MainActivity / the app UI. Wires the PendingIntent
 * straight to the foreground service to keep it instant.
 */
class SOSWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_sos)

            val sosIntent = Intent(context, SOSForegroundService::class.java).apply {
                action = SOSForegroundService.ACTION_TRIGGER_SOS
                putExtra(SOSForegroundService.EXTRA_SOURCE, "home_screen_widget")
            }
            val pendingIntent = PendingIntent.getService(
                context, 0, sosIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            views.setOnClickPendingIntent(R.id.widget_sos_button, pendingIntent)
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
