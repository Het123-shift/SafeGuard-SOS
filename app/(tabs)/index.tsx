import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useContacts } from '@/hooks/useContacts';
import { useSOS } from '@/hooks/useSOS';
import { SafeCard } from '@/components/ui/SafeCard';
import { SafetyScoreCard } from '@/components/feature/SafetyScoreCard';
import { SmartWatchCard } from '@/components/feature/SmartWatchCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { MOCK_ACTIVITIES, SAFETY_TIPS } from '@/services/mockData';

const QUICK_ACTIONS = [
  { id: 'share', icon: 'location-on' as const, label: 'Share Location', color: Colors.secondary, route: '/location' },
  { id: 'call', icon: 'call' as const, label: 'Call Emergency', color: Colors.success, route: '/screens/helplines' },
  { id: 'notify', icon: 'notifications' as const, label: 'Alert Contacts', color: Colors.warning, route: '/contacts' },
  { id: 'help', icon: 'local-hospital' as const, label: 'Nearby Help', color: '#8B5CF6', route: '/screens/helplines' },
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, calculateSafetyScore } = useAuth();
  const { contacts } = useContacts();
  const { phase } = useSOS();
  const score = calculateSafetyScore();
  const tip = SAFETY_TIPS[Math.floor(Date.now() / 86400000) % SAFETY_TIPS.length];

  const firstName = user?.fullName?.split(' ')[0] || 'User';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleQuickAction = useCallback((route: string) => {
    router.push(route as any);
  }, [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{firstName}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, { backgroundColor: phase === 'active' ? Colors.danger : Colors.success }]} />
          <Text style={styles.statusText}>{phase === 'active' ? 'SOS Active' : 'Safe'}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* SOS Warning Banner */}
        {phase === 'active' ? (
          <View style={styles.sosBanner}>
            <MaterialIcons name="warning" size={20} color="#fff" />
            <Text style={styles.sosBannerText}>SOS IS ACTIVE — Help is on the way</Text>
          </View>
        ) : null}

        {/* Safety Score */}
        <SafetyScoreCard />

        {/* Smartwatch Companion */}
        <View style={{ paddingHorizontal: Spacing.base }}>
          <SmartWatchCard />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map(action => (
              <Pressable key={action.id} style={styles.quickCard} onPress={() => handleQuickAction(action.route)}>
                <View style={[styles.quickIcon, { backgroundColor: `${action.color}18` }]}>
                  <MaterialIcons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Trusted Contacts Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trusted Contacts</Text>
            <Pressable onPress={() => router.push('/(tabs)/contacts')}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.contactsRow}>
            {contacts.slice(0, 4).map(c => {
              const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <View key={c.id} style={styles.contactChip}>
                  <View style={[styles.contactAvatar, { backgroundColor: Colors.secondary }]}>
                    <Text style={styles.contactInitials}>{initials}</Text>
                    {c.isPriority ? <View style={styles.priorityDot} /> : null}
                  </View>
                  <Text style={styles.contactName} numberOfLines={1}>{c.name.split(' ')[0]}</Text>
                </View>
              );
            })}
            <Pressable style={styles.addContactChip} onPress={() => router.push('/(tabs)/contacts')}>
              <MaterialIcons name="add" size={22} color={Colors.primary} />
              <Text style={styles.addContactText}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Feature Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Features</Text>
          <View style={styles.featureGrid}>
            {[
              { icon: 'shield' as const, label: 'Medical Profile', desc: 'Blood group, allergies', color: Colors.danger, route: '/screens/medical' },
              { icon: 'folder' as const, label: 'Evidence Vault', desc: 'Secure recordings', color: '#8B5CF6', route: '/screens/evidence' },
              { icon: 'group' as const, label: 'Family Circle', desc: 'Real-time tracking', color: Colors.success, route: '/screens/family' },
              { icon: 'phone' as const, label: 'Helplines', desc: 'Emergency numbers', color: Colors.secondary, route: '/screens/helplines' },
              { icon: 'history' as const, label: 'SOS History', desc: 'Past alerts', color: Colors.warning, route: '/screens/sos-history' },
              { icon: 'settings' as const, label: 'Settings', desc: 'App preferences', color: Colors.textSecondary, route: '/screens/settings' },
            ].map(f => (
              <Pressable key={f.label} style={styles.featureCard} onPress={() => router.push(f.route as any)}>
                <View style={[styles.featureIcon, { backgroundColor: `${f.color}18` }]}>
                  <MaterialIcons name={f.icon} size={24} color={f.color} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Safety Tip */}
        <SafeCard style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <MaterialIcons name="lightbulb" size={20} color={Colors.warning} />
            <Text style={styles.tipTitle}>Safety Tip</Text>
          </View>
          <Text style={styles.tipText}>{tip}</Text>
        </SafeCard>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {MOCK_ACTIVITIES.map(a => (
            <View key={a.id} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: `${a.color}18` }]}>
                <MaterialIcons name={a.icon as any} size={20} color={a.color} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{a.title}</Text>
                <Text style={styles.activityDetail}>{a.detail}</Text>
              </View>
              <Text style={styles.activityTime}>{a.time}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.base, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingTop: Spacing.md,
  },
  greeting: { ...Typography.bodySmall, color: Colors.textSecondary },
  name: { ...Typography.h2, color: Colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { ...Typography.label, color: Colors.textSecondary },
  scrollContent: { paddingBottom: 32 },
  sosBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, padding: Spacing.md, marginBottom: Spacing.base,
  },
  sosBannerText: { ...Typography.label, color: '#fff', fontWeight: '700', flex: 1 },
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { ...Typography.h4, color: Colors.text, marginBottom: Spacing.md },
  seeAll: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  quickCard: {
    flex: 1, minWidth: '44%', backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.base, alignItems: 'center', gap: Spacing.sm,
    ...Shadows.card,
  },
  quickIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { ...Typography.bodySmall, color: Colors.text, textAlign: 'center', fontWeight: '600' },
  contactsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  contactChip: { alignItems: 'center', gap: Spacing.xs, width: 64 },
  contactAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  contactInitials: { ...Typography.h4, color: '#fff', fontWeight: '700' },
  priorityDot: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.warning, borderWidth: 2, borderColor: Colors.surface,
  },
  contactName: { ...Typography.caption, color: Colors.text, textAlign: 'center', maxWidth: 60 },
  addContactChip: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: Colors.primary,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  addContactText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  featureCard: {
    flex: 1, minWidth: '44%', backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.base, gap: 6, ...Shadows.card,
  },
  featureIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  featureLabel: { ...Typography.label, color: Colors.text, fontWeight: '600' },
  featureDesc: { ...Typography.caption, color: Colors.textSecondary },
  tipCard: { marginHorizontal: Spacing.base, marginBottom: Spacing.xl, backgroundColor: Colors.warningSurface, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  tipTitle: { ...Typography.label, color: Colors.warning, fontWeight: '700' },
  tipText: { ...Typography.bodySmall, color: Colors.text, lineHeight: 22 },
  activityItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadows.sm,
  },
  activityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  activityInfo: { flex: 1 },
  activityTitle: { ...Typography.label, color: Colors.text, fontWeight: '600' },
  activityDetail: { ...Typography.caption, color: Colors.textSecondary },
  activityTime: { ...Typography.caption, color: Colors.textTertiary },
});
