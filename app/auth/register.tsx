import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import { useAuth } from '@/hooks/useAuth';
import { SafeButton } from '@/components/ui/SafeButton';
import { SafeInput } from '@/components/ui/SafeInput';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { GENDERS } from '@/services/mockData';

type Step = 'personal' | 'contact' | 'security';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { showAlert } = useAlert();
  const [step, setStep] = useState<Step>('personal');
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', dateOfBirth: '',
    gender: '', homeAddress: '', city: '', state: '', country: '',
    postalCode: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const validatePersonal = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
    if (!form.gender) e.gender = 'Please select a gender';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateContact = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateSecurity = () => {
    const e: Record<string, string> = {};
    const pwd = form.password;
    if (!pwd) {
      e.password = 'Password is required';
    } else if (pwd.length < 6) {
      e.password = 'Minimum 6 characters required';
    }
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 'personal' && validatePersonal()) setStep('contact');
    else if (step === 'contact' && validateContact()) setStep('security');
  };

  const handleSubmit = useCallback(async () => {
    if (!validateSecurity()) return;
    setIsLoading(true);

    const result = await register({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      homeAddress: form.homeAddress,
      city: form.city,
      state: form.state,
      country: form.country,
      postalCode: form.postalCode,
      password: form.password,
    });

    setIsLoading(false);

    if (result.error) {
      showAlert('Registration Failed', result.error);
      return;
    }

    if (result.needsConfirmation) {
      showAlert(
        'Verify Your Email',
        `A verification link/code has been sent to ${form.email}. Please check your inbox and verify your email before signing in.`,
        [{ text: 'Go to Login', onPress: () => router.replace('/auth/login') }]
      );
    } else {
      // Session active — user is logged in immediately
      showAlert('Account Created!', 'Welcome to SafeGuard SOS. Your account is ready.', [
        { text: 'Continue', onPress: () => router.replace('/(tabs)') },
      ]);
    }
  }, [form, register, router, showAlert]);

  const steps: Step[] = ['personal', 'contact', 'security'];
  const stepIndex = steps.indexOf(step);

  const renderPersonal = () => (
    <>
      <SafeInput label="Full Name" value={form.fullName} onChangeText={v => update('fullName', v)} placeholder="Alex Johnson" leftIcon="person" error={errors.fullName} />
      <SafeInput label="Date of Birth" value={form.dateOfBirth} onChangeText={v => update('dateOfBirth', v)} placeholder="YYYY-MM-DD" leftIcon="cake" error={errors.dateOfBirth} />
      <View style={styles.genderSection}>
        <Text style={styles.fieldLabel}>Gender</Text>
        <View style={styles.genderGrid}>
          {GENDERS.map(g => (
            <Pressable key={g} style={[styles.genderOption, form.gender === g && styles.genderSelected]}
              onPress={() => update('gender', g)}>
              <Text style={[styles.genderText, form.gender === g && styles.genderTextSelected]}>{g}</Text>
            </Pressable>
          ))}
        </View>
        {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
      </View>
    </>
  );

  const renderContact = () => (
    <>
      <SafeInput label="Email Address" value={form.email} onChangeText={v => update('email', v)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" leftIcon="email" error={errors.email} />
      <SafeInput label="Mobile Number" value={form.phone} onChangeText={v => update('phone', v)} placeholder="+91 98765 43210" keyboardType="phone-pad" leftIcon="phone" error={errors.phone} />
      <SafeInput label="Home Address (Optional)" value={form.homeAddress} onChangeText={v => update('homeAddress', v)} placeholder="123 Main Street" leftIcon="home" />
      <View style={styles.row2}>
        <SafeInput label="City" value={form.city} onChangeText={v => update('city', v)} placeholder="City" containerStyle={styles.half} />
        <SafeInput label="State" value={form.state} onChangeText={v => update('state', v)} placeholder="State" containerStyle={styles.half} />
      </View>
      <View style={styles.row2}>
        <SafeInput label="Country" value={form.country} onChangeText={v => update('country', v)} placeholder="India" containerStyle={styles.half} />
        <SafeInput label="Postal Code" value={form.postalCode} onChangeText={v => update('postalCode', v)} placeholder="400001" containerStyle={styles.half} />
      </View>
    </>
  );

  const renderSecurity = () => {
    const pwd = form.password;
    const strength = !pwd ? 0 : [pwd.length >= 8, /[A-Z]/.test(pwd), /[0-9]/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length;
    const strengthColors = ['', Colors.danger, Colors.warning, Colors.secondary, Colors.success];
    const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return (
      <>
        <View style={styles.securityNote}>
          <MaterialIcons name="lock" size={16} color={Colors.secondary} />
          <Text style={styles.securityNoteText}>Minimum 6 characters required</Text>
        </View>
        <SafeInput label="Password" value={form.password} onChangeText={v => update('password', v)} placeholder="Create a strong password" isPassword leftIcon="lock" error={errors.password} />
        {form.password.length > 0 ? (
          <View style={styles.strengthMeter}>
            <View style={styles.strengthBars}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={[styles.strengthBar, { backgroundColor: i <= strength ? strengthColors[strength] : Colors.border }]} />
              ))}
            </View>
            <Text style={[styles.strengthLabel, { color: strengthColors[strength] }]}>{strengthLabels[strength]}</Text>
          </View>
        ) : null}
        <SafeInput label="Confirm Password" value={form.confirmPassword} onChangeText={v => update('confirmPassword', v)} placeholder="Re-enter password" isPassword leftIcon="lock-outline" error={errors.confirmPassword} />
        <View style={styles.requirementsList}>
          {[
            { label: '6+ characters', met: pwd.length >= 6 },
            { label: 'Uppercase letter', met: /[A-Z]/.test(pwd) },
            { label: 'Number', met: /[0-9]/.test(pwd) },
            { label: 'Special character', met: /[^A-Za-z0-9]/.test(pwd) },
          ].map(r => (
            <View key={r.label} style={styles.reqItem}>
              <MaterialIcons name={r.met ? 'check-circle' : 'radio-button-unchecked'} size={14} color={r.met ? Colors.success : Colors.textTertiary} />
              <Text style={[styles.reqText, r.met && styles.reqMet]}>{r.label}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => step === 'personal' ? router.back() : setStep(steps[stepIndex - 1])} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Create Account</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.stepIndicator}>
          {steps.map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive, i < stepIndex && styles.stepDotDone]}>
                {i < stepIndex ? (
                  <MaterialIcons name="check" size={14} color="#fff" />
                ) : (
                  <Text style={styles.stepNum}>{i + 1}</Text>
                )}
              </View>
              {i < steps.length - 1 ? <View style={[styles.stepLine, i < stepIndex && styles.stepLineDone]} /> : null}
            </View>
          ))}
        </View>
        <Text style={styles.stepTitle}>
          {step === 'personal' ? 'Personal Information' : step === 'contact' ? 'Contact & Address' : 'Account Security'}
        </Text>

        <View style={styles.form}>
          {step === 'personal' ? renderPersonal() : step === 'contact' ? renderContact() : renderSecurity()}
        </View>

        <View style={styles.btnRow}>
          {step !== 'personal' ? (
            <SafeButton label="Back" onPress={() => setStep(steps[stepIndex - 1])} variant="outline" style={styles.btnHalf} />
          ) : null}
          <SafeButton
            label={step === 'security' ? 'Create Account' : 'Continue'}
            onPress={step === 'security' ? handleSubmit : handleNext}
            loading={isLoading}
            style={step === 'personal' ? styles.btnFull : styles.btnHalf}
            fullWidth={step === 'personal'}
            size="lg"
          />
        </View>

        <View style={styles.loginHint}>
          <Text style={styles.loginHintText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace('/auth/login')}>
            <Text style={styles.loginHintLink}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.xl, paddingTop: Platform.OS === 'ios' ? 56 : 32, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h3, color: Colors.text, flex: 1, textAlign: 'center' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.success },
  stepNum: { ...Typography.label, color: Colors.textTertiary, fontWeight: '700' },
  stepLine: { width: 48, height: 2, backgroundColor: Colors.border },
  stepLineDone: { backgroundColor: Colors.success },
  stepTitle: { ...Typography.h3, color: Colors.text, textAlign: 'center', marginBottom: Spacing.xl },
  form: { backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.xl, ...Shadows.card, marginBottom: Spacing.xl },
  securityNote: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.secondarySurface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.base,
  },
  securityNoteText: { ...Typography.bodySmall, color: Colors.secondary },
  fieldLabel: { ...Typography.label, color: Colors.text, marginBottom: Spacing.sm },
  genderSection: { marginBottom: Spacing.base },
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  genderOption: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
  },
  genderSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  genderText: { ...Typography.bodySmall, color: Colors.textSecondary },
  genderTextSelected: { color: Colors.primary, fontWeight: '600' },
  errorText: { ...Typography.caption, color: Colors.danger, marginTop: 4 },
  row2: { flexDirection: 'row', gap: Spacing.md },
  half: { flex: 1 },
  strengthMeter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md, marginTop: -8 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { ...Typography.caption, fontWeight: '600', minWidth: 40, textAlign: 'right' },
  requirementsList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  reqItem: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 140 },
  reqText: { ...Typography.caption, color: Colors.textTertiary },
  reqMet: { color: Colors.success },
  btnRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  btnFull: {},
  btnHalf: { flex: 1 },
  loginHint: { flexDirection: 'row', justifyContent: 'center' },
  loginHintText: { ...Typography.bodySmall, color: Colors.textSecondary },
  loginHintLink: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '700' },
});
