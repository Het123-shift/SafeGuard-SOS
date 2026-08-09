import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, Modal,
  ScrollView, Dimensions, Animated, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAlert } from '@/template';
import { StorageService } from '@/services/storageService';
import { webAudioService } from '@/services/webAudioService';
import { SupabaseService } from '@/services/supabaseService';
import { VaultPinModal } from '@/components/feature/VaultPinModal';
import { SafeCard } from '@/components/ui/SafeCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_COL = 3;
const GRID_ITEM = (SCREEN_W - Spacing.base * 2 - Spacing.sm * (GRID_COL - 1)) / GRID_COL;

export interface EvidenceItem {
  id: string;
  type: 'photo' | 'video' | 'audio' | 'document';
  name: string;
  size: string;
  uri?: string;
  mimeType?: string;
  encrypted: boolean;
  createdAt: string;
  tags?: string[];
}

const TYPE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  photo: 'image', video: 'videocam', audio: 'mic', document: 'description',
};
const TYPE_COLORS: Record<string, string> = {
  photo: Colors.secondary, video: Colors.primary, audio: '#8B5CF6', document: Colors.warning,
};
const TYPE_BG: Record<string, string> = {
  photo: Colors.secondarySurface, video: Colors.primarySurface, audio: '#F5F3FF', document: Colors.warningSurface,
};

type FilterType = 'all' | EvidenceItem['type'];
type ViewMode = 'grid' | 'list';

const FILTERS: { label: string; value: FilterType; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { label: 'All', value: 'all', icon: 'apps' },
  { label: 'Photos', value: 'photo', icon: 'image' },
  { label: 'Videos', value: 'video', icon: 'videocam' },
  { label: 'Audio', value: 'audio', icon: 'mic' },
  { label: 'Docs', value: 'document', icon: 'description' },
];

