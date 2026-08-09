import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Switch, Pressable, StyleSheet, Modal, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@safeguard_settings';

interface AppSettings {
  push: boolean;
  sms: boolean;
  location: boolean;
  audio: boolean;
  biometrics: boolean;
  vibrate: boolean;
  holdDuration: number;
  alertSound: string;
  autoCallEmergency: boolean;
  fallDetection: boolean;
  fallSensitivity: 'low' | 'medium' | 'high';
}

const DEFAULT_SETTINGS: AppSettings = {
  push: true, sms: true, location: true, audio: false,
  biometrics: false, vibrate: true, holdDuration: 3,
  alertSound: 'Default Alarm', autoCallEmergency: false,
  fallDetection: true, fallSensitivity: 'medium',
};

const HOLD_DURATIONS = [2, 3, 5, 10];
const ALERT_SOUNDS = ['Default Alarm', 'Siren', 'Loud Buzz', 'Silent'];

const NOTIFICATION_TOGGLES = [
  { key: 'push', label: 'Push Notifications', desc: 'Receive emergency and safety alerts', icon: 'notifications' as const, color: Colors.secondary },
  { key: 'sms', label: 'SMS Alerts', desc: 'Send SMS during SOS emergency', icon: 'sms' as const, color: Colors.success },
];

const PRIVACY_TOGGLES = [
  { key: 'location', label: 'Background Location', desc: 'Track location in background', icon: 'my-location' as const, color: Colors.primary },
  { key: 'audio', label: 'Auto Audio Record', desc: 'Start recording on SOS trigger', icon: 'mic' as const, color: '#8B5CF6' },
  { key: 'biometrics', label: 'Biometric Login', desc: 'Use Face ID / Touch ID', icon: 'fingerprint' as const, color: Colors.warning },
  { key: 'vibrate', label: 'Vibration Alerts', desc: 'Vibrate device during SOS', icon: 'vibration' as const, color: Colors.danger },
];

const PRIVACY_POLICY = `PRIVACY POLICY - SafeGuard SOS
Last updated: January 2025

1. INFORMATION WE COLLECT
We collect information you provide directly: name, email, phone, medical info, and location data you choose to share.

2. HOW WE USE YOUR DATA
Your data is used to power SOS alerts, share your location with trusted contacts, and provide emergency services. All data is stored locally on your device.

3. DATA SHARING
We never sell your data. Location and medical info are only shared with contacts YOU designate during an SOS event.

4. SECURITY
All evidence files are encrypted locally using AES-256 encryption. Passwords are never stored in plain text.

5. YOUR RIGHTS
You can delete your account and all data at any time from Settings. Contact us at support@safeguard-sos.com for data requests.

6. CONTACT
For privacy concerns: support@safeguard-sos.com`;

