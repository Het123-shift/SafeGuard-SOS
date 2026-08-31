import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import { useAuth } from '@/hooks/useAuth';
import { SafeButton } from '@/components/ui/SafeButton';
import { SafeInput } from '@/components/ui/SafeInput';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

type LoginTab = 'password' | 'otp';

export default function LoginScreen() {
  const router = useRouter();
  const { login, sendEmailOTP, verifyEmailOTP, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<LoginTab>('password');

  // Password login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // OTP login
  const [otpEmail, setOtpEmail] = useState('');
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = useCallback(async () => {
    if (!validate()) return;
    setIsLoading(true);
    const success = await login(email.trim(), password);
    setIsLoading(false);
    if (success) {
      router.replace('/(tabs)');
    } else {
      showAlert('Login Failed', 'Incorrect email or password. Please check your credentials or create a new account.');
    }
  }, [email, password, login, router, showAlert]);

  // --- Email OTP ---
  const handleSendOTP = useCallback(async () => {
    if (!otpEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)) {
      setOtpError('Enter a valid email address');
      return;
    }
    setOtpLoading(true);
    const { error } = await sendEmailOTP(otpEmail.trim());
    setOtpLoading(false);
    if (error) {
      setOtpError(error);
    } else {
      setOtpStep('code');
      setOtpError('');
      setOtpCode('');
    }
  }, [otpEmail, sendEmailOTP]);

  const handleVerifyOTP = useCallback(async () => {
    if (otpCode.length < 4) {
      setOtpError('Enter the 4-digit verification code');
      return;
    }
    setOtpLoading(true);
    const { error } = await verifyEmailOTP(otpEmail.trim(), otpCode);
    setOtpLoading(false);
    if (error) {
      setOtpError(error || 'Invalid or expired code. Please try again.');
      setOtpCode('');
    } else {
      router.replace('/(tabs)');
    }
  }, [otpEmail, otpCode, verifyEmailOTP, router]);

  const resetOTP = () => {
    setOtpStep('email');
    setOtpCode('');
    setOtpError('');
  };

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <MaterialIcons name="shield" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>SafeGuard SOS</Text>
          <Text style={styles.tagline}>Your personal safety companion</Text>
        </View>

        {/* Tab row */}
        <View style={styles.tabRow}>
          {(['password', 'otp'] as const).map(tab => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => { setActiveTab(tab); setErrors({}); setOtpError(''); }}
            >
              <MaterialIcons
                name={tab === 'password' ? 'lock' : 'email'}
                size={16}
                color={activeTab === tab ? '#fff' : Colors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'password' ? 'Password' : 'Email OTP'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Form card */}
        <View style={styles.formCard}>
          {activeTab === 'password' ? (
            <>
              <Text style={styles.formTitle}>Welcome Back</Text>
              <Text style={styles.formSubtitle}>Sign in with your email and password</Text>
              <SafeInput
                label="Email Address"
                value={email}
                onChangeText={v => { setEmail(v); setErrors(e => { const n = { ...e }; delete n.email; return n; }); }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="email"
                error={errors.email}
              />
              <SafeInput
                label="Password"
                value={password}
                onChangeText={v => { setPassword(v); setErrors(e => { const n = { ...e }; delete n.password; return n; }); }}
                placeholder="Enter your password"
                isPassword
                leftIcon="lock"
                error={errors.password}
              />
              <SafeButton
                label={isLoading ? 'Signing in...' : 'Sign In'}
                onPress={handleLogin}
                loading={isLoading}
                fullWidth
                size="lg"
                style={styles.actionBtn}
              />
              <Pressable
                style={styles.demoBtn}
                onPress={() => {
                  login('alex.m@example.com', 'demo123');
                  router.replace('/(tabs)');
                }}
              >
                <MaterialIcons name="flash-on" size={18} color={Colors.primary} />
                <Text style={styles.demoBtnText}>Quick Demo Access</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>
                {otpStep === 'email' ? 'Sign in with OTP' : 'Enter Verification Code'}
              </Text>
              <Text style={styles.formSubtitle}>
                {otpStep === 'email'
                  ? 'We will send a 4-digit code to your email'
                  : `Code sent to ${otpEmail}`}
              </Text>

              {otpStep === 'email' ? (
                <>
                  <SafeInput
                    label="Email Address"
                    value={otpEmail}
                    onChangeText={v => { setOtpEmail(v); setOtpError(''); }}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    leftIcon="email"
                    error={otpError}
                  />
                  <SafeButton
                    label={otpLoading ? 'Sending...' : 'Send OTP Code'}
                    onPress={handleSendOTP}
                    loading={otpLoading}
                    fullWidth
                    size="lg"
                    style={styles.actionBtn}
                    variant="secondary"
                  />
                </>
              ) : (
                <>
                  {/* 4-digit OTP boxes */}
                  <View style={styles.otpContainer}>
                    <View style={styles.otpBoxRow}>
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
                      onChangeText={v => { setOtpCode(v.replace(/[^0-9]/g, '').slice(0, 4)); setOtpError(''); }}
                      keyboardType="number-pad"
                      maxLength={4}
                      autoFocus
                    />
                  </View>
                  {otpError ? <Text style={styles.otpError}>{otpError}</Text> : null}
                  <SafeButton
                    label={otpLoading ? 'Verifying...' : 'Verify & Sign In'}
                    onPress={handleVerifyOTP}
                    loading={otpLoading}
                    fullWidth
                    size="lg"
                    style={styles.actionBtn}
                  />
                  <Pressable style={styles.resendBtn} onPress={resetOTP}>
                    <Text style={styles.resendText}>Resend code or change email</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>

        {/* Social login section */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialRow}>
          {(['Google', 'Apple'] as const).map(provider => (
            <Pressable
              key={provider}
              style={styles.socialBtn}
              onPress={() =>
                showAlert(
                  `${provider} Sign-In`,
                  `To enable ${provider} login, configure the ${provider} provider in your Supabase Dashboard → Authentication → Providers.`
                )
              }
            >
              <MaterialIcons
                name={provider === 'Google' ? 'g-translate' : 'phone-iphone'}
                size={20}
                color={Colors.textSecondary}
              />
              <Text style={styles.socialText}>{provider}</Text>
            </Pressable>
          ))}
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <MaterialIcons name="verified-user" size={14} color={Colors.success} />
          <Text style={styles.securityText}>Secured with end-to-end encryption</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to SafeGuard? </Text>
          <Pressable onPress={() => router.push('/auth/register')}>
            <Text style={styles.footerLink}>Create Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.xl, paddingTop: Platform.OS === 'ios' ? 64 : 40, paddingBottom: 40 },

  hero: { alignItems: 'center', marginBottom: Spacing.xl },
  logoWrap: {
    width: 84, height: 84, borderRadius: 22, backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, ...Shadows.md,
  },
  appName: { ...Typography.h1, color: Colors.text, fontWeight: '800' },
  tagline: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 4 },

  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full, padding: 4, gap: 4, marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: Radius.full,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { ...Typography.buttonSmall, color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },

  formCard: {
    backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.xl,
    ...Shadows.card, marginBottom: Spacing.xl,
  },
  formTitle: { ...Typography.h2, color: Colors.text, marginBottom: 4 },
  formSubtitle: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 20 },
  actionBtn: { marginTop: Spacing.sm },

  otpContainer: { alignItems: 'center', marginBottom: Spacing.sm, position: 'relative' },
  otpBoxRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  otpBox: {
    width: 64, height: 72, borderRadius: Radius.lg, borderWidth: 2,
    borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: Colors.secondary, backgroundColor: Colors.secondarySurface },
  otpBoxActive: { borderColor: Colors.primary, borderWidth: 2.5, backgroundColor: Colors.primarySurface },
  otpDigit: { fontSize: 28, fontWeight: '800', color: Colors.text },
  hiddenInput: { position: 'absolute', width: '100%', height: 72, opacity: 0 },
  otpError: { ...Typography.caption, color: Colors.danger, textAlign: 'center', marginBottom: Spacing.sm },
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  resendText: { ...Typography.bodySmall, color: Colors.secondary, fontWeight: '600' },

  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: Spacing.md, paddingVertical: Spacing.md, borderRadius: Radius.xl,
    backgroundColor: Colors.primarySurface, borderWidth: 1.5, borderColor: Colors.primaryLight,
  },
  demoBtnText: { ...Typography.buttonSmall, color: Colors.primary, fontWeight: '700' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { ...Typography.caption, color: Colors.textTertiary, marginHorizontal: Spacing.md },

  socialRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.surface, minHeight: 52,
  },
  socialText: { ...Typography.buttonSmall, color: Colors.textSecondary },

  securityNote: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginBottom: Spacing.xl,
  },
  securityText: { ...Typography.caption, color: Colors.success },

  footer: { flexDirection: 'row', justifyContent: 'center', paddingBottom: Spacing.xxl },
  footerText: { ...Typography.body, color: Colors.textSecondary },
  footerLink: { ...Typography.body, color: Colors.primary, fontWeight: '700' },
});
