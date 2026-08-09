import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable,
  Animated, Modal, ScrollView, Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSOS } from '@/hooks/useSOS';
import { SOSEvent } from '@/contexts/SOSContext';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// Enrich SOS events with extra mock fields for display
interface RichSOSEvent extends SOSEvent {
  severity: 'critical' | 'high' | 'medium';
  notifiedNames?: string[];
  evidenceCount?: number;
  responseTime?: number; // seconds
}

const SEVERITY_CONFIG = {
  critical: { color: Colors.primary, bg: Colors.primarySurface, label: 'Critical', icon: 'warning' as const },
  high: { color: Colors.warning, bg: Colors.warningSurface, label: 'High', icon: 'error-outline' as const },
  medium: { color: Colors.secondary, bg: Colors.secondarySurface, label: 'Medium', icon: 'info-outline' as const },
};

function enrichEvent(event: SOSEvent, idx: number): RichSOSEvent {
  const severities: RichSOSEvent['severity'][] = ['critical', 'high', 'medium'];
  return {
    ...event,
    severity: severities[idx % 3],
    notifiedNames: ['Priya S.', 'Rohan M.', 'Mom'].slice(0, Math.max(1, event.contactsNotified)),
    evidenceCount: Math.floor(Math.random() * 4),
    responseTime: Math.floor(Math.random() * 120) + 10,
  };
}

type FilterStatus = 'all' | 'resolved' | 'active';

