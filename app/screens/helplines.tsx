import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Linking, Alert, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { HELPLINES } from '@/services/mockData';

const CATEGORIES = ['all', 'emergency', 'medical', 'safety', 'health'];

export default function HelplinesScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = HELPLINES.filter(h =>
    (activeCategory === 'all' || h.category === activeCategory) &&
    (h.name.toLowerCase().includes(search.toLowerCase()) || h.number.includes(search))
  );

  const handleCall = (h: typeof HELPLINES[0]) => {
    showAlert(`Call ${h.name}?`, `This will dial ${h.number}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Call ${h.number}`, onPress: () => {
          Linking.openURL(`tel:${h.number}`).catch(() =>
            Alert.alert('Cannot Call', 'Phone calling is not available on this device')
          );
        }
      },
    ]);
  };

  const renderItem = ({ item }: { item: typeof HELPLINES[0] }) => (
    <SafeCard style={styles.helplineCard}>
      <View style={styles.cardRow}>
        <View style={[styles.helplineIcon, { backgroundColor: `${item.color}18` }]}>
          <MaterialIcons name={item.icon as any} size={28} color={item.color} />
        </View>
        <View style={styles.helplineInfo}>
          <Text style={styles.helplineName}>{item.name}</Text>
          <Text style={styles.helplineDesc}>{item.description}</Text>
          <View style={styles.helplineMeta}>
            <View style={styles.availBadge}>
              <View style={styles.availDot} />
              <Text style={styles.availText}>{item.available}</Text>
            </View>
          </View>
        </View>
      </View>
      <Pressable style={[styles.callBtn, { backgroundColor: item.color }]} onPress={() => handleCall(item)}>
        <MaterialIcons name="call" size={18} color="#fff" />
        <Text style={styles.callBtnText}>{item.number}</Text>
      </Pressable>
    </SafeCard>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search helplines..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? <Pressable onPress={() => setSearch('')}><MaterialIcons name="clear" size={18} color={Colors.textTertiary} /></Pressable> : null}
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.filterOuter}>
        <FlatList
          horizontal
          data={CATEGORIES}
          showsHorizontalScrollIndicator={false}
          keyExtractor={c => c}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <Pressable style={[styles.filterChip, activeCategory === item && styles.filterChipActive]} onPress={() => setActiveCategory(item)}>
              <Text style={[styles.filterText, activeCategory === item && styles.filterTextActive]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="phone-disabled" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No helplines found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchContainer: { padding: Spacing.base, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full, paddingHorizontal: Spacing.md, height: 44,
  },
  searchInput: { flex: 1, ...Typography.body, color: Colors.text },
  filterOuter: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterContent: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
  },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  filterText: { ...Typography.buttonSmall, color: Colors.textSecondary },
  filterTextActive: { color: Colors.primary },
  list: { padding: Spacing.base, gap: Spacing.md, paddingBottom: 32 },
  helplineCard: {},
  cardRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  helplineIcon: { width: 56, height: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  helplineInfo: { flex: 1 },
  helplineName: { ...Typography.h4, color: Colors.text },
  helplineDesc: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3 },
  helplineMeta: { flexDirection: 'row', marginTop: Spacing.sm },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successSurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  availText: { ...Typography.caption, color: Colors.success, fontWeight: '600' },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.lg },
  callBtnText: { ...Typography.button, color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 64, gap: Spacing.md },
  emptyText: { ...Typography.bodySmall, color: Colors.textSecondary },
});
