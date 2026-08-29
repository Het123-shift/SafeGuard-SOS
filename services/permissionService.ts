import { Platform, PermissionsAndroid } from 'react-native';

export interface PermissionStatus {
  smsGranted: boolean;
  callGranted: boolean;
  locationGranted: boolean;
  audioGranted: boolean;
}

/**
 * Checks and requests Android SMS, Call Phone, Location, and Audio Recording runtime permissions.
 * Essential for native SmsManager background dispatch, direct calling, and emergency evidence recording.
 */
export async function requestSMSAndEmergencyPermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    return { smsGranted: true, callGranted: true, locationGranted: true, audioGranted: true };
  }

  try {
    const permissionsToRequest = [
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ];

    const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

    const smsGranted = granted[PermissionsAndroid.PERMISSIONS.SEND_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    const callGranted = granted[PermissionsAndroid.PERMISSIONS.CALL_PHONE] === PermissionsAndroid.RESULTS.GRANTED;
    const locationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
    const audioGranted = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;

    console.log('[PermissionService] Emergency permissions granted status:', {
      smsGranted,
      callGranted,
      locationGranted,
      audioGranted,
    });

    return { smsGranted, callGranted, locationGranted, audioGranted };
  } catch (err) {
    console.warn('[PermissionService] Error requesting emergency permissions:', err);
    return { smsGranted: false, callGranted: false, locationGranted: false, audioGranted: false };
  }
}

/**
 * Checks current status of SEND_SMS permission without triggering a system prompt.
 */
export async function checkSMSPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
  } catch (err) {
    console.warn('[PermissionService] Error checking SMS permission:', err);
    return false;
  }
}

/**
 * Checks current status of RECORD_AUDIO permission without triggering a system prompt.
 */
export async function checkAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  } catch (err) {
    console.warn('[PermissionService] Error checking audio recording permission:', err);
    return false;
  }
}