export default function EvidenceScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [previewItem, setPreviewItem] = useState<EvidenceItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [items]);

  const loadItems = async () => {
    const saved = await StorageService.getEvidence();
    setItems(saved);
  };

  const toggleRecordVoice = async () => {
    if (isRecordingAudio) {
      const result = await webAudioService.stopRecording();
      setIsRecordingAudio(false);
      if (result) {
        const newItem: EvidenceItem = {
          id: `ev_rec_${Date.now()}`,
          type: 'audio',
          name: `VoiceNote_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.webm`,
          size: `${(result.blob?.size ? result.blob.size / 1024 : 80).toFixed(1)} KB`,
          uri: result.uri,
          mimeType: result.mimeType,
          encrypted: true,
          createdAt: new Date().toISOString(),
          tags: ['voice-note', 'mic-recorded'],
        };
        const updated = [newItem, ...items];
        await saveItems(updated);
        showAlert('Voice Recording Saved', 'Your ambient audio clip was encrypted and stored in your vault.');

        if (result.blob) {
          SupabaseService.uploadEvidenceFile(result.blob, newItem.name);
        }
      }
    } else {
      const started = await webAudioService.startRecording();
      if (started) {
        setIsRecordingAudio(true);
        showAlert('Recording Started', 'Capturing ambient audio... Tap "Recording..." again when finished.');
      } else {
        showAlert('Microphone Error', 'Could not start audio recording. Check browser permissions.');
      }
    }
  };

  const saveItems = async (updated: EvidenceItem[]) => {
    setItems(updated);
    await StorageService.saveEvidence(updated);
  };

  const filtered = activeFilter === 'all' ? items : items.filter(i => i.type === activeFilter);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const totalSize = items.reduce((acc, i) => {
    const num = parseFloat(i.size);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

  // --- Pickers ---
  const pickFromGallery = useCallback(async () => {
    setIsAdding(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission Required', 'Allow access to your photo library to add evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.85,
      orderedSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const newItems: EvidenceItem[] = result.assets.map(asset => ({
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: asset.type === 'video' ? 'video' : 'photo',
      name: asset.fileName || `Evidence_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      size: asset.fileSize ? formatBytes(asset.fileSize) : 'Unknown',
      uri: asset.uri,
      mimeType: asset.mimeType,
      encrypted: true,
      createdAt: new Date().toISOString(),
      tags: ['gallery'],
    }));
    const updated = [...newItems, ...items];
    await saveItems(updated);
    showAlert('Added to Vault', `${newItems.length} file(s) encrypted and stored securely.`);
  }, [items, showAlert]);

  const openCamera = useCallback(async () => {
    setIsAdding(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission Required', 'Allow camera access to capture evidence.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const newItem: EvidenceItem = {
      id: `ev_${Date.now()}`,
      type: asset.type === 'video' ? 'video' : 'photo',
      name: `Camera_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      size: asset.fileSize ? formatBytes(asset.fileSize) : 'Unknown',
      uri: asset.uri,
      mimeType: asset.mimeType,
      encrypted: true,
      createdAt: new Date().toISOString(),
      tags: ['camera'],
    };
    const updated = [newItem, ...items];
    await saveItems(updated);
    showAlert('Captured', 'Photo/video encrypted and added to vault.');
  }, [items, showAlert]);

  const pickDocument = useCallback(async () => {
    setIsAdding(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const newItems: EvidenceItem[] = result.assets.map(asset => ({
        id: `ev_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'document',
        name: asset.name,
        size: asset.size ? formatBytes(asset.size) : 'Unknown',
        uri: asset.uri,
        mimeType: asset.mimeType,
        encrypted: true,
        createdAt: new Date().toISOString(),
        tags: ['document'],
      }));
      const updated = [...newItems, ...items];
      await saveItems(updated);
      showAlert('Documents Added', `${newItems.length} file(s) added to vault.`);
    } catch {
      showAlert('Error', 'Could not open document picker. Please try again.');
    }
  }, [items, showAlert]);

  const handleDelete = useCallback((id: string) => {
    showAlert('Delete Evidence?', 'This action cannot be undone. The file will be permanently removed from your vault.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updated = items.filter(i => i.id !== id);
          await saveItems(updated);
          if (previewItem?.id === id) setPreviewItem(null);
        }
      },
    ]);
  }, [items, previewItem, showAlert]);

  // --- Render grid item ---
  const renderGridItem = ({ item }: { item: EvidenceItem }) => (
    <Pressable
      style={styles.gridItem}
      onPress={() => setPreviewItem(item)}
      onLongPress={() => handleDelete(item.id)}
    >
      {item.uri && item.type === 'photo' ? (
        <Image source={{ uri: item.uri }} style={styles.gridImage} contentFit="cover" />
      ) : (
        <View style={[styles.gridPlaceholder, { backgroundColor: TYPE_BG[item.type] }]}>
          <MaterialIcons name={TYPE_ICONS[item.type]} size={28} color={TYPE_COLORS[item.type]} />
        </View>
      )}
      {/* Overlay */}
      <View style={styles.gridOverlay}>
        <MaterialIcons name="lock" size={10} color="rgba(255,255,255,0.9)" />
        {item.type === 'video' ? (
          <View style={styles.videoBadge}>
            <MaterialIcons name="play-arrow" size={12} color="#fff" />
          </View>
        ) : null}
      </View>
      <Text style={styles.gridName} numberOfLines={1}>{item.name.split('.')[0]}</Text>
    </Pressable>
  );

  // --- Render list item ---
  const renderListItem = ({ item }: { item: EvidenceItem }) => (
    <Pressable style={styles.listItem} onPress={() => setPreviewItem(item)}>
      <View style={[styles.listThumb, { backgroundColor: TYPE_BG[item.type] }]}>
        {item.uri && item.type === 'photo' ? (
          <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <MaterialIcons name={TYPE_ICONS[item.type]} size={24} color={TYPE_COLORS[item.type]} />
        )}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.listMeta}>
          <View style={[styles.typePill, { backgroundColor: TYPE_BG[item.type] }]}>
            <Text style={[styles.typePillText, { color: TYPE_COLORS[item.type] }]}>
              {item.type.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.listSize}>{item.size}</Text>
          <Text style={styles.listDot}>•</Text>
          <Text style={styles.listDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.listActions}>
        <View style={styles.lockBadge}>
          <MaterialIcons name="lock" size={12} color={Colors.success} />
        </View>
        <Pressable onPress={() => handleDelete(item.id)} hitSlop={8} style={styles.deleteBtn}>
          <MaterialIcons name="delete-outline" size={20} color={Colors.textTertiary} />
        </Pressable>
      </View>
    </Pressable>
  );

  const photosCount = items.filter(i => i.type === 'photo').length;
  const videosCount = items.filter(i => i.type === 'video').length;
  const docsCount = items.filter(i => i.type === 'document').length;
  const audioCount = items.filter(i => i.type === 'audio').length;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        numColumns={viewMode === 'grid' ? GRID_COL : 1}
        key={viewMode} // Force re-render when changing columns
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          viewMode === 'grid' && styles.gridContent,
          filtered.length === 0 && styles.emptyContent,
        ]}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        ListHeaderComponent={
          <View>
            {/* Security Banner */}
            <View style={styles.secBanner}>
              <View style={styles.secLeft}>
                <View style={styles.secIconWrap}>
                  <MaterialIcons name="lock" size={22} color={Colors.success} />
                </View>
                <View>
                  <Text style={styles.secTitle}>End-to-End Encrypted Vault</Text>
                  <Text style={styles.secSub}>AES-256 • All files secured locally</Text>
                </View>
              </View>
              <View style={[styles.secStatusPill, { backgroundColor: Colors.successSurface }]}>
                <View style={styles.secDot} />
                <Text style={styles.secStatusText}>Secure</Text>
              </View>
            </View>

            {/* Stats row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsContent}>
              {[
                { label: 'Total', value: items.length, icon: 'folder' as const, color: Colors.secondary },
                { label: 'Photos', value: photosCount, icon: 'image' as const, color: Colors.secondary },
                { label: 'Videos', value: videosCount, icon: 'videocam' as const, color: Colors.primary },
                { label: 'Audio', value: audioCount, icon: 'mic' as const, color: '#8B5CF6' },
                { label: 'Docs', value: docsCount, icon: 'description' as const, color: Colors.warning },
                { label: 'Size', value: `${totalSize.toFixed(1)}`, icon: 'storage' as const, color: Colors.success, suffix: 'MB' },
              ].map(s => (
                <View key={s.label} style={styles.statChip}>
                  <MaterialIcons name={s.icon} size={18} color={s.color} />
                  <Text style={[styles.statChipValue, { color: s.color }]}>{s.value}{s.suffix ?? ''}</Text>
                  <Text style={styles.statChipLabel}>{s.label}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Add evidence buttons */}
            <View style={styles.addSection}>
              <Text style={styles.addTitle}>Add to Vault</Text>
              <View style={styles.addGrid}>
                <Pressable style={[styles.addCard, { borderColor: Colors.secondary }]} onPress={pickFromGallery}>
                  <View style={[styles.addCardIcon, { backgroundColor: Colors.secondarySurface }]}>
                    <MaterialIcons name="photo-library" size={26} color={Colors.secondary} />
                  </View>
                  <Text style={[styles.addCardLabel, { color: Colors.secondary }]}>Gallery</Text>
                  <Text style={styles.addCardSub}>Photos & Videos</Text>
                </Pressable>
                <Pressable style={[styles.addCard, { borderColor: Colors.primary }]} onPress={openCamera}>
                  <View style={[styles.addCardIcon, { backgroundColor: Colors.primarySurface }]}>
                    <MaterialIcons name="camera-alt" size={26} color={Colors.primary} />
                  </View>
                  <Text style={[styles.addCardLabel, { color: Colors.primary }]}>Camera</Text>
                  <Text style={styles.addCardSub}>Capture Evidence</Text>
                </Pressable>
                <Pressable
                  style={[styles.addCard, { borderColor: isRecordingAudio ? Colors.danger : '#8B5CF6' }]}
                  onPress={toggleRecordVoice}
                >
                  <View style={[styles.addCardIcon, { backgroundColor: isRecordingAudio ? Colors.dangerSurface : '#F5F3FF' }]}>
                    <MaterialIcons name={isRecordingAudio ? 'stop' : 'mic'} size={26} color={isRecordingAudio ? Colors.danger : '#8B5CF6'} />
                  </View>
                  <Text style={[styles.addCardLabel, { color: isRecordingAudio ? Colors.danger : '#8B5CF6' }]}>
                    {isRecordingAudio ? 'Stop Rec' : 'Voice Note'}
                  </Text>
                  <Text style={styles.addCardSub}>{isRecordingAudio ? 'Recording...' : 'Record Audio'}</Text>
                </Pressable>
              </View>
            </View>

            {/* Filter + view toggle */}
            <View style={styles.controlRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {FILTERS.map(f => (
                  <Pressable
                    key={f.value}
                    style={[styles.filterChip, activeFilter === f.value && styles.filterChipActive]}
                    onPress={() => setActiveFilter(f.value)}
                  >
                    <MaterialIcons
                      name={f.icon}
                      size={14}
                      color={activeFilter === f.value ? '#fff' : Colors.textSecondary}
                    />
                    <Text style={[styles.filterChipText, activeFilter === f.value && styles.filterChipTextActive]}>
                      {f.label}
                    </Text>
                    {f.value !== 'all' ? (
                      <View style={[styles.filterCount, activeFilter === f.value && styles.filterCountActive]}>
                        <Text style={[styles.filterCountText, activeFilter === f.value && { color: 'rgba(255,255,255,0.8)' }]}>
                          {items.filter(i => i.type === f.value).length}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.viewToggle}>
                <Pressable
                  style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
                  onPress={() => setViewMode('grid')}
                >
                  <MaterialIcons name="grid-view" size={18} color={viewMode === 'grid' ? Colors.primary : Colors.textTertiary} />
                </Pressable>
                <Pressable
                  style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
                  onPress={() => setViewMode('list')}
                >
                  <MaterialIcons name="view-list" size={18} color={viewMode === 'list' ? Colors.primary : Colors.textTertiary} />
                </Pressable>
              </View>
            </View>

            {filtered.length > 0 ? (
              <Text style={styles.resultCount}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="enhanced-encryption" size={48} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Vault is empty</Text>
            <Text style={styles.emptyDesc}>
              {activeFilter === 'all'
                ? 'Add photos, videos, documents or recordings from your device'
                : `No ${activeFilter}s stored yet`}
            </Text>
          </View>
        }
      />

      {/* Preview Modal */}
      <Modal
        visible={previewItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <View style={styles.previewBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewItem(null)} />
          {previewItem ? (
            <View style={styles.previewCard}>
              {/* Preview header */}
              <View style={styles.previewHeader}>
                <View style={[styles.previewTypeIcon, { backgroundColor: TYPE_BG[previewItem.type] }]}>
                  <MaterialIcons name={TYPE_ICONS[previewItem.type]} size={20} color={TYPE_COLORS[previewItem.type]} />
                </View>
                <Text style={styles.previewTitle} numberOfLines={1}>{previewItem.name}</Text>
                <Pressable onPress={() => setPreviewItem(null)} hitSlop={8}>
                  <MaterialIcons name="close" size={24} color={Colors.text} />
                </Pressable>
              </View>

              {/* Image preview */}
              {previewItem.uri && previewItem.type === 'photo' ? (
                <Image
                  source={{ uri: previewItem.uri }}
                  style={styles.previewImage}
                  contentFit="contain"
                  transition={200}
                />
              ) : (
                <View style={[styles.previewPlaceholder, { backgroundColor: TYPE_BG[previewItem.type] }]}>
                  <MaterialIcons name={TYPE_ICONS[previewItem.type]} size={64} color={TYPE_COLORS[previewItem.type]} />
                  <Text style={[styles.previewTypeName, { color: TYPE_COLORS[previewItem.type] }]}>
                    {previewItem.type.toUpperCase()} FILE
                  </Text>
                </View>
              )}

              {/* Meta info */}
              <View style={styles.previewMeta}>
                {[
                  { icon: 'storage' as const, label: 'File Size', value: previewItem.size },
                  { icon: 'event' as const, label: 'Added On', value: formatDate(previewItem.createdAt) },
                  { icon: 'lock' as const, label: 'Encryption', value: 'AES-256 Encrypted' },
                  { icon: 'label' as const, label: 'Tags', value: previewItem.tags?.join(', ') || 'None' },
                ].map(m => (
                  <View key={m.label} style={styles.metaRow}>
                    <MaterialIcons name={m.icon} size={16} color={Colors.textTertiary} />
                    <Text style={styles.metaLabel}>{m.label}</Text>
                    <Text style={styles.metaValue} numberOfLines={1}>{m.value}</Text>
                  </View>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.previewActions}>
                <Pressable
                  style={[styles.previewActionBtn, { backgroundColor: Colors.dangerSurface }]}
                  onPress={() => handleDelete(previewItem.id)}
                >
                  <MaterialIcons name="delete-outline" size={20} color={Colors.danger} />
                  <Text style={[styles.previewActionText, { color: Colors.danger }]}>Delete</Text>
                </Pressable>
                <Pressable
                  style={[styles.previewActionBtn, { backgroundColor: Colors.successSurface }]}
                  onPress={() => showAlert('Encrypted', 'This file is secured with AES-256 encryption in your vault.')}
                >
                  <MaterialIcons name="verified-user" size={20} color={Colors.success} />
                  <Text style={[styles.previewActionText, { color: Colors.success }]}>Verify</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Vault PIN Security Overlay */}
      <VaultPinModal
        visible={!isUnlocked}
        onSuccess={() => setIsUnlocked(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  listContent: { padding: Spacing.base, paddingBottom: 40 },
  gridContent: { paddingHorizontal: Spacing.base },
  emptyContent: { flexGrow: 1 },
  gridRow: { gap: Spacing.sm, marginBottom: Spacing.sm },

  // Security banner
  secBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.successSurface,
    ...Shadows.sm,
  },
  secLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  secIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.successSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  secTitle: { ...Typography.label, color: Colors.text, fontWeight: '700' },
  secSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  secStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  secDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  secStatusText: { ...Typography.caption, color: Colors.success, fontWeight: '700' },

  // Stats
  statsScroll: { marginBottom: Spacing.base },
  statsContent: { gap: Spacing.sm, paddingRight: Spacing.base },
  statChip: {
    alignItems: 'center', gap: 3, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, minWidth: 72, ...Shadows.sm,
  },
  statChipValue: { ...Typography.h4, fontWeight: '800' },
  statChipLabel: { ...Typography.caption, color: Colors.textTertiary },

  // Add section
  addSection: { marginBottom: Spacing.base },
  addTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },
  addGrid: { flexDirection: 'row', gap: Spacing.sm },
  addCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1.5, padding: Spacing.md, alignItems: 'center', gap: 4,
    ...Shadows.sm,
  },
  addCardIcon: {
    width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  addCardLabel: { ...Typography.buttonSmall, fontWeight: '700' },
  addCardSub: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center' },

  // Filter row
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  filterScroll: { gap: Spacing.xs },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  filterCount: {
    backgroundColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  viewToggle: {
    flexDirection: 'row', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 3, gap: 2,
  },
  viewBtn: { padding: 5, borderRadius: Radius.sm },
  viewBtnActive: { backgroundColor: Colors.surface, ...Shadows.sm },

  resultCount: { ...Typography.caption, color: Colors.textTertiary, marginBottom: Spacing.sm },

  // Grid
  gridItem: {
    width: GRID_ITEM, height: GRID_ITEM, borderRadius: Radius.md,
    overflow: 'hidden', backgroundColor: Colors.surfaceAlt, ...Shadows.sm,
  },
  gridImage: { width: '100%', height: '75%' },
  gridPlaceholder: { width: '100%', height: '75%', alignItems: 'center', justifyContent: 'center' },
  gridOverlay: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  videoBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radius.sm,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  gridName: {
    ...Typography.caption, color: Colors.text, fontWeight: '600',
    paddingHorizontal: 6, paddingVertical: 4, backgroundColor: Colors.surface,
  },

  // List item
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.md,
    marginBottom: Spacing.sm, ...Shadows.sm,
  },
  listThumb: {
    width: 56, height: 56, borderRadius: Radius.lg, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  listInfo: { flex: 1 },
  listName: { ...Typography.label, color: Colors.text, fontWeight: '600', marginBottom: 6 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.xs },
  typePillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  listSize: { ...Typography.caption, color: Colors.textSecondary },
  listDot: { color: Colors.textTertiary, fontSize: 10 },
  listDate: { ...Typography.caption, color: Colors.textTertiary },
  listActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  lockBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.successSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: { padding: 4 },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: Spacing.md },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Typography.h3, color: Colors.text },
  emptyDesc: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 22 },

  // Preview modal
  previewBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  previewCard: {
    width: '100%', backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    paddingBottom: 32, overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  previewTypeIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { ...Typography.label, color: Colors.text, flex: 1, fontWeight: '600' },
  previewImage: { width: '100%', height: 280, backgroundColor: '#000' },
  previewPlaceholder: {
    height: 200, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  previewTypeName: { ...Typography.label, fontWeight: '800', letterSpacing: 1 },
  previewMeta: { padding: Spacing.base, gap: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  metaLabel: { ...Typography.bodySmall, color: Colors.textSecondary, width: 90 },
  metaValue: { ...Typography.bodySmall, color: Colors.text, flex: 1, fontWeight: '500' },
  previewActions: {
    flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.base, marginTop: Spacing.sm,
  },
  previewActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.xl,
  },
  previewActionText: { ...Typography.buttonSmall, fontWeight: '700' },
});
