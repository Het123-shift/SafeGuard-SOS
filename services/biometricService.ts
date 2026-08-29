import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = '@safeguard_biometric_enabled';

class BiometricService {
  public async isHardwareAvailable(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (e) {
      console.warn('[BiometricService] Hardware check error:', e);
      return false;
    }
  }

  public async isBiometricsEnabled(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  public async setBiometricsEnabled(enabled: boolean): Promise<boolean> {
    try {
      if (enabled) {
        const available = await this.isHardwareAvailable();
        if (!available) {
          return false;
        }
        // Verify biometric identity before enabling
        const auth = await this.authenticate('Authenticate to enable biometric security');
        if (!auth.success) {
          return false;
        }
      }
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
      return true;
    } catch (e) {
      console.warn('[BiometricService] Error setting biometric preference:', e);
      return false;
    }
  }

  public async authenticate(promptMessage: string = 'Unlock SafeGuard Vault'): Promise<{ success: boolean; error?: string }> {
    if (Platform.OS === 'web') return { success: true };
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Use PIN',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error || 'Authentication failed' };
    } catch (e: any) {
      console.warn('[BiometricService] Authentication error:', e);
      return { success: false, error: e?.message || 'Biometric authentication unavailable' };
    }
  }
}

export const biometricService = new BiometricService();
