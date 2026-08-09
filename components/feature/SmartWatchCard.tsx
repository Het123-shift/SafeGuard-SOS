import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { watchService, WatchStatus } from '@/services/watchService';
import { motionService } from '@/services/motionService';

export function SmartWatchCard() {
  const router = useRouter();
  const [status, setStatus] = useState<WatchStatus>(watchService.getStatus());

  useEffect(() => {
    watchService.startHeartRateMonitoring();
    const interval = setInterval(() => {
      setStatus(watchService.getStatus());
    }, 2500);

    return () => {
      clearInterval(interval);
      watchService.stopHeartRateMonitoring();
    };
  }, []);

  const handleTestWatchTrigger = () => {
    watchService.triggerWatchSOS();
  };

  const handleSimulateFall = () => {
    motionService.simulateFallImpact();
  };

  return (
    <SafeCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="watch" size={24} color={Colors.secondary} />
          </View>
          <View>
            <Text style={styles.title}>{status.deviceName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: status.isConnected ? Colors.success : Colors.danger }]} />
              <Text style={styles.statusText}>{status.isConnected ? 'Connected • Paired' : 'Disconnected'}</Text>
            </View>
          </View>
        </View>
        <Pressable
          style={styles.pairBtn}
          onPress={() => router.push('/screens/watch-pairing' as any)}
        >
          <MaterialIcons name="settings-bluetooth" size={18} color={Colors.secondary} />
          <Text style={styles.pairBtnText}>Pairing Guide</Text>
        </Pressable>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <MaterialIcons name="favorite" size={20} color={Colors.primary} />
          <Text style={styles.metricVal}>{status.heartRate} <Text style={styles.metricUnit}>BPM</Text></Text>
          <Text style={styles.metricLabel}>Heart Rate</Text>
        </View>

        <View style={styles.metricBox}>
          <MaterialIcons name="battery-charging-full" size={20} color={Colors.success} />
          <Text style={styles.metricVal}>{status.batteryLevel}%</Text>
          <Text style={styles.metricLabel}>Watch Battery</Text>
        </View>

        <View style={styles.metricBox}>
          <MaterialIcons name="vibration" size={20} color={Colors.warning} />
          <Text style={styles.metricVal}>Active</Text>
          <Text style={styles.metricLabel}>Fall Sensor</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <Pressable style={styles.actionBtn} onPress={handleTestWatchTrigger}>
          <MaterialIcons name="touch-app" size={18} color={Colors.secondary} />
          <Text style={styles.actionText}>Test Watch SOS</Text>
        </Pressable>

        <Pressable style={[styles.actionBtn, styles.fallBtn]} onPress={handleSimulateFall}>
          <MaterialIcons name="personal-injury" size={18} color={Colors.warning} />
          <Text style={[styles.actionText, { color: Colors.warning }]}>Simulate Fall</Text>
        </Pressable>
      </View>
    </SafeCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.base, marginBottom: Spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.secondarySurface, alignItems: 'center', justifyContent: 'center',
  },
  title: { ...Typography.label, color: Colors.text, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...Typography.caption, color: Colors.textSecondary },
  pairBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.secondarySurface, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full,
  },
  pairBtnText: { ...Typography.caption, color: Colors.secondary, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  metricBox: {
    flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 2,
  },
  metricVal: { ...Typography.h4, color: Colors.text, fontWeight: '800' },
  metricUnit: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  metricLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10 },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.secondarySurface, paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  fallBtn: { backgroundColor: Colors.warningSurface },
  actionText: { ...Typography.caption, color: Colors.secondary, fontWeight: '700' },
});
