import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { SupabaseService } from '@/services/supabaseService';

const KEYS = {
  USER: '@safeguard_user',
  CONTACTS: '@safeguard_contacts',
  MEDICAL: '@safeguard_medical',
  SOS_HISTORY: '@safeguard_sos_history',
  FAMILY: '@safeguard_family',
  ONBOARDED: '@safeguard_onboarded',
  EVIDENCE: '@safeguard_evidence',
  VAULT_PIN_HASH: '@safeguard_vault_pin_hash',
  FAILED_ATTEMPTS: '@safeguard_failed_attempts',
  LOCKOUT_UNTIL: '@safeguard_lockout_until',
};

export interface LockoutStatus {
  isLockedOut: boolean;
  remainingSeconds: number;
}

export const StorageService = {
  // Save Vault PIN locally (SHA-256) + server sync
  async saveVaultPin(pin: string): Promise<void> {
    await this.resetFailedPinAttempts();
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
    await AsyncStorage.setItem(KEYS.VAULT_PIN_HASH, hash);
    try {
      await SupabaseService.setServerVaultPin(pin);
    } catch (e) {
      // server sync fallback
    }
  },

  // Verify PIN locally via SHA-256 with server fallback
  async verifyVaultPin(inputPin: string): Promise<boolean> {
    const localHash = await AsyncStorage.getItem(KEYS.VAULT_PIN_HASH);
    if (localHash) {
      const inputHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, inputPin);
      if (inputHash === localHash) {
        await this.resetFailedPinAttempts();
        return true;
      }
    }

    const serverResult = await SupabaseService.verifyServerVaultPin(inputPin);
    if (serverResult && typeof serverResult === 'object') {
      if (serverResult.is_locked_out) {
        const lockoutTime = Date.now() + (serverResult.remaining_seconds || 300) * 1000;
        await AsyncStorage.setItem(KEYS.LOCKOUT_UNTIL, lockoutTime.toString());
        return false;
      }
      if (serverResult.success) {
        const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, inputPin);
        await AsyncStorage.setItem(KEYS.VAULT_PIN_HASH, hash);
        await this.resetFailedPinAttempts();
        return true;
      }
    }

    return false;
  },

  async hasVaultPin(): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEYS.VAULT_PIN_HASH);
    return !!val;
  },

  // PIN Lockout Rate Limiting (5 attempts -> 5 min lockout)
  async getLockoutStatus(): Promise<LockoutStatus> {
    const untilStr = await AsyncStorage.getItem(KEYS.LOCKOUT_UNTIL);
    if (!untilStr) return { isLockedOut: false, remainingSeconds: 0 };
    const lockoutUntil = parseInt(untilStr, 10);
    const now = Date.now();
    if (now < lockoutUntil) {
      return {
        isLockedOut: true,
        remainingSeconds: Math.ceil((lockoutUntil - now) / 1000),
      };
    }
    await AsyncStorage.removeItem(KEYS.LOCKOUT_UNTIL);
    await AsyncStorage.setItem(KEYS.FAILED_ATTEMPTS, '0');
    return { isLockedOut: false, remainingSeconds: 0 };
  },

  async recordFailedPinAttempt(): Promise<{ isLockedOut: boolean; attemptsLeft: number }> {
    const currentStr = (await AsyncStorage.getItem(KEYS.FAILED_ATTEMPTS)) || '0';
    const nextAttempts = parseInt(currentStr, 10) + 1;
    await AsyncStorage.setItem(KEYS.FAILED_ATTEMPTS, nextAttempts.toString());

    if (nextAttempts >= 5) {
      const lockoutUntil = Date.now() + 5 * 60 * 1000; // 5 minutes lockout
      await AsyncStorage.setItem(KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
      return { isLockedOut: true, attemptsLeft: 0 };
    }

    return { isLockedOut: false, attemptsLeft: 5 - nextAttempts };
  },

  async resetFailedPinAttempts(): Promise<void> {
    await AsyncStorage.setItem(KEYS.FAILED_ATTEMPTS, '0');
    await AsyncStorage.removeItem(KEYS.LOCKOUT_UNTIL);
  },

  // User
  async saveUser(user: any) {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },
  async getUser() {
    const data = await AsyncStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  },
  async removeUser() {
    await AsyncStorage.removeItem(KEYS.USER);
  },

  // Onboarding
  async setOnboarded() {
    await AsyncStorage.setItem(KEYS.ONBOARDED, 'true');
  },
  async isOnboarded(): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEYS.ONBOARDED);
    return val === 'true';
  },

  // Contacts
  async saveContacts(contacts: any[]) {
    await AsyncStorage.setItem(KEYS.CONTACTS, JSON.stringify(contacts));
  },
  async getContacts(): Promise<any[]> {
    const data = await AsyncStorage.getItem(KEYS.CONTACTS);
    return data ? JSON.parse(data) : [];
  },

  // Medical
  async saveMedical(medical: any) {
    await AsyncStorage.setItem(KEYS.MEDICAL, JSON.stringify(medical));
  },
  async getMedical() {
    const data = await AsyncStorage.getItem(KEYS.MEDICAL);
    return data ? JSON.parse(data) : null;
  },

  // SOS History
  async addSOSEvent(event: any) {
    const history = await StorageService.getSOSHistory();
    history.unshift(event);
    await AsyncStorage.setItem(KEYS.SOS_HISTORY, JSON.stringify(history.slice(0, 50)));
  },
  async getSOSHistory(): Promise<any[]> {
    const data = await AsyncStorage.getItem(KEYS.SOS_HISTORY);
    return data ? JSON.parse(data) : [];
  },

  // Family
  async saveFamily(members: any[]) {
    await AsyncStorage.setItem(KEYS.FAMILY, JSON.stringify(members));
  },
  async getFamily(): Promise<any[]> {
    const data = await AsyncStorage.getItem(KEYS.FAMILY);
    return data ? JSON.parse(data) : [];
  },

  // Evidence
  async saveEvidence(items: any[]) {
    await AsyncStorage.setItem(KEYS.EVIDENCE, JSON.stringify(items));
  },
  async getEvidence(): Promise<any[]> {
    const data = await AsyncStorage.getItem(KEYS.EVIDENCE);
    return data ? JSON.parse(data) : [];
  },
};
