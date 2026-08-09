import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { StorageService } from '@/services/storageService';
import { SafeCard } from '@/components/ui/SafeCard';
import { SafeButton } from '@/components/ui/SafeButton';
import { SafeInput } from '@/components/ui/SafeInput';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  phone: string;
  status: 'safe' | 'unknown' | 'sos';
  lastSeen: string;
  location: string;
  batteryLevel: number;
}

const MOCK_MEMBERS: FamilyMember[] = [
  { id: 'f1', name: 'Mom', relation: 'Parent', phone: '+1 555 0101', status: 'safe', lastSeen: '2 min ago', location: 'Home', batteryLevel: 85 },
  { id: 'f2', name: 'Dad', relation: 'Parent', phone: '+1 555 0102', status: 'safe', lastSeen: '15 min ago', location: 'Downtown Office', batteryLevel: 42 },
];

const STATUS_COLORS = { safe: Colors.success, unknown: Colors.warning, sos: Colors.danger };
const STATUS_LABELS = { safe: 'Safe', unknown: 'Unknown', sos: 'SOS Active' };

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ name: '', relation: '', phone: '' });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const saved = await StorageService.getFamily();
    setMembers(saved.length > 0 ? saved : MOCK_MEMBERS);
  };

  const handleAdd = async () => {
    if (!form.name || !form.phone) {
      showAlert('Missing Info', 'Please enter name and phone number.');
      return;
    }
    const newMember: FamilyMember = {
      id: `f_${Date.now()}`, name: form.name, relation: form.relation || 'Family',
      phone: form.phone, status: 'unknown', lastSeen: 'Never', location: 'Unknown', batteryLevel: 0,
    };
    const updated = [...members, newMember];
    setMembers(updated);
    await StorageService.saveFamily(updated);
    setModalVisible(false);
    setForm({ name: '', relation: '', phone: '' });
    showAlert('Invitation Sent', `${form.name} will receive an invitation to join your safety circle.`);
  };

  const handleRemove = (id: string) => {
    showAlert('Remove Member?', 'This person will no longer be in your safety circle.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = members.filter(m => m.id !== id);
        setMembers(updated);
        await StorageService.saveFamily(updated);
      }},
    ]);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <SafeCard style={styles.infoBanner}>
          <View style={styles.bannerRow}>
            <MaterialIcons name="family-restroom" size={24} color={Colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Family Safety Circle</Text>
              <Text style={styles.bannerDesc}>Monitor your family members in real-time. Get notified when they arrive safely.</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            {[
              { label: 'Members', value: members.length.toString(), color: Colors.secondary },
              { label: 'Safe', value: members.filter(m => m.status === 'safe').length.toString(), color: Colors.success },
              { label: 'Unknown', value: members.filter(m => m.status === 'unknown').length.toString(), color: Colors.warning },
            ].map(s => (
              <View key={s.label} style={styles.statItem}>
                <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLbl}>{s.label}</Text>
              </View>
            ))}
          </View>
        </SafeCard>

        {/* Members List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Family Members</Text>
            <Pressable style={styles.addBtn} onPress={() => setModalVisible(true)}>
              <MaterialIcons name="person-add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Invite</Text>
            </Pressable>
          </View>

          {members.map(member => {
            const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const statusColor = STATUS_COLORS[member.status];
            return (
              <SafeCard key={member.id} style={styles.memberCard}>
                <View style={styles.memberRow}>
                  <View style={styles.avatarContainer}>
                    <View style={[styles.avatar, { backgroundColor: Colors.secondary }]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[member.status]}</Text>
                      </View>
                    </View>
                    <Text style={styles.memberRelation}>{member.relation}</Text>
                    <View style={styles.memberMeta}>
                      <MaterialIcons name="location-on" size={12} color={Colors.textTertiary} />
                      <Text style={styles.metaText}>{member.location}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <MaterialIcons name="access-time" size={12} color={Colors.textTertiary} />
                      <Text style={styles.metaText}>{member.lastSeen}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.memberActions}>
                  <View style={styles.batteryRow}>
                    <MaterialIcons name="battery-full" size={14} color={member.batteryLevel > 30 ? Colors.success : Colors.warning} />
                    <Text style={styles.batteryText}>{member.batteryLevel > 0 ? `${member.batteryLevel}%` : 'N/A'}</Text>
                  </View>
                  <Pressable style={styles.actionBtn} onPress={() => showAlert('Check In', `Sending check-in request to ${member.name}...`)}>
                    <MaterialIcons name="check-circle-outline" size={18} color={Colors.secondary} />
                    <Text style={styles.actionText}>Check In</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => handleRemove(member.id)}>
                    <MaterialIcons name="person-remove" size={18} color={Colors.danger} />
                    <Text style={[styles.actionText, { color: Colors.danger }]}>Remove</Text>
                  </Pressable>
                </View>
              </SafeCard>
            );
          })}

          {members.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="family-restroom" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>No family members yet</Text>
              <Text style={styles.emptyDesc}>Invite family members to your safety circle</Text>
              <SafeButton label="Invite Family Member" onPress={() => setModalVisible(true)} variant="primary" style={{ marginTop: Spacing.md }} />
            </View>
          ) : null}
        </View>

        {/* Features */}
        <SafeCard style={styles.featuresCard}>
          <Text style={styles.sectionTitle}>Safety Circle Features</Text>
          {[
            { icon: 'location-on' as const, label: 'Real-time Tracking', desc: 'See family location updates every 30 seconds' },
            { icon: 'notifications' as const, label: 'Arrival Alerts', desc: 'Get notified when members arrive at saved places' },
            { icon: 'place' as const, label: 'Geofence Zones', desc: 'Set safe zones like home, school, work' },
            { icon: 'battery-alert' as const, label: 'Battery Alerts', desc: 'Know when a member is running low on battery' },
          ].map(f => (
            <View key={f.label} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <MaterialIcons name={f.icon} size={20} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </SafeCard>
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalKav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Invite Family Member</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.modalContent}>
            <SafeInput label="Name" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Family member name" leftIcon="person" />
            <SafeInput label="Relationship" value={form.relation} onChangeText={v => setForm(f => ({ ...f, relation: v }))} placeholder="E.g., Spouse, Child" leftIcon="people" />
            <SafeInput label="Phone Number" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} placeholder="+1 555 0100" keyboardType="phone-pad" leftIcon="phone" />
            <SafeButton label="Send Invitation" onPress={handleAdd} fullWidth size="lg" style={{ marginTop: Spacing.xl }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: 32 },
  infoBanner: {},
  bannerRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md, alignItems: 'flex-start' },
  bannerTitle: { ...Typography.h4, color: Colors.text },
  bannerDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  statItem: { alignItems: 'center' },
  statVal: { ...Typography.h3, fontWeight: '700' },
  statLbl: { ...Typography.caption, color: Colors.textSecondary },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...Typography.h4, color: Colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.success,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
  },
  addBtnText: { ...Typography.buttonSmall, color: '#fff' },
  memberCard: {},
  memberRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  avatarContainer: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...Typography.h4, color: '#fff', fontWeight: '700' },
  statusDot: { position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: Colors.surface },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  memberName: { ...Typography.h4, color: Colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { ...Typography.caption, fontWeight: '600' },
  memberRelation: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  metaText: { ...Typography.caption, color: Colors.textTertiary },
  metaDot: { color: Colors.textTertiary },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  batteryText: { ...Typography.caption, color: Colors.textSecondary },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt },
  actionText: { ...Typography.buttonSmall, color: Colors.secondary },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: Spacing.sm },
  emptyTitle: { ...Typography.h4, color: Colors.text },
  emptyDesc: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center' },
  featuresCard: {},
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  featureIcon: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.successSurface, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { ...Typography.label, color: Colors.text, fontWeight: '600' },
  featureDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  modalKav: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  modalTitle: { ...Typography.h3, color: Colors.text },
  modalContent: { padding: Spacing.xl },
});
