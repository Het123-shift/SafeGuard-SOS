import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Pressable, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { SOSButton } from '@/components/feature/SOSButton';
import { SafeCard } from '@/components/ui/SafeCard';
import { useContacts } from '@/hooks/useContacts';
import { useAuth } from '@/hooks/useAuth';
import { useSOS } from '@/hooks/useSOS';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { getTrackingUrl } from '@/services/trackingUrl';
import { openWhatsAppDeepLink, normalizePhoneNumberToE164 } from '@/services/whatsappService';

export default function SOSScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { contacts } = useContacts();
  const {
    phase,
    activeSeconds,
    isSirenMuted,
    toggleSirenMute,
    activeSOSEventId,
    hasSMSPermission,
    requestEmergencyPermissions,
  } = useSOS();
  const [copied, setCopied] = useState(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const trackingUrl = getTrackingUrl(activeSOSEventId || `sos_${Date.now()}`);

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        title: 'SafeGuard SOS Live Emergency Tracking',
        message: `🚨 EMERGENCY SOS ALERT! ${user?.fullName || 'User'} needs urgent help!\nTrack Live: ${trackingUrl}`,
        url: trackingUrl,
      });
    } catch (err) {
      console.warn('Share sheet error:', err);
    }
  };

  const emergencyMessage = `🚨 EMERGENCY SOS ALERT! ${user?.fullName || 'User'} needs urgent help!\nTrack Live: ${trackingUrl}`;

  const handleSendWhatsApp = async (phone: string) => {
    await openWhatsAppDeepLink(phone, emergencyMessage);
  };

  const SOS_STEPS = [
    { icon: 'timer' as const, label: '3-second countdown', color: Colors.warning },
    { icon: 'volume-up' as const, label: 'Audible emergency siren', color: Colors.primary },
    { icon: 'sms' as const, label: 'Emergency SMS dispatched', color: Colors.success },
    { icon: 'location-on' as const, label: 'Live GPS location shared', color: Colors.primary },
    { icon: 'notifications' as const, label: 'Trusted contacts notified', color: '#8B5CF6' },
    { icon: 'mic' as const, label: 'Real ambient audio recording', color: Colors.danger },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <MaterialIcons name="warning" size={24} color={Colors.primary} />
          <Text style={styles.headerTitle}>Emergency SOS</Text>
        </View>
        <Pressable style={styles.sirenToggleBtn} onPress={toggleSirenMute}>
          <MaterialIcons
            name={isSirenMuted ? 'volume-off' : 'volume-up'}
            size={20}
            color={isSirenMuted ? Colors.textTertiary : Colors.primary}
          />
          <Text style={[styles.sirenToggleText, isSirenMuted && { color: Colors.textTertiary }]}>
            {isSirenMuted ? 'Siren Muted' : 'Siren Sound'}
          </Text>
        </Pressable>
      </View>

      {Platform.OS === 'android' && !hasSMSPermission && (
        <Pressable style={styles.permissionWarningBanner} onPress={requestEmergencyPermissions}>
          <MaterialIcons name="sms-failed" size={20} color="#DC2626" />
          <View style={styles.permissionWarningInfo}>
            <Text style={styles.permissionWarningTitle}>SMS Permission Required</Text>
            <Text style={styles.permissionWarningDesc}>
              Tap to allow SafeGuard to automatically dispatch background emergency SMS to your family contacts.
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#DC2626" />
        </Pressable>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {phase === 'active' ? (
          <>
            <SafeCard variant="danger" style={styles.activeCard}>
              <View style={styles.activeBadgeRow}>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeLabel}>SOS ACTIVE</Text>
                </View>
                <View style={styles.recordingPill}>
                  <MaterialIcons name="fiber-manual-record" size={12} color={Colors.danger} />
                  <Text style={styles.recordingText}>Recording Audio</Text>
                </View>
              </View>

              <Text style={styles.activeTime}>{formatTime(activeSeconds)}</Text>
              <Text style={styles.activeDesc}>Emergency alerts & live location sent to {contacts.length} contact(s)</Text>

              <View style={styles.activeInfo}>
                <View style={styles.infoRow}>
                  <MaterialIcons name="person" size={16} color={Colors.danger} />
                  <Text style={styles.infoText}>{user?.fullName || 'User'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="location-on" size={16} color={Colors.danger} />
                  <Text style={styles.infoText}>Live GPS Tracking Active</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="sms" size={16} color={Colors.danger} />
                  <Text style={styles.infoText}>Silent Emergency SMS Sent to Priority Contacts</Text>
                </View>
              </View>
            </SafeCard>

            <View style={styles.trackingCard}>
              <View style={styles.trackingHeader}>
                <MaterialIcons name="share-location" size={18} color={Colors.danger} />
                <Text style={styles.trackingTitle}>Live Responder Tracking Link</Text>
              </View>
              <Text style={styles.trackingUrlText} numberOfLines={2}>
                {trackingUrl}
              </Text>
              <View style={styles.trackingActions}>
                <Pressable
                  style={[styles.actionBtn, copied && styles.actionBtnSuccess]}
                  onPress={handleCopyLink}
                >
                  <MaterialIcons
                    name={copied ? 'check' : 'content-copy'}
                    size={16}
                    color={copied ? '#fff' : Colors.danger}
                  />
                  <Text style={[styles.actionBtnText, copied && { color: '#fff' }]}>
                    {copied ? 'Copied!' : 'Copy Link'}
                  </Text>
                </Pressable>

                <Pressable style={styles.shareBtn} onPress={handleShareLink}>
                  <MaterialIcons name="share" size={16} color="#fff" />
                  <Text style={styles.shareBtnText}>Share Link</Text>
                </Pressable>
              </View>
            </View>

            {contacts.length > 0 && (
              <SafeCard style={styles.whatsappCard}>
                <View style={styles.whatsappHeader}>
                  <View style={styles.whatsappIconCircle}>
                    <FontAwesome name="whatsapp" size={20} color="#fff" />
                  </View>
                  <View style={styles.whatsappHeaderTexts}>
                    <Text style={styles.whatsappTitle}>WhatsApp Direct Fallback</Text>
                    <Text style={styles.whatsappSubtitle}>
                      Tap Send in WhatsApp to notify this contact (SMS was already sent automatically).
                    </Text>
                  </View>
                </View>

                <View style={styles.whatsappList}>
                  {contacts.map((c, index) => {
                    const normalized = normalizePhoneNumberToE164(c.phone);
                    const isFirstContact = index === 0;

                    return (
                      <View key={c.id} style={styles.whatsappRow}>
                        <View style={styles.whatsappContactInfo}>
                          <View style={styles.whatsappNameRow}>
                            <Text style={styles.whatsappContactName}>{c.name}</Text>
                            {c.isPriority ? (
                              <View style={styles.priorityBadge}>
                                <MaterialIcons name="star" size={10} color="#CA8A04" />
                                <Text style={styles.priorityText}>Priority</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.whatsappContactPhone}>
                            {c.phone} {normalized ? `(+${normalized})` : '(Invalid number)'}
                          </Text>
                          {isFirstContact ? (
                            <Text style={styles.autoOpenedHint}>Auto-opened on trigger</Text>
                          ) : null}
                        </View>

                        <Pressable
                          style={[
                            styles.whatsappBtn,
                            !normalized && styles.whatsappBtnDisabled,
                          ]}
                          onPress={() => normalized && handleSendWhatsApp(c.phone)}
                          disabled={!normalized}
                        >
                          <FontAwesome name="whatsapp" size={16} color="#fff" />
                          <Text style={styles.whatsappBtnText}>
                            {isFirstContact ? 'Re-open' : 'Send'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </SafeCard>
            )}
          </>
        ) : null}

        {/* SOS Button */}
        <View style={styles.sosArea}>
          <SOSButton />
          {Platform.OS === 'web' && (
            <View style={styles.hotkeyBanner}>
              <MaterialIcons name="keyboard" size={16} color={Colors.textSecondary} />
              <Text style={styles.hotkeyText}>
                Shortcut: Press <Text style={styles.hotkeyBold}>Space 3x</Text> or <Text style={styles.hotkeyBold}>Ctrl+Shift+S</Text>
              </Text>
            </View>
          )}
        </View>

        {/* What Happens */}
        <SafeCard style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>What happens when SOS is triggered</Text>
          <View style={styles.stepsList}>
            {SOS_STEPS.map((step, i) => (
              <View key={step.label} style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: `${step.color}18` }]}>
                  <Text style={[styles.stepNumText, { color: step.color }]}>{i + 1}</Text>
                </View>
                <MaterialIcons name={step.icon} size={20} color={step.color} />
                <Text style={styles.stepLabel}>{step.label}</Text>
              </View>
            ))}
          </View>
        </SafeCard>

        {/* Contacts that will be notified */}
        <SafeCard style={styles.contactsCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="people" size={20} color={Colors.secondary} />
            <Text style={styles.cardTitle}>Contacts to be notified ({contacts.length}/5)</Text>
          </View>
          {contacts.length === 0 ? (
            <Text style={styles.noContacts}>No trusted contacts added yet. Add contacts to enable SOS alerts.</Text>
          ) : (
            <View style={styles.contactsList}>
              {contacts.map((c) => {
                const initials = c.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <View key={c.id} style={styles.contactRow}>
                    <View style={[styles.contactAvatar, { backgroundColor: Colors.secondary }]}>
                      <Text style={styles.contactInitials}>{initials}</Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{c.name}</Text>
                      <Text style={styles.contactPhone}>{c.phone}</Text>
                    </View>
                    {c.isPriority ? (
                      <View style={styles.priorityBadge}>
                        <MaterialIcons name="star" size={12} color="#CA8A04" />
                        <Text style={styles.priorityText}>Priority</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </SafeCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { ...Typography.h3, color: Colors.text },
  sirenToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  sirenToggleText: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  content: { padding: Spacing.base, gap: Spacing.xl, paddingBottom: 32 },
  activeCard: { borderColor: Colors.primary },
  activeBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  activeLabel: { ...Typography.label, color: Colors.danger, fontWeight: '700' },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dangerSurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  recordingText: { ...Typography.caption, color: Colors.danger, fontWeight: '700', fontSize: 11 },
  activeTime: { fontSize: 48, fontWeight: '800', color: Colors.danger },
  activeDesc: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.md },
  activeInfo: { gap: Spacing.sm, marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoText: { ...Typography.bodySmall, color: Colors.text },
  trackingCard: {
    backgroundColor: Colors.dangerSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  trackingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trackingTitle: { ...Typography.label, color: Colors.danger, fontWeight: '700' },
  trackingUrlText: {
    ...Typography.caption,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.text,
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    fontSize: 11,
  },
  trackingActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.danger,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  actionBtnSuccess: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  actionBtnText: { ...Typography.buttonSmall, color: Colors.danger, fontWeight: '700' },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.danger,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    ...Shadows.sm,
  },
  shareBtnText: { ...Typography.buttonSmall, color: '#fff', fontWeight: '700' },
  sosArea: { alignItems: 'center', paddingVertical: Spacing.lg },
  hotkeyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  hotkeyText: { ...Typography.caption, color: Colors.textSecondary },
  hotkeyBold: { fontWeight: '700', color: Colors.text },
  stepsCard: {},
  stepsTitle: { ...Typography.h4, color: Colors.text, marginBottom: Spacing.md },
  stepsList: { gap: Spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { ...Typography.label, fontWeight: '700' },
  stepLabel: { ...Typography.bodySmall, color: Colors.text, flex: 1 },
  contactsCard: {},
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardTitle: { ...Typography.h4, color: Colors.text },
  noContacts: { ...Typography.bodySmall, color: Colors.textSecondary, fontStyle: 'italic' },
  contactsList: { gap: Spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  contactInitials: { ...Typography.label, color: '#fff', fontWeight: '700' },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.label, color: Colors.text, fontWeight: '600' },
  contactPhone: { ...Typography.caption, color: Colors.textSecondary },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  priorityText: { ...Typography.caption, color: '#92400E', fontWeight: '600' },
  whatsappCard: {
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: '#25D36640',
    backgroundColor: '#0F2618',
  },
  whatsappHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  whatsappIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappHeaderTexts: {
    flex: 1,
  },
  whatsappTitle: {
    ...Typography.h4,
    color: '#E6FFFA',
  },
  whatsappSubtitle: {
    ...Typography.caption,
    color: '#9AE6B4',
    marginTop: 2,
  },
  whatsappList: {
    gap: Spacing.sm,
  },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#153622',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  whatsappContactInfo: {
    flex: 1,
  },
  whatsappNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  whatsappContactName: {
    ...Typography.bodySmall,
    color: '#fff',
    fontWeight: '600',
  },
  whatsappContactPhone: {
    ...Typography.caption,
    color: '#A0AEC0',
    marginTop: 1,
  },
  autoOpenedHint: {
    fontSize: 10,
    color: '#68D391',
    fontWeight: '600',
    marginTop: 2,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  whatsappBtnDisabled: {
    backgroundColor: '#4A5568',
    opacity: 0.6,
  },
  whatsappBtnText: {
    ...Typography.buttonSmall,
    color: '#fff',
    fontWeight: '700',
  },
  permissionWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  permissionWarningInfo: {
    flex: 1,
  },
  permissionWarningTitle: {
    ...Typography.label,
    color: '#DC2626',
    fontWeight: '700',
  },
  permissionWarningDesc: {
    ...Typography.caption,
    color: '#991B1B',
    marginTop: 2,
  },
});
