import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useContacts } from '@/hooks/useContacts';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

const CRITERIA = [
  { key: 'emailVerified', label: 'Email Verified', points: 20, icon: 'email' as const, route: null },
  { key: 'phoneVerified', label: 'Phone Verified', points: 20, icon: 'phone' as const, route: '/screens/phone-verification' },
  { key: 'locationVerified', label: 'Location Set', points: 15, icon: 'location-on' as const, route: '/screens/location-setup' },
  { key: 'hasContacts', label: 'Contacts Added', points: 20, icon: 'people' as const, route: '/(tabs)/contacts' },
  { key: 'hasProfile', label: 'Profile Complete', points: 25, icon: 'person' as const, route: '/screens/medical' },
];

export const SafetyScoreCard = React.memo(function SafetyScoreCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { contacts } = useContacts();

  const checks = {
    emailVerified: user?.emailVerified ?? false,
    phoneVerified: user?.phoneVerified ?? false,
    locationVerified: user?.locationVerified ?? false,
    hasContacts: contacts.length > 0,
    hasProfile: !!(user?.fullName && user?.dateOfBirth),
  };

  const score = CRITERIA.reduce((acc, c) => acc + (checks[c.key as keyof typeof checks] ? c.points : 0), 0);
  const color = score >= 80 ? Colors.success : score >= 50 ? Colors.warning : Colors.danger;
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Setup';

  return (
    <SafeCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Safety Score</Text>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      </View>
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreNum, { color }]}>{score}</Text>
        <Text style={styles.scoreMax}>/100</Text>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
      <View style={styles.criteria}>
        {CRITERIA.map(c => (
          <Pressable
            key={c.key}
            style={styles.criteriaItem}
            onPress={() => c.route && router.push(c.route as any)}
          >
            <MaterialIcons
              name={checks[c.key as keyof typeof checks] ? 'check-circle' : 'radio-button-unchecked'}
              size={16}
              color={checks[c.key as keyof typeof checks] ? Colors.success : Colors.textTertiary}
            />
            <Text style={[styles.criteriaLabel, !checks[c.key as keyof typeof checks] && styles.incomplete]}>
              {c.label}
            </Text>
            <Text style={styles.points}>+{c.points}</Text>
            <MaterialIcons name="chevron-right" size={16} color={Colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </SafeCard>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  title: { ...Typography.h4, color: Colors.text },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { ...Typography.caption, color: '#fff', fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: Spacing.sm },
  scoreNum: { fontSize: 48, fontWeight: '800' },
  scoreMax: { ...Typography.h3, color: Colors.textTertiary, marginLeft: 4 },
  progressBg: { height: 8, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full, marginBottom: Spacing.base, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  criteria: { gap: 8 },
  criteriaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  criteriaLabel: { ...Typography.bodySmall, color: Colors.text, flex: 1 },
  incomplete: { color: Colors.textTertiary },
  points: { ...Typography.caption, color: Colors.textTertiary, fontWeight: '600' },
});
