import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeCard } from '@/components/ui/SafeCard';
import { SafeButton } from '@/components/ui/SafeButton';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { watchService, WatchStatus } from '@/services/watchService';

type PairingState = 'idle' | 'scanning' | 'discovered' | 'connecting' | 'paired' | 'failed';

interface DiscoveredDevice {
  id: string;
  name: string;
  type: 'wearos' | 'apple' | 'ble';
  rssi: number;
}

const SAMPLE_DEVICES: DiscoveredDevice[] = [
  { id: '1', name: 'Galaxy Watch 6 (BT)', type: 'wearos', rssi: -58 },
  { id: '2', name: 'Pixel Watch 2', type: 'wearos', rssi: -72 },
  { id: '3', name: 'Wear OS Device', type: 'wearos', rssi: -84 },
];

export default function WatchPairingScreen() {
  const insets = useSafeAreaInsets();
  const [activeWatchType, setActiveWatchType] = useState<'apple' | 'wearos' | 'web'>('wearos');
  const [pairingState, setPairingState] = useState<PairingState>('idle');
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [status, setStatus] = useState<WatchStatus>(watchService.getStatus());
  const [pairingCode] = useState('749-201');

  useEffect(() => {
    setStatus(watchService.getStatus());
    const unsub = watchService.addStatusListener((s) => setStatus(s));
    return unsub;
  }, []);

  const handleStartScan = () => {
    setPairingState('scanning');
    setDiscoveredDevices([]);

    setTimeout(() => {
      setDiscoveredDevices(SAMPLE_DEVICES);
      setPairingState('discovered');
    }, 2000);
  };

  const handleConnectDevice = async (device: DiscoveredDevice) => {
    setPairingState('connecting');
    setTimeout(async () => {
      await watchService.pairDevice(device.name);
      setPairingState('paired');
    }, 1500);
  };

  const handleUnpair = async () => {
    await watchService.unpairDevice();
    setPairingState('idle');
    setDiscoveredDevices([]);
  };

  const isPaired = status.isPaired;

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
                {isPaired ? `${status.deviceName} • Bluetooth BLE Active` : 'Scan to discover nearby watches'}
              </Text>
            </View>
          </View>

          {isPaired && (
            <View style={styles.metricsRow}>
              <View style={styles.metricPill}>
                <MaterialIcons name="favorite" size={16} color={Colors.primary} />
                <Text style={styles.metricText}>Live HR Sync: <Text style={styles.bold}>Active ({status.heartRate} BPM)</Text></Text>
              </View>
              <View style={styles.metricPill}>
                <MaterialIcons name="vibration" size={16} color={Colors.warning} />
                <Text style={styles.metricText}>Fall Detection: <Text style={styles.bold}>Ready</Text></Text>
              </View>
            </View>
          )}

          {isPaired && (
            <Pressable style={styles.unpairBtn} onPress={handleUnpair}>
              <Text style={styles.unpairBtnText}>Disconnect & Unpair Device</Text>
            </Pressable>
          )}
        </SafeCard>

        {/* Pairing Code & Discovery Card */}
        <SafeCard style={styles.codeCard}>
          <Text style={styles.codeTitle}>Watch Companion Pairing</Text>
          <Text style={styles.codeSub}>Open SafeGuard SOS on your watch or discover nearby BLE devices:</Text>
          
          <View style={styles.codeDisplay}>
            <Text style={styles.codeText}>{pairingCode}</Text>
          </View>

          {pairingState === 'connecting' ? (
            <View style={styles.connectingBox}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.connectingText}>Securing Bluetooth BLE connection...</Text>
            </View>
          ) : (
            <SafeButton
              label={pairingState === 'scanning' ? 'Scanning for Nearby Watches...' : 'Scan Bluetooth BLE Devices'}
              onPress={handleStartScan}
              loading={pairingState === 'scanning'}
              fullWidth
              variant="secondary"
            />
          )}

          {/* Discovered Devices List */}
          {pairingState === 'discovered' && discoveredDevices.length > 0 && (
            <View style={styles.devicesList}>
              <Text style={styles.devicesHeader}>Nearby Devices Discovered ({discoveredDevices.length})</Text>
              {discoveredDevices.map((d) => (
                <Pressable
                  key={d.id}
                  style={styles.deviceRow}
                  onPress={() => handleConnectDevice(d)}
                >
                  <MaterialIcons name="watch" size={22} color={Colors.primary} />
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{d.name}</Text>
                    <Text style={styles.deviceSignal}>Signal: {d.rssi} dBm (Good)</Text>
                  </View>
                  <View style={styles.connectBadge}>
                    <Text style={styles.connectBadgeText}>Connect</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
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
  unpairBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.dangerSurface,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  unpairBtnText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.danger,
  },
  connectingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  connectingText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  devicesList: {
    width: '100%',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  devicesHeader: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.text,
  },
  deviceSignal: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  connectBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  connectBadgeText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#fff',
  },
});
