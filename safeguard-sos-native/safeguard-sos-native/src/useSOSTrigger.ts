import { NativeModules, Platform } from 'react-native';

const { SOSNativeModule } = NativeModules;

export type SOSSource =
  | 'in_app_button'
  | 'home_screen_widget'
  | 'lock_screen_notification'
  | 'power_button_triple_press';

/**
 * All SOS entry points (widget, lock-screen notification, power-button
 * detector, and this in-app call) route through the same native
 * SOSForegroundService — one trigger path, multiple doors into it.
 * Keeps the "guaranteed same sequence every time" property from the
 * deterministic-orchestration decision.
 */
export async function triggerSOS(source: SOSSource = 'in_app_button') {
  if (Platform.OS !== 'android') {
    throw new Error(
      'Native call/SMS/power-button/widget triggers are Android-only — ' +
      'iOS blocks programmatic SMS and call sending outright.'
    );
  }
  return SOSNativeModule.triggerSOS(source);
}

export async function startEvidenceRecording() {
  if (Platform.OS !== 'android') return;
  return SOSNativeModule.startRecording();
}

export async function stopEvidenceRecording() {
  if (Platform.OS !== 'android') return;
  return SOSNativeModule.stopRecording();
}

/**
 * Call once on app start (e.g. in your root App.tsx useEffect) so the
 * foreground service — and therefore the lock-screen SOS notification and
 * power-button listener — are alive BEFORE an emergency happens, not
 * started reactively when the user opens the app mid-crisis.
 */
export async function ensureSOSServiceRunning() {
  if (Platform.OS !== 'android') return;
  return SOSNativeModule.ensureForegroundServiceRunning();
}
