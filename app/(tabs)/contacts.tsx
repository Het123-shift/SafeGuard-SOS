import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import { useContacts } from '@/hooks/useContacts';
import { ContactCard } from '@/components/feature/ContactCard';
import { SafeButton } from '@/components/ui/SafeButton';
import { SafeInput } from '@/components/ui/SafeInput';
import { TrustedContact } from '@/contexts/ContactsContext';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { RELATIONSHIPS } from '@/services/mockData';

const EMPTY_FORM = { name: '', relationship: 'Friend', phone: '', email: '', isPriority: false, avatar: '' };

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const { contacts, addContact, updateContact, removeContact, setPriority, isLoading } = useContacts();
  const { showAlert } = useAlert();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<TrustedContact | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.relationship.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    if (contacts.length >= 5) {
      showAlert('Limit Reached', 'You can add a maximum of 5 trusted contacts.');
      return;
    }
    setEditingContact(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalVisible(true);
  };

  const openEdit = (contact: TrustedContact) => {
    setEditingContact(contact);
    setForm({ name: contact.name, relationship: contact.relationship, phone: contact.phone, email: contact.email, isPriority: contact.isPriority, avatar: '' });
    setErrors({});
    setModalVisible(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    if (editingContact) {
      await updateContact(editingContact.id, form);
    } else {
      await addContact(form);
    }
    setModalVisible(false);
  }, [form, editingContact, addContact, updateContact]);

  const update = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Trusted Contacts</Text>
          <Text style={styles.headerSub}>{contacts.length}/5 contacts</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <MaterialIcons name="person-add" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <Pressable onPress={() => setSearch('')}><MaterialIcons name="clear" size={18} color={Colors.textTertiary} /></Pressable> : null}
        </View>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <MaterialIcons name="info-outline" size={16} color={Colors.secondary} />
        <Text style={styles.infoText}>These contacts will be notified during an SOS emergency</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredContacts.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="people-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyTitle}>{search ? 'No contacts found' : 'No trusted contacts yet'}</Text>
            <Text style={styles.emptyDesc}>{search ? 'Try a different search term' : 'Add at least one trusted contact to enable SOS alerts'}</Text>
            {!search ? <SafeButton label="Add First Contact" onPress={openAdd} variant="primary" style={{ marginTop: Spacing.xl }} /> : null}
          </View>
        ) : (
          filteredContacts.map(c => (
            <ContactCard key={c.id} contact={c} onEdit={openEdit} onDelete={removeContact} onSetPriority={setPriority} />
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalKav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>{editingContact ? 'Edit Contact' : 'Add Contact'}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <SafeInput label="Full Name *" value={form.name} onChangeText={v => update('name', v)} placeholder="Contact name" leftIcon="person" error={errors.name} />
            <SafeInput label="Phone Number *" value={form.phone} onChangeText={v => update('phone', v)} placeholder="+1 555 0100" keyboardType="phone-pad" leftIcon="phone" error={errors.phone} />
            <SafeInput label="Email (Optional)" value={form.email} onChangeText={v => update('email', v)} placeholder="contact@email.com" keyboardType="email-address" autoCapitalize="none" leftIcon="email" error={errors.email} />
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Relationship</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relScroll}>
                {RELATIONSHIPS.map(r => (
                  <Pressable key={r} style={[styles.relChip, form.relationship === r && styles.relChipActive]} onPress={() => update('relationship', r)}>
                    <Text style={[styles.relText, form.relationship === r && styles.relTextActive]}>{r}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <SafeButton label={editingContact ? 'Save Changes' : 'Add Contact'} onPress={handleSave} fullWidth size="lg" style={{ marginTop: Spacing.xl }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.base,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h3, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  searchRow: { padding: Spacing.base, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full, paddingHorizontal: Spacing.md, height: 44,
  },
  searchInput: { flex: 1, ...Typography.body, color: Colors.text },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.secondarySurface, padding: Spacing.md, marginHorizontal: Spacing.base, marginTop: Spacing.base, borderRadius: Radius.md,
  },
  infoText: { ...Typography.caption, color: Colors.secondary, flex: 1 },
  list: { flex: 1 },
  listContent: { padding: Spacing.base, paddingTop: Spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: 64, gap: Spacing.md },
  emptyTitle: { ...Typography.h3, color: Colors.text, textAlign: 'center' },
  emptyDesc: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', maxWidth: 280 },
  modalKav: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle: { ...Typography.h3, color: Colors.text },
  modalContent: { padding: Spacing.xl },
  fieldSection: { marginBottom: Spacing.base },
  fieldLabel: { ...Typography.label, color: Colors.text, marginBottom: Spacing.sm },
  relScroll: { marginHorizontal: -4 },
  relChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginHorizontal: 4,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
  },
  relChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  relText: { ...Typography.bodySmall, color: Colors.textSecondary },
  relTextActive: { color: Colors.primary, fontWeight: '600' },
});
