import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/services/storageService';
import { biometricService } from '@/services/biometricService';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

export default function IndexPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [isBioPrompting, setIsBioPrompting] = useState(false);
  const [bioFailed, setBioFailed] = useState(false);

  const authenticateAndRoute = async () => {
    const isBioEnabled = await biometricService.isBiometricsEnabled();
    if (isBioEnabled) {
      setIsBioPrompting(true);
      const auth = await biometricService.authenticate('Unlock SafeGuard SOS');
      setIsBioPrompting(false);
      if (auth.success) {
        setBioFailed(false);
        router.replace('/(tabs)/sos' as any);
      } else {
        setBioFailed(true);
      }
    } else {
      router.replace('/(tabs)/sos' as any);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    const check = async () => {
      const onboarded = await StorageService.isOnboarded();
      if (!onboarded) {
        router.replace('/onboarding');
      } else if (!isAuthenticated) {
        router.replace('/auth/login');
      } else {
        authenticateAndRoute();
      }
    };
    check();
  }, [isLoading, isAuthenticated]);

  if (bioFailed) {
    return (
      <View style={styles.container}>
        <MaterialIcons name="lock" size={48} color={Colors.primary} style={{ marginBottom: Spacing.md }} />
        <Text style={styles.lockTitle}>SafeGuard SOS Locked</Text>
        <Text style={styles.lockSubtitle}>Biometric authentication required to access your safety dashboard.</Text>
        <Pressable style={styles.unlockBtn} onPress={authenticateAndRoute}>
          <MaterialIcons name="fingerprint" size={24} color="#fff" />
          <Text style={styles.unlockBtnText}>Unlock with Biometrics</Text>
        </Pressable>
        <Pressable style={styles.loginFallbackBtn} onPress={() => router.replace('/auth/login')}>
          <Text style={styles.loginFallbackText}>Sign in with Password instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: Spacing.xl },
  lockTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.xs },
  lockSubtitle: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: Radius.full, marginBottom: Spacing.md,
  },
  unlockBtnText: { ...Typography.bodySmall, fontWeight: '700', color: '#fff' },
  loginFallbackBtn: { padding: Spacing.sm },
  loginFallbackText: { ...Typography.caption, color: Colors.secondary, fontWeight: '600' },
});
