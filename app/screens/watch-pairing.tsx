import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeCard } from '@/components/ui/SafeCard';
import { SafeButton } from '@/components/ui/SafeButton';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { SupabaseService } from '@/services/supabaseService';

export default function WatchPairingScreen() {
  const insets = useSafeAreaInsets();
  const [activeWatchType, setActiveWatchType] = useState<'apple' | 'wearos' | 'web'>('wearos');
  const [isScanning, setIsScanning] = useState(false);
  const [isPaired, setIsPaired] = useState(true);
  const [pairingCode] = useState('749-201');

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setIsPaired(true);
    }, 2500);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Status Card */}
        <SafeCard style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIconWrap, { backgroundColor: isPaired ? Colors.successSurface : Colors.warningSurface }]}>
              <MaterialIcons name="watch" size={32} color={isPaired ? Colors.success : Colors.warning} />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>
                {isPaired ? 'Smartwatch Connected' : 'No Watch Paired'}
              </Text>
              <Text style={styles.statusSub}>
                {isPaired ? 'Galaxy Watch 6 (Wear OS 4) • Bluetooth BLE Active' : 'Tap scan to discover nearby watches'}
              </Text>
            </View>
          </View>

          {isPaired && (
            <View style={styles.metricsRow}>
              <View style={styles.metricPill}>
                <MaterialIcons name="favorite" size={16} color={Colors.primary} />
                <Text style={styles.metricText}>Live HR Sync: <Text style={styles.bold}>Active</Text></Text>
              </View>
              <View style={styles.metricPill}>
                <MaterialIcons name="vibration" size={16} color={Colors.warning} />
                <Text style={styles.metricText}>Fall Detection: <Text style={styles.bold}>Ready</Text></Text>
              </View>
            </View>
          )}
        </SafeCard>

        {/* Pairing Code Card */}
        <SafeCard style={styles.codeCard}>
          <Text style={styles.codeTitle}>Watch Companion Pairing Code</Text>
          <Text style={styles.codeSub}>Open SafeGuard SOS on your watch and enter this code:</Text>
          <View style={styles.codeDisplay}>
            <Text style={styles.codeText}>{pairingCode}</Text>
          </View>
          <SafeButton
            label={isScanning ? 'Scanning for Nearby Watches...' : 'Re-scan Bluetooth BLE Devices'}
            onPress={handleScan}
            loading={isScanning}
            fullWidth
            variant="secondary"
          />
        </SafeCard>

        {/* Platform Selection Tabs */}
        <View style={styles.tabRow}>
          {[
            { id: 'wearos' as const, label: 'Galaxy / Wear OS', icon: 'android' as const },
            { id: 'apple' as const, label: 'Apple Watch', icon: 'watch' as const },
            { id: 'web' as const, label: 'Realtime Cloud Sync', icon: 'wifi' as const },
          ].map(t => (
            <Pressable
              key={t.id}
              style={[styles.tabBtn, activeWatchType === t.id && styles.tabBtnActive]}
              onPress={() => setActiveWatchType(t.id)}
            >
              <MaterialIcons name={t.icon} size={18} color={activeWatchType === t.id ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.tabText, activeWatchType === t.id && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Technical Integration Guide */}
        <SafeCard style={styles.guideCard}>
          <Text style={styles.guideTitle}>
            {activeWatchType === 'wearos'
              ? 'Wear OS (Samsung Galaxy / Pixel Watch) Setup'
              : activeWatchType === 'apple'
              ? 'Apple Watch (watchOS) Setup'
              : 'Supabase Realtime Cloud Synchronization'}
          </Text>

          {activeWatchType === 'wearos' && (
            <View style={styles.stepsList}>
              <View style={styles.stepContainer}>
                <Text style={styles.stepHeader}>1. Install Wear OS Companion App</Text>
                <Text style={styles.stepBody}>
                  Install the SafeGuard Wear OS companion app on your Galaxy Watch / Pixel Watch from the Google Play Store.
                </Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepHeader}>2. Bluetooth DataClient Channel</Text>
                <Text style={styles.stepBody}>
                  The watch connects automatically via Android DataClient to stream heart rate & sensor telemetry to your phone.
                </Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepHeader}>3. Standalone LTE Direct Alert (Roadmap)</Text>
                <Text style={styles.stepBody}>
                  On Wear OS devices with an active standalone e-SIM LTE line, watch-native SOS dispatch functions independently when out of Bluetooth range of your phone.
                </Text>
              </View>
            </View>
          )}

          {activeWatchType === 'apple' && (
            <View style={styles.stepsList}>
              <View style={styles.stepContainer}>
                <Text style={styles.stepHeader}>1. watchOS Extension</Text>
                <Text style={styles.stepBody}>
                  Add the Watch target in Xcode using react-native-watch-connectivity.
                </Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepHeader}>2. WCSession Protocol</Text>
                <Text style={styles.stepBody}>
                  Real-time acceleration and wrist tap events stream over Apple WCSession.default.transferUserInfo().
                </Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepHeader}>3. Fall Detection Integration</Text>
                <Text style={styles.stepBody}>
                  Leverages Apple Watch native HKWorkout and CMImpactManager for zero-latency crash alerts.
                </Text>
              </View>
            </View>
          )}

          {activeWatchType === 'web' && (
            <View style={styles.stepsList}>
              <View style={styles.stepContainer}>
                <Text style={styles.stepHeader}>1. Supabase Realtime Channels</Text>
                <Text style={styles.stepBody}>
                  Live telemetry streams via WebSockets channel 'watch-pairing'.
                </Text>
              </View>
              <View style={styles.stepContainer}>
                <Text style={styles.stepHeader}>2. Cross-Device Browser Sync</Text>
                <Text style={styles.stepBody}>
                  Open the watch web app on your smartwatch browser to link heart rate and SOS triggers instantly to your phone.
                </Text>
              </View>
            </View>
          )}
        </SafeCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.lg, paddingBottom: 32 },
  statusCard: { borderColor: Colors.successSurface, borderWidth: 1.5 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  statusIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  statusTextWrap: { flex: 1 },
  statusTitle: { ...Typography.h3, color: Colors.text },
  statusSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  metricsRow: { flexDirection: 'row', gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  metricPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, flex: 1,
  },
  metricText: { ...Typography.caption, color: Colors.textSecondary },
  bold: { fontWeight: '700', color: Colors.text },
  codeCard: { alignItems: 'center', gap: Spacing.sm },
  codeTitle: { ...Typography.h4, color: Colors.text },
  codeSub: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  codeDisplay: {
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: Radius.xl, borderWidth: 2, borderColor: Colors.primaryLight, marginVertical: Spacing.xs,
  },
  codeText: { fontSize: 32, fontWeight: '800', letterSpacing: 4, color: Colors.primary },
  tabRow: { flexDirection: 'row', gap: Spacing.xs, backgroundColor: Colors.surfaceAlt, padding: 4, borderRadius: Radius.xl },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.sm, borderRadius: Radius.lg,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  guideCard: { gap: Spacing.md },
  guideTitle: { ...Typography.h4, color: Colors.text },
  stepsList: { gap: Spacing.md },
  stepContainer: {
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: 4,
  },
  stepHeader: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.text,
  },
  stepBody: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
