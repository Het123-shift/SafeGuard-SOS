const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Single Expo config plugin covering everything from this round:
 *  - SEND_SMS / CALL_PHONE / RECORD_AUDIO / lock-screen permissions
 *  - SOSForegroundService registration (foregroundServiceType required on Android 14+)
 *  - SOSAccessibilityService registration (power-button triple-press detection)
 *  - SOSWidgetProvider registration (home-screen widget)
 *
 * Usage in app.json:
 *   "plugins": ["./plugin/withSOSNative"]
 */
module.exports = function withSOSNative(config) {
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
    mainApplication.service.push({
      $: {
        'android:name': '.native.SOSForegroundService',
        'android:enabled': 'true',
        'android:exported': 'false',
        'android:foregroundServiceType': 'microphone|location',
      },
    });

    // ---- Accessibility service (power-button triple-press detection) ----
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

    // ---- Home screen widget ----
    mainApplication.receiver = mainApplication.receiver || [];
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

    return config;
  });

  return config;
};
