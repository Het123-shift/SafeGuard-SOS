import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSOS } from '@/hooks/useSOS';
import { Colors, Typography, Spacing } from '@/constants/theme';

export const SOSButton = React.memo(function SOSButton() {
  const { phase, countdown, activeSeconds, startArming, cancelSOS, triggerSOS, deactivateSOS } = useSOS();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === 'active') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      glow.start();
      return () => { pulse.stop(); glow.stop(); };
    } else {
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
      glowAnim.setValue(0);
    }
  }, [phase]);

  const handlePressIn = () => {
    if (phase !== 'idle') return;
    startArming();
    setHoldProgress(0);
    let progress = 0;
    holdInterval.current = setInterval(() => {
      progress += 10;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearHold();
        triggerSOS();
      }
    }, 30);
    pressTimer.current = setTimeout(() => {}, 3000);
  };

  const handlePressOut = () => {
    if (phase === 'arming') {
      clearHold();
      cancelSOS();
      setHoldProgress(0);
    }
  };

  const clearHold = () => {
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null; }
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (phase === 'active') {
    return (
      <View style={styles.activeContainer}>
        <Animated.View style={[styles.glowRing, { opacity: glowAnim }]} />
        <Animated.View style={[styles.glowRingOuter, { opacity: Animated.multiply(glowAnim, 0.5) }]} />
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable style={[styles.btn, styles.btnActive]} onPress={deactivateSOS}>
            <MaterialIcons name="warning" size={42} color="#fff" />
            <Text style={styles.btnLabelActive}>SOS ACTIVE</Text>
            <Text style={styles.timer}>{formatTime(activeSeconds)}</Text>
          </Pressable>
        </Animated.View>
        <Text style={styles.tapToCancel}>Tap to deactivate</Text>
      </View>
    );
  }

  if (phase === 'countdown') {
    return (
      <View style={styles.countdownContainer}>
        <View style={styles.countdownRing}>
          <Text style={styles.countdownNum}>{countdown}</Text>
        </View>
        <Text style={styles.countdownLabel}>SOS sending in...</Text>
        <Pressable style={styles.cancelBtn} onPress={cancelSOS}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.outerRing}>
        <View style={styles.middleRing}>
          <Pressable
            style={[styles.btn, phase === 'arming' && styles.btnArming]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            {phase === 'arming' ? (
              <View style={styles.holdContent}>
                <View style={[styles.holdRing, { borderColor: `rgba(255,255,255,${holdProgress / 100})` }]}>
                  <Text style={styles.holdPct}>{Math.round(holdProgress)}%</Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.btnLabel}>SOS</Text>
                <MaterialIcons name="warning" size={28} color="rgba(255,255,255,0.9)" />
              </>
            )}
          </Pressable>
        </View>
      </View>
      <Text style={styles.instruction}>
        {phase === 'arming' ? 'Keep holding...' : 'Tap & hold for 3 seconds'}
      </Text>
    </View>
  );
});

const SIZE = 160;
const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  outerRing: {
    width: SIZE + 48,
    height: SIZE + 48,
    borderRadius: (SIZE + 48) / 2,
    backgroundColor: 'rgba(255,45,45,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRing: {
    width: SIZE + 24,
    height: SIZE + 24,
    borderRadius: (SIZE + 24) / 2,
    backgroundColor: 'rgba(255,45,45,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2D2D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  btnArming: {
    backgroundColor: Colors.primaryDark,
    transform: [{ scale: 0.96 }],
  },
  btnActive: {
    backgroundColor: Colors.primary,
    width: SIZE + 20,
    height: SIZE + 20,
    borderRadius: (SIZE + 20) / 2,
  },
  btnLabel: { ...Typography.display, color: '#fff', fontWeight: '800' },
  btnLabelActive: { ...Typography.h4, color: '#fff', marginTop: 2 },
  timer: { ...Typography.h3, color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginTop: 4 },
  instruction: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.base, textAlign: 'center' },
  holdContent: { alignItems: 'center', justifyContent: 'center' },
  holdRing: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  holdPct: { ...Typography.h3, color: '#fff', fontWeight: '700' },
  activeContainer: { alignItems: 'center' },
  glowRing: {
    position: 'absolute',
    width: SIZE + 80, height: SIZE + 80,
    borderRadius: (SIZE + 80) / 2,
    backgroundColor: 'rgba(255,45,45,0.2)',
    top: -20, left: -20,
  },
  glowRingOuter: {
    position: 'absolute',
    width: SIZE + 140, height: SIZE + 140,
    borderRadius: (SIZE + 140) / 2,
    backgroundColor: 'rgba(255,45,45,0.1)',
    top: -50, left: -50,
  },
  tapToCancel: { ...Typography.label, color: Colors.textSecondary, marginTop: Spacing.base },
  countdownContainer: { alignItems: 'center' },
  countdownRing: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    borderWidth: 5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primarySurface,
  },
  countdownNum: { fontSize: 72, fontWeight: '800', color: Colors.primary },
  countdownLabel: { ...Typography.h4, color: Colors.text, marginTop: Spacing.base },
  cancelBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md,
    borderRadius: 100,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  cancelText: { ...Typography.button, color: Colors.text },
});
