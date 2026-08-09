import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { StorageService, LockoutStatus } from '@/services/storageService';

interface VaultPinModalProps {
  visible: boolean;
  onSuccess: () => void;
  onClose?: () => void;
}

export function VaultPinModal({ visible, onSuccess, onClose }: VaultPinModalProps) {
  const [pin, setPin] = useState('');
  const [hasPin, setHasPin] = useState<boolean>(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'create' | 'confirm'>('enter');
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus>({ isLockedOut: false, remainingSeconds: 0 });
  const [shakeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      checkPinAndLockout();
    }
  }, [visible]);

  useEffect(() => {
    let timer: any = null;
    if (lockoutStatus.isLockedOut && lockoutStatus.remainingSeconds > 0) {
      timer = setInterval(() => {
        setLockoutStatus((prev) => {
          if (prev.remainingSeconds <= 1) {
            clearInterval(timer);
            return { isLockedOut: false, remainingSeconds: 0 };
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutStatus.isLockedOut]);

  const checkPinAndLockout = async () => {
    const lockout = await StorageService.getLockoutStatus();
    setLockoutStatus(lockout);
    const existing = await StorageService.hasVaultPin();
    setHasPin(existing);
    setPin('');
    setConfirmPin('');
    setErrorMsg('');
    if (!existing) {
      setStep('create');
    } else {
      setStep('enter');
    }
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = async (num: string) => {
    if (lockoutStatus.isLockedOut) return;
    setErrorMsg('');
    if (step === 'enter') {
      if (pin.length < 4) {
        const next = pin + num;
        setPin(next);
        if (next.length === 4) {
          const isValid = await StorageService.verifyVaultPin(next);
          if (isValid) {
            await StorageService.resetFailedPinAttempts();
            onSuccess();
          } else {
            triggerShake();
            const failedResult = await StorageService.recordFailedPinAttempt();
            if (failedResult.isLockedOut) {
              const currentLockout = await StorageService.getLockoutStatus();
              setLockoutStatus(currentLockout);
              setErrorMsg('Too many failed attempts. Vault locked for 5 minutes.');
            } else {
              setErrorMsg(`Incorrect PIN. ${failedResult.attemptsLeft} attempt(s) remaining.`);
            }
            setTimeout(() => setPin(''), 400);
          }
        }
      }
    } else if (step === 'create') {
      if (pin.length < 4) {
        const next = pin + num;
        setPin(next);
        if (next.length === 4) {
          setConfirmPin(next);
          setPin('');
          setStep('confirm');
        }
      }
    } else if (step === 'confirm') {
      if (pin.length < 4) {
        const next = pin + num;
        setPin(next);
        if (next.length === 4) {
          if (next === confirmPin) {
            await StorageService.saveVaultPin(next);
            setHasPin(true);
            onSuccess();
          } else {
            triggerShake();
            setErrorMsg('PINs do not match. Start over.');
            setTimeout(() => {
              setPin('');
              setConfirmPin('');
              setStep('create');
            }, 600);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (lockoutStatus.isLockedOut) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.lockIconWrap}>
              <MaterialIcons
                name={lockoutStatus.isLockedOut ? 'lock-clock' : 'security'}
                size={28}
                color={lockoutStatus.isLockedOut ? Colors.danger : Colors.primary}
              />
            </View>
            <Text style={styles.title}>
              {lockoutStatus.isLockedOut
                ? 'Vault Temporarily Locked'
                : step === 'enter'
                ? 'Unlock Evidence Vault'
                : step === 'create'
                ? 'Set Vault Master PIN'
                : 'Confirm 4-Digit PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {lockoutStatus.isLockedOut
                ? `Too many failed PIN attempts. Try again in ${Math.floor(lockoutStatus.remainingSeconds / 60)}m ${lockoutStatus.remainingSeconds % 60}s.`
                : step === 'enter'
                ? 'Enter your 4-digit security PIN to access vault'
                : step === 'create'
                ? 'Create a 4-digit PIN to secure your evidence'
                : 'Re-enter your 4-digit PIN to verify'}
            </Text>
          </View>

          {/* Dots Indicator */}
          {!lockoutStatus.isLockedOut && (
            <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
              {[0, 1, 2, 3].map((idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    pin.length > idx && styles.dotFilled,
                    errorMsg ? styles.dotError : null,
                  ]}
                />
              ))}
            </Animated.View>
          )}

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Keypad */}
          {!lockoutStatus.isLockedOut && (
            <View style={styles.keypad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => {
                if (key === '') return <View key={i} style={styles.keyEmpty} />;
                if (key === 'del') {
                  return (
                    <Pressable key={i} style={styles.keyBtn} onPress={handleDelete}>
                      <MaterialIcons name="backspace" size={22} color={Colors.textSecondary} />
                    </Pressable>
                  );
                }
                return (
                  <Pressable key={i} style={styles.keyBtn} onPress={() => handleKeyPress(key)}>
                    <Text style={styles.keyText}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {onClose && (
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  lockIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.h3, color: Colors.text, textAlign: 'center', marginBottom: 4 },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: Spacing.md, marginVertical: Spacing.base },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dotError: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  errorText: { ...Typography.caption, color: Colors.danger, fontWeight: '600', marginBottom: Spacing.sm, textAlign: 'center' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', gap: Spacing.md, justifyContent: 'center' },
  keyBtn: {
    width: '28%',
    height: 60,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { ...Typography.h2, color: Colors.text, fontWeight: '700' },
  keyEmpty: { width: '28%', height: 60 },
  closeBtn: { marginTop: Spacing.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.base },
  closeText: { ...Typography.buttonSmall, color: Colors.textSecondary },
});