export default function SOSHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { sosHistory, loadHistory } = useSOS();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedEvent, setSelectedEvent] = useState<RichSOSEvent | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadHistory();
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const enriched: RichSOSEvent[] = sosHistory.map(enrichEvent);

  const filtered = enriched.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'resolved') return !!e.resolvedAt;
    return !e.resolvedAt;
  });

  const totalAlerts = enriched.length;
  const resolvedCount = enriched.filter(e => !!e.resolvedAt).length;
  const totalContacted = enriched.reduce((a, e) => a + e.contactsNotified, 0);
  const avgResponseTime = enriched.length
    ? Math.round(enriched.reduce((a, e) => a + (e.responseTime ?? 0), 0) / enriched.length)
    : 0;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDuration = (secs: number) => {
    if (secs === 0) return '--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const renderItem = ({ item, index }: { item: RichSOSEvent; index: number }) => {
    const sev = SEVERITY_CONFIG[item.severity];
    const isResolved = !!item.resolvedAt;

    return (
      <Pressable onPress={() => setSelectedEvent(item)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
        {/* Timeline dot */}
        <View style={styles.timelineLeft}>
          <View style={[styles.timelineDot, { backgroundColor: sev.color }]}>
            <MaterialIcons name="warning" size={12} color="#fff" />
          </View>
          {index < filtered.length - 1 ? <View style={styles.timelineLine} /> : null}
        </View>

        {/* Card content */}
        <View style={styles.cardContent}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={styles.cardTopLeft}>
              <View style={[styles.severityPill, { backgroundColor: sev.bg }]}>
                <MaterialIcons name={sev.icon} size={12} color={sev.color} />
                <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
              </View>
              <Text style={styles.timeAgo}>{getTimeAgo(item.triggeredAt)}</Text>
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: isResolved ? Colors.successSurface : Colors.dangerSurface,
            }]}>
              <MaterialIcons
                name={isResolved ? 'check-circle' : 'radio-button-unchecked'}
                size={12}
                color={isResolved ? Colors.success : Colors.danger}
              />
              <Text style={[styles.statusText, { color: isResolved ? Colors.success : Colors.danger }]}>
                {isResolved ? 'Resolved' : 'Active'}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.cardTitle}>SOS Emergency Alert</Text>
          <Text style={styles.cardDate}>{formatDate(item.triggeredAt)}</Text>

          {/* Detail rows */}
          <View style={styles.details}>
            <View style={styles.detailRow}>
              <MaterialIcons name="location-on" size={14} color={Colors.textTertiary} />
              <Text style={styles.detailText} numberOfLines={1}>{item.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name="people" size={14} color={Colors.textTertiary} />
              <Text style={styles.detailText}>
                {item.contactsNotified} contact{item.contactsNotified !== 1 ? 's' : ''} notified
                {item.notifiedNames?.length ? ` — ${item.notifiedNames.join(', ')}` : ''}
              </Text>
            </View>
            {item.duration > 0 ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="timer" size={14} color={Colors.textTertiary} />
                <Text style={styles.detailText}>Duration: {formatDuration(item.duration)}</Text>
              </View>
            ) : null}
          </View>

          {/* Bottom stats */}
          <View style={styles.cardStats}>
            {[
              { icon: 'folder' as const, label: `${item.evidenceCount} Evidence`, color: '#8B5CF6' },
              { icon: 'speed' as const, label: `${item.responseTime}s Response`, color: Colors.success },
              { icon: 'chevron-right' as const, label: 'View Details', color: Colors.secondary },
            ].map((s, i) => (
              <View key={i} style={styles.cardStat}>
                <MaterialIcons name={s.icon} size={13} color={s.color} />
                <Text style={[styles.cardStatText, { color: s.color }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, filtered.length === 0 && { flexGrow: 1 }]}
        ListHeaderComponent={
          <View>
            {/* Stats dashboard */}
            <Animated.View style={[styles.statsCard, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
              <View style={styles.statsHeader}>
                <View style={styles.statsIconWrap}>
                  <MaterialIcons name="history" size={22} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.statsTitle}>Emergency History</Text>
                  <Text style={styles.statsSub}>Lifetime SOS activity overview</Text>
                </View>
              </View>
              <View style={styles.statsGrid}>
                {[
                  { value: totalAlerts, label: 'Total Alerts', icon: 'warning' as const, color: Colors.primary },
                  { value: resolvedCount, label: 'Resolved', icon: 'check-circle' as const, color: Colors.success },
                  { value: totalContacted, label: 'Notified', icon: 'people' as const, color: Colors.secondary },
                  { value: `${avgResponseTime}s`, label: 'Avg Response', icon: 'speed' as const, color: Colors.warning },
                ].map(s => (
                  <View key={s.label} style={styles.statBlock}>
                    <View style={[styles.statIconWrap, { backgroundColor: `${s.color}15` }]}>
                      <MaterialIcons name={s.icon} size={18} color={s.color} />
                    </View>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>

              {/* Resolution rate bar */}
              {totalAlerts > 0 ? (
                <View style={styles.rateSection}>
                  <View style={styles.rateRow}>
                    <Text style={styles.rateLabel}>Resolution Rate</Text>
                    <Text style={styles.rateValue}>{Math.round((resolvedCount / totalAlerts) * 100)}%</Text>
                  </View>
                  <View style={styles.rateBg}>
                    <View style={[styles.rateFill, { width: `${(resolvedCount / totalAlerts) * 100}%` as any }]} />
                  </View>
                </View>
              ) : null}
            </Animated.View>

            {/* Filter tabs */}
            <View style={styles.filterRow}>
              {([
                { label: 'All Alerts', value: 'all' as const, count: totalAlerts },
                { label: 'Resolved', value: 'resolved' as const, count: resolvedCount },
                { label: 'Active', value: 'active' as const, count: totalAlerts - resolvedCount },
              ]).map(f => (
                <Pressable
                  key={f.value}
                  style={[styles.filterTab, filter === f.value && styles.filterTabActive]}
                  onPress={() => setFilter(f.value)}
                >
                  <Text style={[styles.filterTabText, filter === f.value && styles.filterTabTextActive]}>{f.label}</Text>
                  <View style={[styles.filterTabCount, filter === f.value && styles.filterTabCountActive]}>
                    <Text style={[styles.filterTabCountText, filter === f.value && { color: '#fff' }]}>{f.count}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {filtered.length > 0 ? (
              <Text style={styles.resultNote}>{filtered.length} event{filtered.length !== 1 ? 's' : ''} found</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="shield" size={56} color={Colors.success} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No SOS Alerts Yet' : `No ${filter} alerts`}
            </Text>
            <Text style={styles.emptyDesc}>
              {filter === 'all'
                ? 'Stay safe! Your emergency history will appear here when you trigger SOS.'
                : `No ${filter} alerts in your history.`}
            </Text>
            <View style={styles.emptyBadge}>
              <MaterialIcons name="verified-user" size={16} color={Colors.success} />
              <Text style={styles.emptyBadgeText}>You are protected by SafeGuard SOS</Text>
            </View>
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelectedEvent(null)} />
          {selectedEvent ? (() => {
            const sev = SEVERITY_CONFIG[selectedEvent.severity];
            const isResolved = !!selectedEvent.resolvedAt;
            return (
              <View style={styles.modalSheet}>
                {/* Handle */}
                <View style={styles.modalHandle} />

                {/* Modal header */}
                <View style={styles.modalHeader}>
                  <View style={[styles.modalSosIcon, { backgroundColor: sev.bg }]}>
                    <MaterialIcons name="warning" size={28} color={sev.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>SOS Emergency Alert</Text>
                    <Text style={styles.modalDate}>{formatDate(selectedEvent.triggeredAt)}</Text>
                  </View>
                  <Pressable onPress={() => setSelectedEvent(null)} hitSlop={8}>
                    <MaterialIcons name="close" size={24} color={Colors.text} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                  {/* Status strip */}
                  <View style={[styles.statusStrip, { backgroundColor: isResolved ? Colors.successSurface : Colors.dangerSurface, borderColor: isResolved ? Colors.success : Colors.danger }]}>
                    <MaterialIcons name={isResolved ? 'check-circle' : 'warning'} size={18} color={isResolved ? Colors.success : Colors.danger} />
                    <Text style={[styles.statusStripText, { color: isResolved ? Colors.success : Colors.danger }]}>
                      {isResolved ? 'Emergency Resolved' : 'Active Emergency'}
                    </Text>
                    <View style={[styles.severityPill, { backgroundColor: sev.bg, marginLeft: 'auto' }]}>
                      <Text style={[styles.severityText, { color: sev.color }]}>{sev.label} Priority</Text>
                    </View>
                  </View>

                  {/* Timeline */}
                  <Text style={styles.sectionLabel}>Timeline</Text>
                  <View style={styles.timeline}>
                    {[
                      { icon: 'warning' as const, color: Colors.primary, label: 'SOS Triggered', time: selectedEvent.triggeredAt, done: true },
                      { icon: 'notifications' as const, color: Colors.warning, label: `${selectedEvent.contactsNotified} Contacts Notified`, time: selectedEvent.triggeredAt, done: true },
                      { icon: 'location-on' as const, color: Colors.secondary, label: 'Live Location Shared', time: selectedEvent.triggeredAt, done: true },
                      { icon: 'videocam' as const, color: '#8B5CF6', label: 'Evidence Recording Started', time: selectedEvent.triggeredAt, done: (selectedEvent.evidenceCount ?? 0) > 0 },
                      { icon: 'check-circle' as const, color: Colors.success, label: 'Emergency Resolved', time: selectedEvent.resolvedAt || '', done: !!selectedEvent.resolvedAt },
                    ].map((step, i) => (
                      <View key={i} style={styles.timelineStep}>
                        <View style={[styles.timelineStepDot, { backgroundColor: step.done ? step.color : Colors.border }]}>
                          <MaterialIcons name={step.icon} size={12} color={step.done ? '#fff' : Colors.textTertiary} />
                        </View>
                        {i < 4 ? <View style={[styles.timelineStepLine, { backgroundColor: step.done ? step.color : Colors.border }]} /> : null}
                        <View style={styles.timelineStepInfo}>
                          <Text style={[styles.timelineStepLabel, { color: step.done ? Colors.text : Colors.textTertiary }]}>
                            {step.label}
                          </Text>
                          {step.time ? <Text style={styles.timelineStepTime}>{formatDate(step.time)}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Details grid */}
                  <Text style={styles.sectionLabel}>Incident Details</Text>
                  <View style={styles.detailsGrid}>
                    {[
                      { icon: 'location-on' as const, label: 'Location', value: selectedEvent.location, color: Colors.secondary },
                      { icon: 'timer' as const, label: 'Duration', value: formatDuration(selectedEvent.duration), color: Colors.warning },
                      { icon: 'speed' as const, label: 'Response Time', value: `${selectedEvent.responseTime}s`, color: Colors.success },
                      { icon: 'folder' as const, label: 'Evidence Files', value: `${selectedEvent.evidenceCount} files`, color: '#8B5CF6' },
                      { icon: 'people' as const, label: 'Contacts Notified', value: `${selectedEvent.contactsNotified} contacts`, color: Colors.secondary },
                      { icon: 'schedule' as const, label: 'Resolved At', value: selectedEvent.resolvedAt ? formatDate(selectedEvent.resolvedAt) : 'Not resolved', color: Colors.success },
                    ].map(d => (
                      <View key={d.label} style={styles.detailBlock}>
                        <View style={[styles.detailBlockIcon, { backgroundColor: `${d.color}15` }]}>
                          <MaterialIcons name={d.icon} size={16} color={d.color} />
                        </View>
                        <Text style={styles.detailBlockLabel}>{d.label}</Text>
                        <Text style={styles.detailBlockValue} numberOfLines={2}>{d.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Notified contacts */}
                  {selectedEvent.notifiedNames?.length ? (
                    <>
                      <Text style={styles.sectionLabel}>Notified Contacts</Text>
                      <View style={styles.contactsRow}>
                        {selectedEvent.notifiedNames.map((name, i) => (
                          <View key={i} style={styles.contactPill}>
                            <View style={styles.contactPillAvatar}>
                              <Text style={styles.contactPillInitial}>{name[0]}</Text>
                            </View>
                            <Text style={styles.contactPillName}>{name}</Text>
                            <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                </ScrollView>
              </View>
            );
          })() : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { padding: Spacing.base, paddingBottom: 40 },

  // Stats card
  statsCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xxl, padding: Spacing.base,
    marginBottom: Spacing.base, borderWidth: 1, borderColor: Colors.primarySurface, ...Shadows.card,
  },
  statsHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.base },
  statsIconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  statsTitle: { ...Typography.h4, color: Colors.text, fontWeight: '700' },
  statsSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  statBlock: { flex: 1, alignItems: 'center', gap: 4 },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { ...Typography.h3, fontWeight: '800' },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  rateSection: { gap: Spacing.sm },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rateLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  rateValue: { ...Typography.label, color: Colors.success, fontWeight: '700' },
  rateBg: { height: 8, backgroundColor: Colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  rateFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },

  // Filters
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  filterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.sm, borderRadius: Radius.lg, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  filterTabActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  filterTabText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  filterTabTextActive: { color: Colors.primary },
  filterTabCount: { backgroundColor: Colors.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  filterTabCountActive: { backgroundColor: Colors.primary },
  filterTabCountText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  resultNote: { ...Typography.caption, color: Colors.textTertiary, marginBottom: Spacing.sm },

  // Timeline card
  card: {
    flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg,
  },
  timelineLeft: { alignItems: 'center', width: 28 },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...Shadows.sm,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  cardContent: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base,
    ...Shadows.card, borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  severityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  severityText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  timeAgo: { ...Typography.caption, color: Colors.textTertiary },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardTitle: { ...Typography.label, color: Colors.text, fontWeight: '700', marginBottom: 2 },
  cardDate: { ...Typography.caption, color: Colors.textTertiary, marginBottom: Spacing.sm },
  details: { gap: 6, marginBottom: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  detailText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  cardStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { ...Typography.caption, fontWeight: '600' },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: Spacing.md },
  emptyIconWrap: { width: 104, height: 104, borderRadius: 52, backgroundColor: Colors.successSurface, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...Typography.h3, color: Colors.text, textAlign: 'center' },
  emptyDesc: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 22 },
  emptyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.successSurface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, marginTop: Spacing.sm,
  },
  emptyBadgeText: { ...Typography.bodySmall, color: Colors.success, fontWeight: '600' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: Spacing.md },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalSosIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { ...Typography.h4, color: Colors.text, fontWeight: '700' },
  modalDate: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  modalContent: { padding: Spacing.base, paddingBottom: 40 },

  statusStrip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.base,
  },
  statusStripText: { ...Typography.label, fontWeight: '700' },

  sectionLabel: { ...Typography.label, color: Colors.textSecondary, fontWeight: '600', marginBottom: Spacing.md, marginTop: Spacing.sm },

  // Timeline steps
  timeline: { gap: 0, marginBottom: Spacing.base },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: 0 },
  timelineStepDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, zIndex: 1,
  },
  timelineStepLine: { position: 'absolute', left: 13, top: 28, width: 2, height: 32 },
  timelineStepInfo: { flex: 1, paddingBottom: Spacing.lg, paddingTop: 4 },
  timelineStepLabel: { ...Typography.label, fontWeight: '600' },
  timelineStepTime: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },

  // Details grid
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base },
  detailBlock: {
    width: (SCREEN_W - Spacing.base * 2 - Spacing.sm) / 2 - Spacing.base * 2,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, padding: Spacing.md, gap: 4,
  },
  detailBlockIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  detailBlockLabel: { ...Typography.caption, color: Colors.textSecondary },
  detailBlockValue: { ...Typography.label, color: Colors.text, fontWeight: '600' },

  contactsRow: { gap: Spacing.sm },
  contactPill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.secondarySurface, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  contactPillAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  contactPillInitial: { fontSize: 12, fontWeight: '700', color: '#fff' },
  contactPillName: { ...Typography.bodySmall, color: Colors.text, fontWeight: '600', flex: 1 },
});
