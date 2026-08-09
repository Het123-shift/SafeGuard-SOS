package com.safeguardsos.native

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.safeguardsos.R

/**
 * Home-screen widget: a single SOS button that fires the trigger directly,
 * with NO round-trip through MainActivity / the app UI. This matters —
 * routing through the activity first adds latency and a chance the app
 * cold-start fails silently; wiring the PendingIntent straight to the
 * foreground service keeps it instant.
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
