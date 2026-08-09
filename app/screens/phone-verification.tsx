import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeCard } from '@/components/ui/SafeCard';
import { SafeButton } from '@/components/ui/SafeButton';
import { SafeInput } from '@/components/ui/SafeInput';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { PhoneVerificationService } from '@/services/phoneVerificationService';
import { StorageService } from '@/services/storageService';

export default function PhoneVerificationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [phone, setPhone] = useState('+1 234 567 8900');
  const [step, setStep] = useState<'phone' | 'otp' | 'verified'>('phone');
  const [otp, setOtp] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [shakeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    checkCurrentStatus();
  }, []);

  useEffect(() => {
    let timer: any = null;
    if (step === 'otp' && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendTimer]);

  const checkCurrentStatus = async () => {
    const isVerified = await PhoneVerificationService.isPhoneVerified();
    if (isVerified) {
      const user = await StorageService.getUser();
      if (user?.phone) setPhone(user.phone);
      setStep('verified');
    }
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSendOTP = async () => {
    setErrorMsg('');
    setIsLoading(true);
    const res = await PhoneVerificationService.sendSMSOTP(phone);
    setIsLoading(false);

    if (res.success) {
      if (res.codeSent) {
        setDemoCode(res.codeSent);
      }
      setStep('otp');
      setResendTimer(60);
      setOtp('');
    } else {
      setErrorMsg(res.error || 'Failed to send SMS OTP code.');
    }
  };

  const handleVerifyOTP = async (inputCode: string) => {
    setErrorMsg('');
    if (inputCode.length < 6) return;

    setIsLoading(true);
    const res = await PhoneVerificationService.verifyOTP(inputCode);
    setIsLoading(false);

    if (res.success) {
      setStep('verified');
    } else {
      triggerShake();
      setErrorMsg(res.error || 'Invalid OTP code.');
    }
  };

  const handleOtpChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(clean);
    if (clean.length === 6) {
      handleVerifyOTP(clean);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Header Badge */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, step === 'verified' && styles.iconWrapVerified]}>
            <MaterialIcons
              name={step === 'verified' ? 'verified-user' : 'sms'}
              size={36}
              color={step === 'verified' ? Colors.success : Colors.primary}
            />
          </View>
          <Text style={styles.title}>
            {step === 'phone'
              ? 'Phone Verification'
              : step === 'otp'
              ? 'Enter 6-Digit OTP Code'
              : 'Phone Verified'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'Verify your mobile phone number to receive instant SMS emergency alerts.'
              : step === 'otp'
              ? `We sent a 6-digit SMS code to ${phone}`
              : 'Your phone number is fully verified and connected to emergency dispatch.'}
          </Text>
        </View>

        {/* Step 1: Phone Input */}
        {step === 'phone' && (
          <SafeCard style={styles.card}>
            <SafeInput
              label="Mobile Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 8900"
              keyboardType="phone-pad"
              leftIcon="phone"
            />
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <SafeButton
              label={isLoading ? 'Sending SMS Code...' : 'Send 6-Digit OTP Code'}
              onPress={handleSendOTP}
              loading={isLoading}
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </SafeCard>
        )}

        {/* Step 2: 6-Digit OTP Entry */}
        {step === 'otp' && (
          <SafeCard style={styles.card}>
            {demoCode ? (
              <View style={styles.demoCodeBox}>
                <MaterialIcons name="sms" size={18} color={Colors.primary} />
                <Text style={styles.demoCodeText}>
                  SMS Code Sent: <Text style={styles.boldCode}>{demoCode}</Text>
                </Text>
              </View>
            ) : null}

            {/* OTP Input Fields */}
            <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <View
                  key={idx}
                  style={[
                    styles.otpBox,
                    otp.length > idx && styles.otpBoxFilled,
                    errorMsg ? styles.otpBoxError : null,
                  ]}
                >
                  <Text style={styles.otpChar}>{otp[idx] || ''}</Text>
                </View>
              ))}
            </Animated.View>

            {/* Invisible Text Input overlay */}
            <TextInput
              style={styles.hiddenInput}
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn't receive the SMS code?</Text>
              <Pressable
                disabled={resendTimer > 0}
                onPress={handleSendOTP}
              >
                <Text style={[styles.resendBtnText, resendTimer > 0 && styles.resendDisabled]}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                </Text>
              </Pressable>
            </View>

            <Pressable style={styles.changePhoneBtn} onPress={() => setStep('phone')}>
              <Text style={styles.changePhoneText}>Change phone number</Text>
            </Pressable>
          </SafeCard>
        )}

        {/* Step 3: Verified Badge */}
        {step === 'verified' && (
          <SafeCard style={styles.cardVerified}>
            <View style={styles.verifiedBadgeRow}>
              <MaterialIcons name="check-circle" size={24} color={Colors.success} />
              <Text style={styles.verifiedBadgeTitle}>Phone Number Confirmed</Text>
            </View>
            <Text style={styles.verifiedPhoneText}>{phone}</Text>
            <Text style={styles.verifiedDesc}>
              SMS alerts will be automatically dispatched to priority contacts when emergency SOS is activated.
            </Text>

            <SafeButton
              label="Update Phone Number"
              variant="secondary"
              onPress={() => setStep('phone')}
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </SafeCard>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.lg, paddingBottom: 32 },
  header: { alignItems: 'center', marginBottom: Spacing.md },
  iconWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconWrapVerified: { backgroundColor: Colors.successSurface },
  title: { ...Typography.h2, color: Colors.text, textAlign: 'center', marginBottom: 4 },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.md },
  card: { gap: Spacing.md },
  demoCodeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primarySurface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primaryLight,
  },
  demoCodeText: { ...Typography.caption, color: Colors.primary },
  boldCode: { fontWeight: '800', letterSpacing: 2, fontSize: 15 },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: Spacing.md },
  otpBox: {
    width: 44, height: 54, borderRadius: Radius.lg,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  otpBoxError: { borderColor: Colors.danger, backgroundColor: Colors.dangerSurface },
  otpChar: { fontSize: 24, fontWeight: '800', color: Colors.text },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  errorText: { ...Typography.caption, color: Colors.danger, fontWeight: '600', textAlign: 'center' },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.sm },
  resendText: { ...Typography.caption, color: Colors.textSecondary },
  resendBtnText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  resendDisabled: { color: Colors.textTertiary },
  changePhoneBtn: { alignItems: 'center', marginTop: Spacing.sm },
  changePhoneText: { ...Typography.buttonSmall, color: Colors.textSecondary },
  cardVerified: { borderColor: Colors.successSurface, borderWidth: 1.5, gap: Spacing.sm, alignItems: 'center' },
  verifiedBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedBadgeTitle: { ...Typography.h3, color: Colors.success, fontWeight: '700' },
  verifiedPhoneText: { ...Typography.h2, color: Colors.text, fontWeight: '800', marginVertical: 4 },
  verifiedDesc: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
});
