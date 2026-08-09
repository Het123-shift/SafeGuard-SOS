import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TrustedContact } from '@/contexts/ContactsContext';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

interface ContactCardProps {
  contact: TrustedContact;
  onEdit: (contact: TrustedContact) => void;
  onDelete: (id: string) => void;
  onSetPriority: (id: string) => void;
}

const RELATION_COLORS: Record<string, string> = {
  Parent: '#8B5CF6', Spouse: '#EC4899', Sibling: '#3B82F6',
  Friend: '#22C55E', Guardian: '#F97316', Child: '#06B6D4', Other: '#6B7280',
};

export const ContactCard = React.memo(function ContactCard({ contact, onEdit, onDelete, onSetPriority }: ContactCardProps) {
  const initials = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const color = RELATION_COLORS[contact.relationship] || Colors.secondary;

  const handleCall = useCallback(() => {
    Linking.openURL(`tel:${contact.phone}`).catch(() =>
      Alert.alert('Cannot Call', 'Phone calling is not available on this device')
    );
  }, [contact.phone]);

  const handleDelete = useCallback(() => {
    Alert.alert('Remove Contact', `Remove ${contact.name} from trusted contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(contact.id) },
    ]);
  }, [contact, onDelete]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.initials}>{initials}</Text>
          {contact.isPriority ? (
            <View style={styles.priorityBadge}>
              <MaterialIcons name="star" size={10} color="#fff" />
            </View>
          ) : null}
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{contact.name}</Text>
            {contact.isPriority ? <View style={styles.priorityTag}><Text style={styles.priorityText}>Priority</Text></View> : null}
          </View>
          <Text style={styles.relation}>{contact.relationship}</Text>
          <Text style={styles.phone}>{contact.phone}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, { backgroundColor: Colors.successSurface }]} onPress={handleCall}>
          <MaterialIcons name="call" size={18} color={Colors.success} />
          <Text style={[styles.actionText, { color: Colors.success }]}>Call</Text>
        </Pressable>
        {!contact.isPriority ? (
          <Pressable style={[styles.actionBtn, { backgroundColor: '#FEF9C3' }]} onPress={() => onSetPriority(contact.id)}>
            <MaterialIcons name="star-outline" size={18} color="#CA8A04" />
            <Text style={[styles.actionText, { color: '#CA8A04' }]}>Priority</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.actionBtn, { backgroundColor: Colors.secondarySurface }]} onPress={() => onEdit(contact)}>
          <MaterialIcons name="edit" size={18} color={Colors.secondary} />
          <Text style={[styles.actionText, { color: Colors.secondary }]}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { backgroundColor: Colors.dangerSurface }]} onPress={handleDelete}>
          <MaterialIcons name="delete-outline" size={18} color={Colors.danger} />
          <Text style={[styles.actionText, { color: Colors.danger }]}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initials: { ...Typography.h3, color: '#fff', fontWeight: '700' },
  priorityBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: '#F59E0B', width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  info: { flex: 1, marginLeft: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { ...Typography.h4, color: Colors.text },
  priorityTag: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  priorityText: { ...Typography.caption, color: '#92400E', fontWeight: '600' },
  relation: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  phone: { ...Typography.bodySmall, color: Colors.primary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  actionText: { ...Typography.buttonSmall },
});
