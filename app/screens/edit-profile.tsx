import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useAuth } from '@/hooks/useAuth';
import { UserProfile } from '@/contexts/AuthContext';
import { SafeInput } from '@/components/ui/SafeInput';
import { SafeButton } from '@/components/ui/SafeButton';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { GENDERS } from '@/services/mockData';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { showAlert } = useAlert();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    alternatePhone: '',
    dateOfBirth: '',
    gender: '',
    homeAddress: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        alternatePhone: user.alternatePhone || '',
        dateOfBirth: user.dateOfBirth || '',
        gender: user.gender || '',
        homeAddress: user.homeAddress || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        postalCode: user.postalCode || '',
      });
    }
  }, [user]);

  const update = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) {
      e.dateOfBirth = 'Use format YYYY-MM-DD';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    await updateProfile({
      ...form,
      profileComplete: true,
    } as Partial<UserProfile>);
    setIsSaving(false);
    showAlert('Profile Updated', 'Your profile information has been saved successfully.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  const initials = (form.fullName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable onPress={handleSave} style={styles.saveHeaderBtn} disabled={isSaving}>
          <Text style={[styles.saveHeaderText, isSaving && { opacity: 0.5 }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
      >
        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarLg, { backgroundColor: Colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.avatarEditBadge}>
            <MaterialIcons name="camera-alt" size={16} color="#fff" />
          </View>
          <Text style={styles.avatarNote}>Tap to change photo</Text>
        </View>

        {/* Email display (not editable) */}
        {user?.email ? (
          <View style={styles.emailBanner}>
            <MaterialIcons name="email" size={16} color={Colors.secondary} />
            <Text style={styles.emailText}>{user.email}</Text>
            {user.emailVerified ? (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={14} color={Colors.success} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Personal Information */}
        <SafeCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person" size={18} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <SafeInput
            label="Full Name *"
            value={form.fullName}
            onChangeText={v => update('fullName', v)}
            placeholder="Your full name"
            leftIcon="person"
            error={errors.fullName}
          />
          <SafeInput
            label="Date of Birth"
            value={form.dateOfBirth}
            onChangeText={v => update('dateOfBirth', v)}
            placeholder="YYYY-MM-DD"
            leftIcon="cake"
            error={errors.dateOfBirth}
          />
          <View style={styles.genderSection}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.genderGrid}>
              {GENDERS.map(g => (
                <Pressable
                  key={g}
                  style={[styles.genderOption, form.gender === g && styles.genderSelected]}
                  onPress={() => update('gender', g)}
                >
                  <Text style={[styles.genderText, form.gender === g && styles.genderTextSelected]}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </SafeCard>

        {/* Contact Information */}
        <SafeCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="phone" size={18} color={Colors.success} />
            <Text style={styles.sectionTitle}>Contact Details</Text>
          </View>
          <SafeInput
            label="Mobile Number *"
            value={form.phone}
            onChangeText={v => update('phone', v)}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
            leftIcon="phone"
            error={errors.phone}
          />
          <SafeInput
            label="Alternate Emergency Number"
            value={form.alternatePhone}
            onChangeText={v => update('alternatePhone', v)}
            placeholder="+91 99999 00000"
            keyboardType="phone-pad"
            leftIcon="phone-forwarded"
          />
        </SafeCard>

        {/* Address */}
        <SafeCard style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="home" size={18} color={Colors.warning} />
            <Text style={styles.sectionTitle}>Home Address</Text>
          </View>
          <SafeInput
            label="Street Address"
            value={form.homeAddress}
            onChangeText={v => update('homeAddress', v)}
            placeholder="123, Main Street"
            leftIcon="place"
          />
          <View style={styles.row2}>
            <SafeInput
              label="City"
              value={form.city}
              onChangeText={v => update('city', v)}
              placeholder="Mumbai"
              containerStyle={styles.half}
            />
            <SafeInput
              label="State"
              value={form.state}
              onChangeText={v => update('state', v)}
              placeholder="Maharashtra"
              containerStyle={styles.half}
            />
          </View>
          <View style={styles.row2}>
            <SafeInput
              label="Country"
              value={form.country}
              onChangeText={v => update('country', v)}
              placeholder="India"
              containerStyle={styles.half}
            />
            <SafeInput
              label="Postal Code"
              value={form.postalCode}
              onChangeText={v => update('postalCode', v)}
              placeholder="400001"
              keyboardType="number-pad"
              containerStyle={styles.half}
            />
          </View>
        </SafeCard>

        <SafeButton
          label="Save Profile"
          onPress={handleSave}
          loading={isSaving}
          fullWidth
          size="lg"
        />
        <SafeButton
          label="Cancel"
          onPress={() => router.back()}
          variant="ghost"
          fullWidth
          style={{ marginTop: Spacing.sm }}
        />
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
  saveHeaderBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  saveHeaderText: { ...Typography.buttonSmall, color: Colors.primary, fontWeight: '700' },
  content: { padding: Spacing.base, gap: Spacing.base },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl, position: 'relative' },
  avatarLg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  avatarEditBadge: {
    position: 'absolute', bottom: Spacing.xl + 2, right: '38%',
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.surface,
  },
  avatarNote: { ...Typography.caption, color: Colors.textTertiary, marginTop: Spacing.sm },
  emailBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.secondarySurface, borderRadius: Radius.lg, padding: Spacing.md,
  },
  emailText: { ...Typography.bodySmall, color: Colors.text, flex: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedText: { ...Typography.caption, color: Colors.success, fontWeight: '600' },
  section: {},
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.base },
  sectionTitle: { ...Typography.h4, color: Colors.text },
  fieldLabel: { ...Typography.label, color: Colors.text, marginBottom: Spacing.sm },
  genderSection: { marginTop: Spacing.sm },
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  genderOption: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
  },
  genderSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  genderText: { ...Typography.bodySmall, color: Colors.textSecondary },
  genderTextSelected: { color: Colors.primary, fontWeight: '600' },
  row2: { flexDirection: 'row', gap: Spacing.md },
  half: { flex: 1 },
});
