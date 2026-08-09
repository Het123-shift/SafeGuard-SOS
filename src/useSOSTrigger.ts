import { NativeModules, Platform } from 'react-native';

const { SOSNativeModule } = NativeModules;

export type SOSSource =
  | 'in_app_button'
  | 'home_screen_widget'
  | 'lock_screen_notification'
  | 'power_button_triple_press'
  | 'fall_detection'
  | 'impact_detection'
  | 'smartwatch';

/**
 * All SOS entry points (widget, lock-screen notification, power-button
 * detector, in-app button, fall detection, impact detection, smartwatch)
 * route through the same native SOSForegroundService — one trigger path,
 * multiple doors into it.
 */
export async function triggerSOS(source: SOSSource = 'in_app_button') {
  if (Platform.OS !== 'android') {
    return false;
  }
  if (!SOSNativeModule) {
    console.warn('SOSNativeModule is not available in current runtime.');
    return false;
  }
  return SOSNativeModule.triggerSOS(source);
}

export async function startEvidenceRecording() {
  if (Platform.OS !== 'android' || !SOSNativeModule) return;
  return SOSNativeModule.startRecording();
}

export async function stopEvidenceRecording() {
  if (Platform.OS !== 'android' || !SOSNativeModule) return;
  return SOSNativeModule.stopRecording();
}

/**
 * Call once on app start (e.g. in root App layout useEffect) so the
 * foreground service — and therefore the lock-screen SOS notification and
 * power-button listener — are alive BEFORE an emergency happens.
 */
export async function ensureSOSServiceRunning() {
  if (Platform.OS !== 'android' || !SOSNativeModule) return;
  return SOSNativeModule.ensureForegroundServiceRunning();
}

/**
 * Sync cached priority contacts and last known coordinates to native SharedPreferences.
 */
export async function syncCachedSOSTriggerData(contacts: any[], lat?: number, lng?: number) {
  if (Platform.OS !== 'android' || !SOSNativeModule || !SOSNativeModule.syncCachedData) return;
  try {
    const contactsJson = JSON.stringify(contacts || []);
    const latStr = lat !== undefined ? lat.toString() : '';
    const lngStr = lng !== undefined ? lng.toString() : '';
    await SOSNativeModule.syncCachedData(contactsJson, latStr, lngStr);
  } catch (e) {
    console.warn('Failed to sync cached SOS data to native module:', e);
  }
}
