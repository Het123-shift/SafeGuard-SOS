import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useAuth } from '@/hooks/useAuth';
import { SafeInput } from '@/components/ui/SafeInput';
import { SafeButton } from '@/components/ui/SafeButton';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

const REQUIREMENTS = [
  { label: '6+ characters', test: (p: string) => p.length >= 6 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number (0–9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
const STRENGTH_COLORS = ['', Colors.danger, Colors.warning, Colors.warning, Colors.secondary, Colors.success];

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { changePassword } = useAuth();
  const { showAlert } = useAlert();
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({ newPwd: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const metCount = REQUIREMENTS.filter(r => r.test(form.newPwd)).length;
  const strength = form.newPwd ? metCount : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.newPwd) {
      e.newPwd = 'New password is required';
    } else if (form.newPwd.length < 6) {
      e.newPwd = 'Minimum 6 characters required';
    }
    if (!form.confirm) {
      e.confirm = 'Please confirm your new password';
    } else if (form.newPwd !== form.confirm) {
      e.confirm = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    const { error } = await changePassword(form.newPwd);
    setIsSaving(false);
    if (error) {
      showAlert('Update Failed', error);
      return;
    }
    showAlert('Password Updated', 'Your password has been changed successfully.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}>

        {/* Info card */}
        <SafeCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <MaterialIcons name="lock" size={24} color={Colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Set a new password</Text>
              <Text style={styles.infoDesc}>
                Your new password will be saved to your account and used for future sign-ins.
              </Text>
            </View>
          </View>
        </SafeCard>

        {/* New password */}
        <SafeCard style={styles.section}>
          <Text style={styles.sectionTitle}>New Password</Text>
          <SafeInput
            label="New Password"
            value={form.newPwd}
            onChangeText={v => update('newPwd', v)}
            placeholder="Create a strong password"
            isPassword
            leftIcon="lock"
            error={errors.newPwd}
          />

          {/* Strength meter */}
          {form.newPwd.length > 0 ? (
            <View style={styles.strengthArea}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View key={i} style={[styles.strengthBar, { backgroundColor: i <= strength ? STRENGTH_COLORS[strength] : Colors.border }]} />
                ))}
              </View>
              <View style={styles.strengthLabelRow}>
                <Text style={styles.strengthHint}>Strength:</Text>
                <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>{STRENGTH_LABELS[strength]}</Text>
              </View>
            </View>
          ) : null}

          <SafeInput
            label="Confirm New Password"
            value={form.confirm}
            onChangeText={v => update('confirm', v)}
            placeholder="Re-enter new password"
            isPassword
            leftIcon="lock-outline"
            error={errors.confirm}
          />

          {/* Requirements */}
          <View style={styles.requirements}>
            <Text style={styles.reqTitle}>Password requirements:</Text>
            <View style={styles.reqGrid}>
              {REQUIREMENTS.map(r => {
                const met = r.test(form.newPwd);
                return (
                  <View key={r.label} style={styles.reqItem}>
                    <MaterialIcons name={met ? 'check-circle' : 'radio-button-unchecked'} size={14}
                      color={met ? Colors.success : Colors.textTertiary} />
                    <Text style={[styles.reqText, met && styles.reqTextMet]}>{r.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </SafeCard>

        {/* Security tips */}
        <SafeCard style={[styles.tipsCard, { backgroundColor: Colors.warningSurface, borderColor: 'rgba(249,115,22,0.2)', borderWidth: 1 }]}>
          <View style={styles.tipHeader}>
            <MaterialIcons name="lightbulb" size={18} color={Colors.warning} />
            <Text style={styles.tipTitle}>Security Tips</Text>
          </View>
          {[
            'Never share your password with anyone',
            'Use a unique password not used on other apps',
            'Consider using a password manager',
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </SafeCard>

        <SafeButton label="Update Password" onPress={handleSave} loading={isSaving} fullWidth size="lg" />
        <SafeButton label="Cancel" onPress={() => router.back()} variant="ghost" fullWidth style={{ marginTop: Spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h3, color: Colors.text },
  content: { padding: Spacing.base, gap: Spacing.base },
  infoCard: {},
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  infoIconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.secondarySurface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoTitle: { ...Typography.h4, color: Colors.text, marginBottom: 4 },
  infoDesc: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  section: {},
  sectionTitle: { ...Typography.h4, color: Colors.text, marginBottom: Spacing.base },
  strengthArea: { marginBottom: Spacing.md, marginTop: -8 },
  strengthBars: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  strengthBar: { flex: 1, height: 5, borderRadius: 3 },
  strengthLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strengthHint: { ...Typography.caption, color: Colors.textSecondary },
  strengthLabel: { ...Typography.caption, fontWeight: '700' },
  requirements: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  reqTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },
  reqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  reqItem: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 140 },
  reqText: { ...Typography.caption, color: Colors.textTertiary },
  reqTextMet: { color: Colors.success },
  tipsCard: {},
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  tipTitle: { ...Typography.label, color: Colors.warning, fontWeight: '700' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  tipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.warning, marginTop: 7 },
  tipText: { ...Typography.bodySmall, color: Colors.text, flex: 1, lineHeight: 20 },
});
