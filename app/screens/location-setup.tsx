import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeCard } from '@/components/ui/SafeCard';
import { SafeButton } from '@/components/ui/SafeButton';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { LocationVerificationService, VerifiedLocation } from '@/services/locationVerificationService';

export default function LocationSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [verifiedLoc, setVerifiedLoc] = useState<VerifiedLocation | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadLocation();
  }, []);

  const loadLocation = async () => {
    const loc = await LocationVerificationService.getVerifiedLocation();
    if (loc) {
      setVerifiedLoc(loc);
    }
  };

  const handleCaptureGPS = async () => {
    setErrorMsg('');
    setIsLoading(true);
    const res = await LocationVerificationService.captureAndVerifyLocation();
    setIsLoading(false);

    if (res.success && res.location) {
      setVerifiedLoc(res.location);
    } else {
      setErrorMsg(res.error || 'Failed to capture GPS location.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Header Badge */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, verifiedLoc?.isVerified && styles.iconWrapVerified]}>
            <MaterialIcons
              name={verifiedLoc?.isVerified ? 'verified' : 'location-on'}
              size={36}
              color={verifiedLoc?.isVerified ? Colors.success : Colors.primary}
            />
          </View>
          <Text style={styles.title}>
            {verifiedLoc?.isVerified ? 'Location Set & Verified' : 'Set Emergency Location'}
          </Text>
          <Text style={styles.subtitle}>
            High-precision GPS location is used to send live tracking maps to emergency contacts during an SOS trigger.
          </Text>
        </View>

        {/* Location Display Card */}
        {verifiedLoc?.isVerified ? (
          <SafeCard style={styles.cardVerified}>
            <View style={styles.badgeHeader}>
              <MaterialIcons name="check-circle" size={24} color={Colors.success} />
              <Text style={styles.badgeTitle}>GPS Location Active</Text>
            </View>

            <View style={styles.addressBox}>
              <MaterialIcons name="place" size={22} color={Colors.primary} />
              <View style={styles.addressTextWrap}>
                <Text style={styles.addressTitle}>{verifiedLoc.formattedAddress}</Text>
                <Text style={styles.coordsText}>
                  Lat: {verifiedLoc.latitude.toFixed(6)} • Lng: {verifiedLoc.longitude.toFixed(6)}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoPill}>
                <MaterialIcons name="gps-fixed" size={16} color={Colors.success} />
                <Text style={styles.infoText}>High Accuracy</Text>
              </View>
              <View style={styles.infoPill}>
                <MaterialIcons name="security" size={16} color={Colors.primary} />
                <Text style={styles.infoText}>Safe Zone Ready</Text>
              </View>
            </View>

            <SafeButton
              label={isLoading ? 'Re-scanning GPS...' : 'Re-verify GPS Location'}
              onPress={handleCaptureGPS}
              loading={isLoading}
              variant="secondary"
              fullWidth
              style={{ marginTop: Spacing.md }}
            />
          </SafeCard>
        ) : (
          <SafeCard style={styles.card}>
            <Text style={styles.cardTitle}>Automatic GPS Detection</Text>
            <Text style={styles.cardDesc}>
              Tap the button below to allow high-accuracy GPS capture and verify your primary emergency location.
            </Text>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <SafeButton
              label={isLoading ? 'Detecting Live Coordinates...' : 'Detect & Verify GPS Location'}
              onPress={handleCaptureGPS}
              loading={isLoading}
              fullWidth
              style={{ marginTop: Spacing.sm }}
            />
          </SafeCard>
        )}

        {/* Safe Zone Info Card */}
        <SafeCard style={styles.guideCard}>
          <Text style={styles.guideTitle}>Emergency Safe Zone Protocol</Text>
          <View style={styles.guideStep}>
            <MaterialIcons name="my-location" size={20} color={Colors.primary} />
            <Text style={styles.guideText}>
              <Text style={styles.bold}>Continuous GPS Stream:</Text> Live coordinates update every 5 seconds during active SOS.
            </Text>
          </View>
          <View style={styles.guideStep}>
            <MaterialIcons name="map" size={20} color={Colors.success} />
            <Text style={styles.guideText}>
              <Text style={styles.bold}>Google Maps Link:</Text> Trusted contacts receive a direct link to track your movement live.
            </Text>
          </View>
        </SafeCard>
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
  cardTitle: { ...Typography.h4, color: Colors.text },
  cardDesc: { ...Typography.caption, color: Colors.textSecondary },
  cardVerified: { borderColor: Colors.successSurface, borderWidth: 1.5, gap: Spacing.md },
  badgeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeTitle: { ...Typography.h3, color: Colors.success, fontWeight: '700' },
  addressBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: Radius.xl,
  },
  addressTextWrap: { flex: 1 },
  addressTitle: { ...Typography.label, color: Colors.text, fontWeight: '700', marginBottom: 2 },
  coordsText: { ...Typography.caption, color: Colors.textSecondary, fontSize: 11 },
  infoRow: { flexDirection: 'row', gap: Spacing.sm },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, flex: 1,
  },
  infoText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  errorText: { ...Typography.caption, color: Colors.danger, fontWeight: '600', textAlign: 'center' },
  guideCard: { gap: Spacing.md },
  guideTitle: { ...Typography.h4, color: Colors.text },
  guideStep: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  guideText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  bold: { fontWeight: '700', color: Colors.text },
});
