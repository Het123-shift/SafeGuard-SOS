import { Platform, PermissionsAndroid } from 'react-native';

export interface PermissionStatus {
  smsGranted: boolean;
  callGranted: boolean;
  locationGranted: boolean;
}

/**
 * Checks and requests Android SMS, Call Phone, and Location runtime permissions.
 * Essential for native SmsManager background dispatch and direct calling.
 */
export async function requestSMSAndEmergencyPermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    return { smsGranted: true, callGranted: true, locationGranted: true };
  }

  try {
    const permissionsToRequest = [
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];

    const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

    const smsGranted = granted[PermissionsAndroid.PERMISSIONS.SEND_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    const callGranted = granted[PermissionsAndroid.PERMISSIONS.CALL_PHONE] === PermissionsAndroid.RESULTS.GRANTED;
    const locationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

    console.log('[PermissionService] Emergency permissions granted status:', {
      smsGranted,
      callGranted,
      locationGranted,
    });

    return { smsGranted, callGranted, locationGranted };
  } catch (err) {
    console.warn('[PermissionService] Error requesting emergency permissions:', err);
    return { smsGranted: false, callGranted: false, locationGranted: false };
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
