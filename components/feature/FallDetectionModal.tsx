import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

interface FallDetectionModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirmSOS: () => void;
}

export function FallDetectionModal({ visible, onCancel, onConfirmSOS }: FallDetectionModalProps) {
  const [countdown, setCountdown] = useState(10);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    let timer: any = null;
    if (visible) {
      setCountdown(10);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
        ])
      );
      loop.start();

      let current = 10;
      timer = setInterval(() => {
        current -= 1;
        setCountdown(current);
        if (current <= 0) {
          clearInterval(timer);
          onConfirmSOS();
        }
      }, 1000);

      return () => {
        clearInterval(timer);
        loop.stop();
      };
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialIcons name="personal-injury" size={44} color={Colors.warning} />
          </Animated.View>

          <Text style={styles.title}>Fall / Impact Detected!</Text>
          <Text style={styles.subtitle}>
            A severe motion impact was detected. Emergency SOS will activate automatically in:
          </Text>

          <View style={styles.timerCircle}>
            <Text style={styles.timerText}>{countdown}</Text>
            <Text style={styles.timerUnit}>sec</Text>
          </View>

          <Text style={styles.warningNote}>
            Audible alarm and alert SMS will be sent to your trusted emergency contacts.
          </Text>

          <View style={styles.actions}>
            <Pressable style={styles.safeBtn} onPress={onCancel}>
              <MaterialIcons name="check-circle" size={24} color={Colors.success} />
              <Text style={styles.safeBtnText}>I'm Safe (Cancel)</Text>
            </Pressable>

            <Pressable style={styles.sosNowBtn} onPress={onConfirmSOS}>
              <MaterialIcons name="warning" size={20} color="#fff" />
              <Text style={styles.sosNowText}>Send SOS Now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.warning,
    ...Shadows.lg,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.warningSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.h2, color: Colors.text, textAlign: 'center', marginBottom: 6 },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  timerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.warningSurface,
    borderWidth: 3,
    borderColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  timerText: { fontSize: 42, fontWeight: '800', color: Colors.warning },
  timerUnit: { fontSize: 12, fontWeight: '700', color: Colors.warning, marginTop: -4 },
  warningNote: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', marginBottom: Spacing.xl },
  actions: { width: '100%', gap: Spacing.md },
  safeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.successSurface,
    borderColor: Colors.success,
    borderWidth: 2,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
  },
  safeBtnText: { ...Typography.button, color: Colors.successDark, fontWeight: '700' },
  sosNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.danger,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
  },
  sosNowText: { ...Typography.button, color: '#fff', fontWeight: '700' },
});