const TERMS_OF_SERVICE = `TERMS OF SERVICE - SafeGuard SOS
Last updated: January 2025

1. ACCEPTANCE
By using SafeGuard SOS, you agree to these terms. If you do not agree, please uninstall the app.

2. USE OF SERVICE
SafeGuard SOS is a personal safety tool. You agree to use it only for lawful purposes and not to trigger false emergency alerts.

3. EMERGENCY SERVICES
This app does not replace official emergency services. Always contact 112 or your local emergency number for life-threatening emergencies.

4. MEDICAL INFORMATION
Medical info you store is used solely for emergency alerts. We are not responsible for any medical advice.

5. LIMITATION OF LIABILITY
SafeGuard SOS is provided "as is." We are not liable for any damages arising from use or inability to use the service.

6. CHANGES
We may update these terms at any time. Continued use of the app constitutes acceptance.

7. CONTACT
For support: support@safeguard-sos.com`;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [durationModal, setDurationModal] = useState(false);
  const [soundModal, setSoundModal] = useState(false);
  const [textModal, setTextModal] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch {}
    setIsLoaded(true);
  };

  const save = useCallback(async (updated: AppSettings) => {
    setSettings(updated);
    try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated)); } catch {}
  }, []);

  const toggle = useCallback((key: keyof AppSettings) => {
    save({ ...settings, [key]: !settings[key] });
  }, [settings, save]);

  if (!isLoaded) return <View style={styles.container} />;

  return (
    <>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Notifications */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notifications & Alerts</Text>
            <SafeCard style={styles.card} padding={0}>
              {NOTIFICATION_TOGGLES.map((s, i) => (
                <View key={s.key}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.row}>
                    <View style={[styles.icon, { backgroundColor: `${s.color}18` }]}>
                      <MaterialIcons name={s.icon} size={20} color={s.color} />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.rowLabel}>{s.label}</Text>
                      <Text style={styles.rowDesc}>{s.desc}</Text>
                    </View>
                    <Switch
                      value={settings[s.key as keyof AppSettings] as boolean}
                      onValueChange={() => toggle(s.key as keyof AppSettings)}
                      trackColor={{ false: Colors.border, true: Colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              ))}
            </SafeCard>
          </View>

          {/* Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Privacy & Security</Text>
            <SafeCard style={styles.card} padding={0}>
              {PRIVACY_TOGGLES.map((s, i) => (
                <View key={s.key}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.row}>
                    <View style={[styles.icon, { backgroundColor: `${s.color}18` }]}>
                      <MaterialIcons name={s.icon} size={20} color={s.color} />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.rowLabel}>{s.label}</Text>
                      <Text style={styles.rowDesc}>{s.desc}</Text>
                    </View>
                    <Switch
                      value={settings[s.key as keyof AppSettings] as boolean}
                      onValueChange={() => toggle(s.key as keyof AppSettings)}
                      trackColor={{ false: Colors.border, true: Colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              ))}
            </SafeCard>
          </View>

          {/* Fall Detection & Smartwatch */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Fall Detection & Smartwatch</Text>
            <SafeCard style={styles.card} padding={0}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: `${Colors.warning}18` }]}>
                  <MaterialIcons name="personal-injury" size={20} color={Colors.warning} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.rowLabel}>Fall & Impact Detection</Text>
                  <Text style={styles.rowDesc}>Detect high-G motion falls and impacts</Text>
                </View>
                <Switch
                  value={settings.fallDetection}
                  onValueChange={() => toggle('fallDetection')}
                  trackColor={{ false: Colors.border, true: Colors.warning }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: `${Colors.secondary}18` }]}>
                  <MaterialIcons name="watch" size={20} color={Colors.secondary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.rowLabel}>Smartwatch Companion</Text>
                  <Text style={styles.rowDesc}>Galaxy Watch & Apple Watch Sync</Text>
                </View>
                <View style={styles.valueRow}>
                  <Text style={[styles.valueText, { color: Colors.success, fontWeight: '700' }]}>Paired</Text>
                </View>
              </View>
            </SafeCard>
          </View>

          {/* SOS Config */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SOS Configuration</Text>
            <SafeCard style={styles.card} padding={0}>
              <Pressable style={styles.row} onPress={() => setDurationModal(true)}>
                <View style={[styles.icon, { backgroundColor: `${Colors.warning}18` }]}>
                  <MaterialIcons name="timer" size={20} color={Colors.warning} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.rowLabel}>Hold Duration</Text>
                  <Text style={styles.rowDesc}>How long to hold the SOS button</Text>
                </View>
                <View style={styles.valueRow}>
                  <Text style={styles.valueText}>{settings.holdDuration}s</Text>
                  <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
                </View>
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.row} onPress={() => setSoundModal(true)}>
                <View style={[styles.icon, { backgroundColor: `${Colors.secondary}18` }]}>
                  <MaterialIcons name="volume-up" size={20} color={Colors.secondary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.rowLabel}>Alert Sound</Text>
                  <Text style={styles.rowDesc}>Sound played during SOS</Text>
                </View>
                <View style={styles.valueRow}>
                  <Text style={styles.valueText}>{settings.alertSound}</Text>
                  <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
                </View>
              </Pressable>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: `${Colors.primary}18` }]}>
                  <MaterialIcons name="phone" size={20} color={Colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.rowLabel}>Auto Call Emergency (112)</Text>
                  <Text style={styles.rowDesc}>Auto-dial 112 when SOS triggers</Text>
                </View>
                <Switch
                  value={settings.autoCallEmergency}
                  onValueChange={() => toggle('autoCallEmergency')}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </SafeCard>
            <View style={styles.note}>
              <MaterialIcons name="info-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.noteText}>Changes take effect immediately.</Text>
            </View>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About</Text>
            <SafeCard style={styles.card} padding={0}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: `${Colors.secondary}18` }]}>
                  <MaterialIcons name="info" size={20} color={Colors.secondary} />
                </View>
                <View style={styles.info}><Text style={styles.rowLabel}>App Version</Text></View>
                <Text style={styles.valueText}>v1.0.0</Text>
              </View>
              <View style={styles.divider} />
              <Pressable style={styles.row} onPress={() => setTextModal({ title: 'Privacy Policy', body: PRIVACY_POLICY })}>
                <View style={[styles.icon, { backgroundColor: `${Colors.textSecondary}18` }]}>
                  <MaterialIcons name="privacy-tip" size={20} color={Colors.textSecondary} />
                </View>
                <View style={styles.info}><Text style={styles.rowLabel}>Privacy Policy</Text></View>
                <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.row} onPress={() => setTextModal({ title: 'Terms of Service', body: TERMS_OF_SERVICE })}>
                <View style={[styles.icon, { backgroundColor: `${Colors.textSecondary}18` }]}>
                  <MaterialIcons name="description" size={20} color={Colors.textSecondary} />
                </View>
                <View style={styles.info}><Text style={styles.rowLabel}>Terms of Service</Text></View>
                <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
              </Pressable>
            </SafeCard>
          </View>

          <Text style={styles.footer}>SafeGuard SOS — Your personal safety companion</Text>
        </ScrollView>
      </View>

      {/* Hold Duration Modal */}
      <Modal visible={durationModal} transparent animationType="slide" onRequestClose={() => setDurationModal(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDurationModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>SOS Hold Duration</Text>
            <Text style={styles.sheetSub}>How long must the button be held to trigger SOS?</Text>
            {HOLD_DURATIONS.map(d => (
              <Pressable
                key={d}
                style={[styles.option, settings.holdDuration === d && styles.optionActive]}
                onPress={() => { save({ ...settings, holdDuration: d }); setDurationModal(false); }}
              >
                <Text style={[styles.optionText, settings.holdDuration === d && styles.optionTextActive]}>
                  {d} seconds
                </Text>
                {settings.holdDuration === d ? <MaterialIcons name="check-circle" size={20} color={Colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Alert Sound Modal */}
      <Modal visible={soundModal} transparent animationType="slide" onRequestClose={() => setSoundModal(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSoundModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Alert Sound</Text>
            <Text style={styles.sheetSub}>Sound played when SOS is activated</Text>
            {ALERT_SOUNDS.map(s => (
              <Pressable
                key={s}
                style={[styles.option, settings.alertSound === s && styles.optionActive]}
                onPress={() => { save({ ...settings, alertSound: s }); setSoundModal(false); }}
              >
                <View style={styles.optionLeft}>
                  <MaterialIcons
                    name={s === 'Silent' ? 'volume-off' : 'volume-up'}
                    size={18}
                    color={settings.alertSound === s ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.optionText, settings.alertSound === s && styles.optionTextActive]}>{s}</Text>
                </View>
                {settings.alertSound === s ? <MaterialIcons name="check-circle" size={20} color={Colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Privacy / Terms Modal */}
      <Modal visible={textModal !== null} transparent animationType="slide" onRequestClose={() => setTextModal(null)}>
        <View style={styles.textBackdrop}>
          <View style={[styles.textSheet, { paddingBottom: insets.bottom + Spacing.base }]}>
            <View style={styles.textHeader}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>{textModal?.title}</Text>
              <Pressable onPress={() => setTextModal(null)} style={styles.closeBtn} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.textContent}>
              <Text style={styles.textBody}>{textModal?.body}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 32 },
  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    ...Typography.label, color: Colors.textSecondary,
    paddingHorizontal: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  card: {},
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, minHeight: 64 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 68 },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md, flexShrink: 0 },
  info: { flex: 1 },
  rowLabel: { ...Typography.body, color: Colors.text, fontWeight: '500' },
  rowDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { ...Typography.caption, color: Colors.secondary, fontWeight: '600' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, marginTop: 6 },
  noteText: { ...Typography.caption, color: Colors.textTertiary },
  footer: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },

  // Picker sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl, paddingBottom: 40, paddingTop: Spacing.sm,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.xl },
  sheetTitle: { ...Typography.h3, color: Colors.text, marginBottom: 6 },
  sheetSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.xl },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.base, paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg, marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border,
  },
  optionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  optionText: { ...Typography.body, color: Colors.textSecondary },
  optionTextActive: { color: Colors.primary, fontWeight: '700' },

  // Text modal
  textBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  textSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  textHeader: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: Spacing.md,
  },
  textContent: { padding: Spacing.xl, paddingBottom: 32 },
  textBody: {
    ...Typography.bodySmall, color: Colors.text, lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  closeBtn: { position: 'absolute', right: Spacing.xl, top: Spacing.sm },
});
