import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { useMedical, MedicalProfile } from '@/hooks/useMedical';
import { useAuth } from '@/hooks/useAuth';
import { SafeInput } from '@/components/ui/SafeInput';
import { SafeButton } from '@/components/ui/SafeButton';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { BLOOD_GROUPS } from '@/services/mockData';

export default function MedicalScreen() {
  const insets = useSafeAreaInsets();
  const { medical, saveMedical } = useMedical();
  const { updateProfile } = useAuth();
  const { showAlert } = useAlert();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<MedicalProfile>({
    bloodGroup: '', conditions: '', allergies: '', medications: '',
    doctorName: '', doctorPhone: '', notes: '',
  });

  useEffect(() => {
    if (medical) setForm(medical);
  }, [medical]);

  const handleSave = async () => {
    setIsSaving(true);
    await saveMedical(form);
    await updateProfile({ profileComplete: true });
    setIsSaving(false);
    setIsEditing(false);
    showAlert('Saved', 'Medical profile updated successfully.');
  };

  const update = (key: keyof MedicalProfile, val: string) => setForm(f => ({ ...f, [key]: val }));

  if (!isEditing && medical) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Alert card */}
          <SafeCard variant="danger" style={styles.alertCard}>
            <View style={styles.alertRow}>
              <MaterialIcons name="emergency" size={20} color={Colors.danger} />
              <Text style={styles.alertTitle}>Emergency Medical Info</Text>
            </View>
            <Text style={styles.alertDesc}>This information will be sent to emergency contacts when SOS is triggered.</Text>
          </SafeCard>

          {/* Blood Group */}
          <View style={styles.bloodRow}>
            <View style={[styles.bloodCard, { backgroundColor: Colors.primary }]}>
              <Text style={styles.bloodLabel}>Blood Type</Text>
              <Text style={styles.bloodValue}>{form.bloodGroup || '?'}</Text>
            </View>
            <SafeCard style={styles.idCard}>
              <Text style={styles.fieldLabel}>Medical ID</Text>
              <Text style={styles.idValue}>MED-{Date.now().toString().slice(-6)}</Text>
            </SafeCard>
          </View>

          {[
            { label: 'Medical Conditions', value: form.conditions, icon: 'local-hospital' as const },
            { label: 'Allergies', value: form.allergies, icon: 'warning' as const, isRed: true },
            { label: 'Current Medications', value: form.medications, icon: 'medication' as const },
            { label: "Doctor's Name", value: form.doctorName, icon: 'person' as const },
            { label: "Doctor's Phone", value: form.doctorPhone, icon: 'phone' as const },
            { label: 'Additional Notes', value: form.notes, icon: 'notes' as const },
          ].map(f => (
            <SafeCard key={f.label} style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <MaterialIcons name={f.icon} size={18} color={f.isRed ? Colors.danger : Colors.secondary} />
                <Text style={styles.infoLabel}>{f.label}</Text>
              </View>
              <Text style={[styles.infoValue, !f.value && styles.infoEmpty]}>
                {f.value || 'Not provided'}
              </Text>
            </SafeCard>
          ))}

          <SafeButton label="Edit Medical Profile" onPress={() => setIsEditing(true)} variant="primary" fullWidth size="lg" />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <SafeCard variant="danger" style={styles.alertCard}>
          <View style={styles.alertRow}>
            <MaterialIcons name="info-outline" size={18} color={Colors.danger} />
            <Text style={styles.alertDesc}>Accurate medical info can save your life in emergencies</Text>
          </View>
        </SafeCard>

        <SafeCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Blood Group</Text>
          <View style={styles.bloodGrid}>
            {BLOOD_GROUPS.map(g => (
              <Pressable key={g} style={[styles.bloodOption, form.bloodGroup === g && styles.bloodOptionActive]}
                onPress={() => update('bloodGroup', g)}>
                <Text style={[styles.bloodOptionText, form.bloodGroup === g && styles.bloodOptionTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </SafeCard>

        <SafeCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Medical Conditions</Text>
          <SafeInput value={form.conditions} onChangeText={v => update('conditions', v)} placeholder="E.g., Diabetes, Hypertension" multiline numberOfLines={3} leftIcon="local-hospital" />
        </SafeCard>

        <SafeCard style={[styles.sectionCard, styles.allergiesCard]}>
          <Text style={[styles.sectionTitle, { color: Colors.danger }]}>Allergies ⚠️</Text>
          <SafeInput value={form.allergies} onChangeText={v => update('allergies', v)} placeholder="E.g., Penicillin, Peanuts, Latex" multiline numberOfLines={2} leftIcon="warning" />
        </SafeCard>

        <SafeCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Current Medications</Text>
          <SafeInput value={form.medications} onChangeText={v => update('medications', v)} placeholder="E.g., Metformin 500mg, Lisinopril 10mg" multiline numberOfLines={3} leftIcon="medication" />
        </SafeCard>

        <SafeCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Emergency Doctor Contact</Text>
          <SafeInput label="Doctor Name" value={form.doctorName} onChangeText={v => update('doctorName', v)} placeholder="Dr. Smith" leftIcon="person" />
          <SafeInput label="Doctor Phone" value={form.doctorPhone} onChangeText={v => update('doctorPhone', v)} placeholder="+1 555 0200" keyboardType="phone-pad" leftIcon="phone" />
        </SafeCard>

        <SafeCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <SafeInput value={form.notes} onChangeText={v => update('notes', v)} placeholder="Any other important medical information..." multiline numberOfLines={4} />
        </SafeCard>

        <SafeButton label="Save Medical Profile" onPress={handleSave} loading={isSaving} variant="primary" fullWidth size="lg" />
        {medical ? <SafeButton label="Cancel" onPress={() => setIsEditing(false)} variant="ghost" fullWidth style={{ marginTop: Spacing.sm }} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  kav: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.md },
  alertCard: {},
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  alertTitle: { ...Typography.label, color: Colors.danger, fontWeight: '700' },
  alertDesc: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },
  bloodRow: { flexDirection: 'row', gap: Spacing.md },
  bloodCard: { flex: 1, borderRadius: Radius.xl, padding: Spacing.base, alignItems: 'center', gap: 6 },
  bloodLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.8)' },
  bloodValue: { fontSize: 36, fontWeight: '800', color: '#fff' },
  idCard: { flex: 1, alignItems: 'center', gap: 6 },
  fieldLabel: { ...Typography.caption, color: Colors.textSecondary },
  idValue: { ...Typography.h4, color: Colors.text, fontWeight: '700' },
  infoCard: {},
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  infoLabel: { ...Typography.label, color: Colors.textSecondary, fontWeight: '600' },
  infoValue: { ...Typography.body, color: Colors.text },
  infoEmpty: { color: Colors.textTertiary, fontStyle: 'italic' },
  sectionCard: {},
  sectionTitle: { ...Typography.h4, color: Colors.text, marginBottom: Spacing.md },
  allergiesCard: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  bloodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  bloodOption: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
  },
  bloodOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  bloodOptionText: { ...Typography.bodySmall, color: Colors.textSecondary, fontWeight: '600' },
  bloodOptionTextActive: { color: Colors.primary },
});
