import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { useAuth } from '@/hooks/useAuth';
import * as ExpoLocation from 'expo-location';
import { useContacts } from '@/hooks/useContacts';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

interface MenuItemProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  color?: string;
  badge?: string;
  destructive?: boolean;
}

function MenuItem({ icon, label, subtitle, onPress, color, badge, destructive }: MenuItemProps) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: destructive ? Colors.dangerSurface : `${color || Colors.secondary}18` }]}>
        <MaterialIcons name={icon} size={22} color={destructive ? Colors.danger : (color || Colors.secondary)} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>{label}</Text>
        {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
      </View>
      <View style={styles.menuRight}>
        {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
        <MaterialIcons name="chevron-right" size={20} color={Colors.textTertiary} />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, calculateSafetyScore, updateProfile, sendEmailOTP, verifyEmailOTP } = useAuth();
  const { contacts } = useContacts();
  const { showAlert } = useAlert();
  const score = calculateSafetyScore();

  // Verification modal state
  const [verifyModal, setVerifyModal] = useState<'email' | 'phone' | null>(null);
  const [verifyStep, setVerifyStep] = useState<'input' | 'otp'>('input');
  const [verifyInput, setVerifyInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const openVerify = (type: 'email' | 'phone') => {
    setVerifyModal(type);
    setVerifyStep('input');
    setVerifyInput(type === 'email' ? (user?.email || '') : (user?.phone || ''));
    setOtpCode('');
    setVerifyError('');
  };

  const handleSendCode = async () => {
    if (!verifyInput.trim()) { setVerifyError('Please enter a value'); return; }
    setVerifyLoading(true);
    if (verifyModal === 'email') {
      // Real Supabase OTP
      const { error } = await sendEmailOTP(verifyInput.trim());
      setVerifyLoading(false);
      if (error) { setVerifyError(error); return; }
    } else {
      // Phone OTP — simulated (Twilio not configured)
      await new Promise(r => setTimeout(r, 1000));
      setVerifyLoading(false);
    }
    setVerifyStep('otp');
    setVerifyError('');
  };

  const handleVerifyCode = async () => {
    if (otpCode.length < 4) { setVerifyError('Enter the 4-digit verification code'); return; }
    setVerifyLoading(true);
    if (verifyModal === 'email') {
      // Real Supabase OTP verification
      const { error } = await verifyEmailOTP(verifyInput.trim(), otpCode);
      setVerifyLoading(false);
      if (error) {
        setVerifyError(error || 'Invalid or expired code. Please try again.');
        setOtpCode('');
        return;
      }
      await updateProfile({ emailVerified: true, email: verifyInput });
    } else {
      // Phone — store verified flag in DB
      await new Promise(r => setTimeout(r, 800));
      setVerifyLoading(false);
      await updateProfile({ phoneVerified: true, phone: verifyInput });
    }
    setVerifyModal(null);
    showAlert('Verified!', `Your ${verifyModal} has been verified successfully.`);
  };

  const handleVerifyLocation = async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Location access is required to verify your location.');
        return;
      }
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const [geo] = await ExpoLocation.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const cityStr = [geo?.city, geo?.region].filter(Boolean).join(', ');
      await updateProfile({
        locationVerified: true,
        city: geo?.city || user?.city || '',
        state: geo?.region || user?.state || '',
        locationLat: loc.coords.latitude,
        locationLng: loc.coords.longitude,
      });
      showAlert('Location Verified', `Verified at: ${cityStr || 'your current location'}`);
    } catch {
      showAlert('Error', 'Could not verify location. Please try again.');
    }
  };

  const handleLogout = () => {
    showAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/auth/login'); },
      },
    ]);
  };

  const initials = (user?.fullName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const scoreColor = score >= 80 ? Colors.success : score >= 50 ? Colors.warning : Colors.danger;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable onPress={() => router.push('/screens/settings')}>
          <MaterialIcons name="settings" size={24} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <SafeCard style={styles.profileCard}>
          <View style={[styles.avatarLg, { backgroundColor: Colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{user?.fullName || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          {user?.phone ? <Text style={styles.profilePhone}>{user.phone}</Text> : null}
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <Text style={[styles.statNum, { color: scoreColor }]}>{score}%</Text>
              <Text style={styles.statLabel}>Safety Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.profileStat}>
              <Text style={[styles.statNum, { color: Colors.secondary }]}>{contacts.length}</Text>
              <Text style={styles.statLabel}>Contacts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.profileStat}>
              <Text style={[styles.statNum, { color: user?.emailVerified ? Colors.success : Colors.warning }]}>
                {user?.emailVerified ? '✓' : '!'}
              </Text>
              <Text style={styles.statLabel}>Verified</Text>
            </View>
          </View>
        </SafeCard>

        {/* Verification Status */}
        <SafeCard style={styles.verifyCard}>
          <Text style={styles.sectionTitle}>Verification Status</Text>
          {[
            {
              label: 'Email Verified', done: user?.emailVerified, icon: 'email' as const,
              action: () => !user?.emailVerified && openVerify('email'),
            },
            {
              label: 'Phone Verified', done: user?.phoneVerified, icon: 'phone' as const,
              action: () => !user?.phoneVerified && openVerify('phone'),
            },
            {
              label: 'Location Verified', done: user?.locationVerified, icon: 'location-on' as const,
              action: () => !user?.locationVerified && handleVerifyLocation(),
            },
          ].map(v => (
            <Pressable key={v.label} style={styles.verifyRow} onPress={v.done ? undefined : v.action}>
              <MaterialIcons name={v.icon} size={18} color={v.done ? Colors.success : Colors.textTertiary} />
              <Text style={styles.verifyLabel}>{v.label}</Text>
              {v.done ? (
                <View style={[styles.verifyStatus, { backgroundColor: Colors.successSurface }]}>
                  <MaterialIcons name="verified" size={12} color={Colors.success} />
                  <Text style={[styles.verifyText, { color: Colors.success }]}>Verified</Text>
                </View>
              ) : (
                <View style={[styles.verifyStatus, { backgroundColor: Colors.primarySurface }]}>
                  <Text style={[styles.verifyText, { color: Colors.primary }]}>Verify →</Text>
                </View>
              )}
            </Pressable>
          ))}
        </SafeCard>

        {/* Safety & Emergency */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Safety & Emergency</Text>
          <SafeCard style={styles.menuCard} padding={0}>
            <MenuItem icon="medical-services" label="Medical Profile" subtitle="Blood group, allergies, medications" onPress={() => router.push('/screens/medical')} color={Colors.danger} />
            <View style={styles.menuDivider} />
            <MenuItem icon="people" label="Trusted Contacts" subtitle={`${contacts.length} of 5 contacts`} onPress={() => router.push('/(tabs)/contacts')} color={Colors.secondary} badge={contacts.length === 0 ? '!' : undefined} />
            <View style={styles.menuDivider} />
            <MenuItem icon="family-restroom" label="Family Safety Circle" onPress={() => router.push('/screens/family')} color={Colors.success} />
            <View style={styles.menuDivider} />
            <MenuItem icon="folder" label="Evidence Vault" subtitle="Secure recordings & files" onPress={() => router.push('/screens/evidence')} color="#8B5CF6" />
          </SafeCard>
        </View>

        {/* Account */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>
          <SafeCard style={styles.menuCard} padding={0}>
            <MenuItem icon="person" label="Edit Profile" subtitle="Update personal information" onPress={() => router.push('/screens/edit-profile')} color={Colors.secondary} />
            <View style={styles.menuDivider} />
            <MenuItem icon="lock" label="Change Password" onPress={() => router.push('/screens/change-password')} color={Colors.warning} />
            <View style={styles.menuDivider} />
            <MenuItem icon="notifications" label="Notifications" onPress={() => router.push('/screens/settings')} color={Colors.secondary} />
          </SafeCard>
        </View>

        {/* Support */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          <SafeCard style={styles.menuCard} padding={0}>
            <MenuItem icon="history" label="SOS History" subtitle="View past emergency alerts" onPress={() => router.push('/screens/sos-history')} color={Colors.warning} />
            <View style={styles.menuDivider} />
            <MenuItem icon="phone" label="Emergency Helplines" subtitle="Quick access numbers" onPress={() => router.push('/screens/helplines')} color={Colors.primary} />
          </SafeCard>
        </View>

        <SafeCard style={styles.menuCard} padding={0}>
          <MenuItem icon="logout" label="Sign Out" onPress={handleLogout} destructive />
        </SafeCard>

        <Text style={styles.versionText}>SafeGuard SOS v2.0.0</Text>
      </ScrollView>

      {/* Verification Modal */}
      <Modal visible={verifyModal !== null} transparent animationType="slide" onRequestClose={() => setVerifyModal(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setVerifyModal(null)} />
          <KeyboardAvoidingView style={styles.modalSheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: verifyStep === 'otp' ? Colors.successSurface : Colors.secondarySurface }]}>
                <MaterialIcons
                  name={verifyModal === 'email' ? 'email' : 'phone'}
                  size={26}
                  color={verifyStep === 'otp' ? Colors.success : Colors.secondary}
                />
              </View>
              <Text style={styles.modalTitle}>
                {verifyStep === 'input'
                  ? `Verify ${verifyModal === 'email' ? 'Email' : 'Phone'}`
                  : 'Enter Verification Code'}
              </Text>
              <Text style={styles.modalSub}>
                {verifyStep === 'input'
                  ? `Confirm your ${verifyModal} to receive the code`
                  : verifyModal === 'email'
                    ? `4-digit code sent to ${verifyInput}`
                    : `Code sent to ${verifyInput} (demo — use any 4 digits)`}
              </Text>
            </View>

            <View style={styles.modalBody}>
              {verifyStep === 'input' ? (
                <TextInput
                  style={styles.verifyInput}
                  value={verifyInput}
                  onChangeText={v => { setVerifyInput(v); setVerifyError(''); }}
                  placeholder={verifyModal === 'email' ? 'your@email.com' : '+91 98765 43210'}
                  keyboardType={verifyModal === 'email' ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                />
              ) : (
                <View>
                  {/* 4-digit OTP boxes */}
                  <View style={styles.otpRow}>
                    {[0, 1, 2, 3].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.otpBox,
                          otpCode.length > i && styles.otpBoxFilled,
                          otpCode.length === i && styles.otpBoxActive,
                        ]}
                      >
                        <Text style={styles.otpDigit}>{otpCode[i] || ''}</Text>
                      </View>
                    ))}
                  </View>
                  <TextInput
                    style={styles.hiddenInput}
                    value={otpCode}
                    onChangeText={v => { setOtpCode(v.replace(/[^0-9]/g, '').slice(0, 4)); setVerifyError(''); }}
                    keyboardType="number-pad"
                    maxLength={4}
                    autoFocus
                  />
                </View>
              )}

              {verifyError ? <Text style={styles.verifyErr}>{verifyError}</Text> : null}

              <Pressable
                style={[styles.verifyBtn, verifyLoading && { opacity: 0.6 }]}
                onPress={verifyStep === 'input' ? handleSendCode : handleVerifyCode}
                disabled={verifyLoading}
              >
                <Text style={styles.verifyBtnText}>
                  {verifyLoading
                    ? 'Please wait...'
                    : verifyStep === 'input'
                      ? 'Send Code'
                      : 'Verify & Confirm'}
                </Text>
              </Pressable>

              {verifyStep === 'otp' ? (
                <Pressable style={styles.resendBtn} onPress={() => { setVerifyStep('input'); setOtpCode(''); setVerifyError(''); }}>
                  <Text style={styles.resendText}>Resend or change {verifyModal}</Text>
                </Pressable>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.base,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h3, color: Colors.text },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: 48 },

  profileCard: { alignItems: 'center', gap: Spacing.sm },
  avatarLg: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm, ...Shadows.md },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  profileName: { ...Typography.h2, color: Colors.text },
  profileEmail: { ...Typography.bodySmall, color: Colors.textSecondary },
  profilePhone: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  profileStats: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.xl },
  profileStat: { alignItems: 'center' },
  statNum: { ...Typography.h3, fontWeight: '800' },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  verifyCard: {},
  sectionTitle: { ...Typography.h4, color: Colors.text, marginBottom: Spacing.md },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm, minHeight: 44 },
  verifyLabel: { ...Typography.bodySmall, color: Colors.text, flex: 1 },
  verifyStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  verifyText: { ...Typography.caption, fontWeight: '600' },

  // Verification modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: Spacing.md },
  modalHeader: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  modalTitle: { ...Typography.h3, color: Colors.text, textAlign: 'center' },
  modalSub: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalBody: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.md },
  verifyInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.base, height: 52,
    ...Typography.body, color: Colors.text,
  },

  // 4-digit OTP
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.sm },
  otpBox: {
    width: 64, height: 72, borderRadius: Radius.md, borderWidth: 2,
    borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: Colors.secondary, backgroundColor: Colors.secondarySurface },
  otpBoxActive: { borderColor: Colors.primary, borderWidth: 2.5 },
  otpDigit: { fontSize: 28, fontWeight: '800', color: Colors.text },
  hiddenInput: { position: 'absolute', width: '100%', height: 72, opacity: 0 },

  verifyErr: { ...Typography.caption, color: Colors.danger, textAlign: 'center' },
  verifyBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  verifyBtnText: { ...Typography.button, color: '#fff', fontWeight: '700' },
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { ...Typography.bodySmall, color: Colors.secondary, fontWeight: '600' },

  menuSection: { gap: Spacing.sm },
  menuSectionTitle: { ...Typography.label, color: Colors.textSecondary, paddingHorizontal: Spacing.sm },
  menuCard: {},
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, minHeight: 64 },
  menuItemPressed: { backgroundColor: Colors.surfaceAlt },
  menuIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  menuContent: { flex: 1 },
  menuLabel: { ...Typography.body, color: Colors.text, fontWeight: '500' },
  menuLabelDestructive: { color: Colors.danger },
  menuSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  menuDivider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 72 },
  badge: { backgroundColor: Colors.dangerSurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { ...Typography.caption, color: Colors.danger, fontWeight: '700' },
  versionText: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.base },
});
