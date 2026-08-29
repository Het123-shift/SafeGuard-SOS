let configPlugins;
try {
  configPlugins = require('@expo/config-plugins');
} catch (e) {
  try {
    const path = require('path');
    const fs = require('fs');
    const pnpmDir = path.join(__dirname, '../node_modules/.pnpm');
    if (fs.existsSync(pnpmDir)) {
      const match = fs.readdirSync(pnpmDir).find((d) => d.startsWith('@expo+config-plugins@'));
      if (match) {
        configPlugins = require(path.join(pnpmDir, match, 'node_modules/@expo/config-plugins'));
      }
    }
  } catch (err) {
    // fallback
  }
}
const { withAndroidManifest, withStringsXml, AndroidConfig } = configPlugins || require('@expo/config-plugins');

/**
 * Expo config plugin covering:
 *  - SEND_SMS / CALL_PHONE / RECORD_AUDIO / FOREGROUND_SERVICE permissions
 *  - SOSForegroundService registration
 *  - SOSAccessibilityService registration (power-button triple-press detection)
 *  - SOSWidgetProvider registration (home-screen widget)
 *  - sos_accessibility_description string resource injection
 *
 * Usage in app.json:
 *   "plugins": ["./plugin/withSOSNative"]
 */
module.exports = function withSOSNative(config) {
  // Inject AndroidManifest entries
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    // ---- Permissions ----
    const permissions = [
      'android.permission.SEND_SMS',
      'android.permission.CALL_PHONE',
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    ];
    androidManifest.manifest['uses-permission'] = androidManifest.manifest['uses-permission'] || [];
    for (const perm of permissions) {
      const exists = androidManifest.manifest['uses-permission'].some(
        (p) => p.$['android:name'] === perm
      );
      if (!exists) {
        androidManifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    // ---- Foreground service ----
    mainApplication.service = mainApplication.service || [];
    const fgServiceExists = mainApplication.service.some(
      (s) => s.$['android:name'] === '.native.SOSForegroundService'
    );
    if (!fgServiceExists) {
      mainApplication.service.push({
        $: {
          'android:name': '.native.SOSForegroundService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone|location',
        },
      });
    }

    // ---- Accessibility service (power-button triple-press detection) ----
    const accessServiceExists = mainApplication.service.some(
      (s) => s.$['android:name'] === '.native.SOSAccessibilityService'
    );
    if (!accessServiceExists) {
      mainApplication.service.push({
        $: {
          'android:name': '.native.SOSAccessibilityService',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': '@xml/sos_accessibility_config',
            },
          },
        ],
      });
    }

    // ---- Home screen widget ----
    mainApplication.receiver = mainApplication.receiver || [];
    const widgetReceiverExists = mainApplication.receiver.some(
      (r) => r.$['android:name'] === '.native.SOSWidgetProvider'
    );
    if (!widgetReceiverExists) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.native.SOSWidgetProvider',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/sos_widget_info',
            },
          },
        ],
      });
    }

    // ---- Quick Settings Tile Service ----
    const tileServiceExists = mainApplication.service.some(
      (s) => s.$['android:name'] === '.native.SOSTileService'
    );
    if (!tileServiceExists) {
      mainApplication.service.push({
        $: {
          'android:name': '.native.SOSTileService',
          'android:icon': '@android:drawable/ic_dialog_alert',
          'android:label': 'SafeGuard SOS',
          'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }],
          },
        ],
      });
    }

    return config;
  });

  // Inject string resource in strings.xml
  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [
        {
          $: { name: 'sos_accessibility_description' },
          _: 'SafeGuard SOS needs this to detect power-button SOS triggers while your screen is locked.',
        },
      ],
      config.modResults
    );
    return config;
  });

  return config;
};
