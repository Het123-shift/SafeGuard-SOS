import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import { useAlert } from '@/template';
import { useContacts } from '@/hooks/useContacts';
import { SafeCard } from '@/components/ui/SafeCard';
import { SafeButton } from '@/components/ui/SafeButton';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

type Duration = 15 | 30 | 60 | 0;
type ViewMode = 'my-location' | 'recipient-view';

const DURATIONS: { label: string; value: Duration }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: 'Until stopped', value: 0 },
];

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
}

export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const { contacts } = useContacts();
  const { showAlert } = useAlert();

  const [myLocation, setMyLocation] = useState<LocationCoords | null>(null);
  const [locationAddress, setLocationAddress] = useState('Locating...');
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [isLocating, setIsLocating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<Duration>(30);
  const [sharingTime, setSharingTime] = useState(0);
  const [battery] = useState(72);
  const [viewMode, setViewMode] = useState<ViewMode>('my-location');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { requestLocation(); }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSharing) {
      interval = setInterval(() => setSharingTime(t => t + 1), 1000);
    } else { setSharingTime(0); }
    return () => clearInterval(interval);
  }, [isSharing]);

  useEffect(() => {
    if (isSharing && selectedDuration > 0 && sharingTime >= selectedDuration * 60) {
      setIsSharing(false);
      showAlert('Location Sharing Ended', `Your ${selectedDuration}-minute session has ended.`);
    }
  }, [sharingTime, selectedDuration, isSharing]);

  useEffect(() => {
    if (isSharing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isSharing]);

  useEffect(() => {
    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setMyLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
          });
          setLocationPermission('granted');
          setLocationAddress(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (Live GPS)`);
        },
        (err) => console.warn('Geolocation watch error:', err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }
    return () => {
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const requestLocation = async () => {
    setIsLocating(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setMyLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed,
            });
            setLocationPermission('granted');
            setLocationAddress(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (Live GPS)`);
            setIsLocating(false);
          },
          () => {
            setLocationPermission('denied');
            setLocationAddress('Location access denied');
            setIsLocating(false);
          },
          { enableHighAccuracy: true }
        );
      } else {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermission('denied');
          setLocationAddress('Location access denied');
          setIsLocating(false);
          return;
        }
        setLocationPermission('granted');
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High });
        setMyLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
        });
        setIsLocating(false);
      }
    } catch {
      setLocationAddress('Could not get location');
      setIsLocating(false);
    }
  };

  const handleToggleSharing = useCallback(() => {
    if (!isSharing) {
      if (contacts.length === 0) { showAlert('No Contacts', 'Add at least one trusted contact to share your location.'); return; }
      if (!myLocation) { showAlert('No Location', 'Enable location access first to share your position.'); return; }
      setIsSharing(true);
      showAlert('Location Sharing Started', `Your live location is now being shared with ${contacts.length} contact(s) for ${selectedDuration === 0 ? 'unlimited time' : `${selectedDuration} minutes`}.`);
    } else {
      setIsSharing(false);
      setViewMode('my-location');
    }
  }, [isSharing, contacts, myLocation, selectedDuration]);

  const openInMaps = () => {
    if (!myLocation) return;
    const url = `https://www.google.com/maps?q=${myLocation.latitude},${myLocation.longitude}`;
    Linking.openURL(url);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const remaining = selectedDuration > 0 ? Math.max(0, selectedDuration * 60 - sharingTime) : null;
  const progress = selectedDuration > 0 ? Math.min((sharingTime / (selectedDuration * 60)) * 100, 100) : 0;
  const speedKmh = myLocation?.speed != null && myLocation.speed > 0 ? Math.round(myLocation.speed * 3.6) : 0;

  // Simulated grid squares for the map placeholder
  const mapGridCols = 8;
  const mapGridRows = 5;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MaterialIcons name="location-on" size={24} color={Colors.secondary} />
        <Text style={styles.headerTitle}>Live Location</Text>
        <View style={[styles.statusBadge, { backgroundColor: isSharing ? Colors.successSurface : Colors.surfaceAlt }]}>
          <Animated.View style={[styles.statusDot, {
            backgroundColor: isSharing ? Colors.success : Colors.textTertiary,
            transform: isSharing ? [{ scale: pulseAnim }] : [],
          }]} />
          <Text style={[styles.statusText, { color: isSharing ? Colors.success : Colors.textSecondary }]}>
            {isSharing ? 'Sharing Live' : 'Offline'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* View Toggle (when sharing) */}
        {isSharing ? (
          <View style={styles.viewToggle}>
            {(['my-location', 'recipient-view'] as const).map(mode => (
              <Pressable
                key={mode}
                style={[styles.toggleBtn, viewMode === mode && styles.toggleBtnActive]}
                onPress={() => setViewMode(mode)}
              >
                <MaterialIcons name={mode === 'my-location' ? 'my-location' : 'people'} size={16} color={viewMode === mode ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>
                  {mode === 'my-location' ? 'My Location' : 'Recipient View'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Map Placeholder */}
        <View style={styles.mapCard}>
          {/* Grid background */}
          <View style={styles.mapGrid}>
            {Array.from({ length: mapGridRows }).map((_, row) => (
              <View key={row} style={styles.mapGridRow}>
                {Array.from({ length: mapGridCols }).map((_, col) => (
                  <View
                    key={col}
                    style={[
                      styles.mapGridCell,
                      (row + col) % 3 === 0 && { backgroundColor: 'rgba(59,130,246,0.04)' },
                      (row + col) % 5 === 0 && { backgroundColor: 'rgba(59,130,246,0.08)' },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>

          {/* Road-like lines */}
          <View style={styles.mapRoadH} />
          <View style={styles.mapRoadV} />
          <View style={[styles.mapRoadH, { top: '70%', opacity: 0.4 }]} />
          <View style={[styles.mapRoadV, { left: '25%', opacity: 0.4 }]} />

          {/* Location marker */}
          {(myLocation || locationPermission === 'pending') ? (
            <View style={styles.mapCenter}>
              {isSharing ? (
                <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
              ) : null}
              <View style={[styles.mapMarker, { borderColor: isSharing ? Colors.success : Colors.secondary }]}>
                <View style={[styles.mapMarkerDot, { backgroundColor: isSharing ? Colors.success : Colors.secondary }]} />
              </View>
              <View style={[styles.markerTail, { borderTopColor: isSharing ? Colors.success : Colors.secondary }]} />
            </View>
          ) : null}

          {/* Address overlay */}
          <View style={styles.addressBar}>
            <MaterialIcons name="location-on" size={13} color={isSharing ? Colors.success : Colors.secondary} />
            <Text style={styles.addressText} numberOfLines={1}>
              {viewMode === 'recipient-view' ? 'Recipient device location' : locationAddress}
            </Text>
            {isSharing ? <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View> : null}
          </View>

          {/* Loading overlay */}
          {isLocating ? (
            <View style={styles.mapOverlay}>
              <MaterialIcons name="gps-fixed" size={32} color={Colors.secondary} />
              <Text style={styles.mapOverlayText}>Getting your location...</Text>
            </View>
          ) : null}

          {locationPermission === 'denied' ? (
            <View style={styles.mapOverlay}>
              <MaterialIcons name="location-off" size={32} color={Colors.textTertiary} />
              <Text style={styles.mapOverlayText}>Location access denied</Text>
              <Pressable style={styles.enableBtn} onPress={requestLocation}>
                <Text style={styles.enableBtnText}>Enable Location</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Open in Maps button */}
          {myLocation ? (
            <Pressable style={styles.openMapsBtn} onPress={openInMaps}>
              <MaterialIcons name="open-in-new" size={14} color={Colors.secondary} />
              <Text style={styles.openMapsText}>Open in Maps</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Coordinates card */}
        {myLocation ? (
          <SafeCard style={styles.coordsCard}>
            <View style={styles.coordsHeader}>
              <MaterialIcons name="gps-fixed" size={16} color={Colors.success} />
              <Text style={styles.coordsTitle}>GPS Coordinates</Text>
              <View style={styles.coordsAccuracy}>
                <Text style={styles.coordsAccuracyText}>
                  {myLocation.accuracy ? `±${Math.round(myLocation.accuracy)}m` : 'High'}
                </Text>
              </View>
            </View>
            <View style={styles.coordsRow}>
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>Latitude</Text>
                <Text style={styles.coordValue}>{myLocation.latitude.toFixed(6)}°</Text>
              </View>
              <View style={styles.coordDivider} />
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>Longitude</Text>
                <Text style={styles.coordValue}>{myLocation.longitude.toFixed(6)}°</Text>
              </View>
            </View>
          </SafeCard>
        ) : null}

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { icon: 'speed' as const, label: 'Speed', value: `${speedKmh} km/h`, color: Colors.secondary },
            { icon: 'battery-full' as const, label: 'Battery', value: `${battery}%`, color: battery > 30 ? Colors.success : Colors.warning },
            { icon: 'gps-fixed' as const, label: 'Accuracy', value: myLocation?.accuracy ? `±${Math.round(myLocation.accuracy)}m` : '--', color: Colors.success },
          ].map(s => (
            <SafeCard key={s.label} style={styles.statCard}>
              <MaterialIcons name={s.icon} size={20} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </SafeCard>
          ))}
        </View>

        {/* Active sharing */}
        {isSharing ? (
          <SafeCard variant="success" style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <View style={styles.activePulse}>
                <MaterialIcons name="location-on" size={20} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>Location sharing is live</Text>
                <Text style={styles.activeSub}>Shared with {contacts.length} trusted contact(s)</Text>
              </View>
              <View style={styles.livePill}>
                <View style={styles.liveDotSmall} />
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            </View>
            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>Session duration</Text>
              <Text style={styles.timerValue}>{formatTime(sharingTime)}</Text>
            </View>
            {remaining !== null ? (
              <>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
                </View>
                <Text style={styles.remainingText}>Stops in {formatTime(remaining)}</Text>
              </>
            ) : (
              <Text style={styles.remainingText}>Sharing until manually stopped</Text>
            )}
          </SafeCard>
        ) : null}

        {/* Duration selector */}
        {!isSharing ? (
          <SafeCard style={styles.durationCard}>
            <Text style={styles.cardTitle}>Sharing Duration</Text>
            <View style={styles.durationGrid}>
              {DURATIONS.map(d => (
                <Pressable
                  key={d.value}
                  style={[styles.durationBtn, selectedDuration === d.value && styles.durationBtnActive]}
                  onPress={() => setSelectedDuration(d.value)}
                >
                  <Text style={[styles.durationText, selectedDuration === d.value && styles.durationTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SafeCard>
        ) : null}

        <SafeButton
          label={isSharing ? 'Stop Sharing Location' : 'Share My Live Location'}
          onPress={handleToggleSharing}
          variant={isSharing ? 'outline' : 'secondary'}
          size="lg"
          fullWidth
        />

        {/* Contacts */}
        <SafeCard style={styles.contactsCard}>
          <Text style={styles.cardTitle}>Sharing with ({contacts.length})</Text>
          {contacts.length === 0 ? (
            <Text style={styles.noContacts}>No trusted contacts added. Go to Contacts tab to add some.</Text>
          ) : (
            contacts.map(c => {
              const initials = c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <View key={c.id} style={styles.contactRow}>
                  <View style={[styles.contactAvatar, { backgroundColor: Colors.secondary }]}>
                    <Text style={styles.contactInitials}>{initials}</Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactRel}>{c.relationship}</Text>
                  </View>
                  <View style={[styles.shareStatus, { backgroundColor: isSharing ? Colors.successSurface : Colors.surfaceAlt }]}>
                    <View style={[styles.shareStatusDot, { backgroundColor: isSharing ? Colors.success : Colors.textTertiary }]} />
                    <Text style={[styles.shareStatusText, { color: isSharing ? Colors.success : Colors.textTertiary }]}>
                      {isSharing ? 'Receiving' : 'Offline'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </SafeCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.base,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h3, color: Colors.text, flex: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...Typography.caption, fontWeight: '600' },
  content: { padding: Spacing.base, gap: Spacing.base },
  viewToggle: {
    flexDirection: 'row', backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full, padding: 4, gap: 4,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.full,
  },
  toggleBtnActive: { backgroundColor: Colors.secondary },
  toggleText: { ...Typography.buttonSmall, color: Colors.textSecondary },
  toggleTextActive: { color: '#fff' },

  // Map placeholder
  mapCard: {
    height: 280, borderRadius: Radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
    backgroundColor: '#EDF4FB', position: 'relative',
  },
  mapGrid: { ...StyleSheet.absoluteFillObject },
  mapGridRow: { flex: 1, flexDirection: 'row' },
  mapGridCell: { flex: 1, borderWidth: 0.5, borderColor: 'rgba(59,130,246,0.1)' },
  mapRoadH: {
    position: 'absolute', top: '45%', left: 0, right: 0,
    height: 10, backgroundColor: 'rgba(255,255,255,0.8)',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(200,210,220,0.8)',
  },
  mapRoadV: {
    position: 'absolute', left: '55%', top: 0, bottom: 0,
    width: 10, backgroundColor: 'rgba(255,255,255,0.8)',
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(200,210,220,0.8)',
  },
  mapCenter: {
    position: 'absolute', top: '40%', left: '50%',
    transform: [{ translateX: -13 }, { translateY: -13 }],
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute', width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(34,197,94,0.2)',
    top: -13, left: -13,
  },
  mapMarker: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 3,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  mapMarkerDot: { width: 12, height: 12, borderRadius: 6 },
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
  addressBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)', padding: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  addressText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  liveBadge: { backgroundColor: Colors.danger, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(237,244,251,0.92)',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  mapOverlayText: { ...Typography.bodySmall, color: Colors.textSecondary },
  enableBtn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.secondary, borderRadius: Radius.full },
  enableBtnText: { ...Typography.buttonSmall, color: '#fff' },
  openMapsBtn: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6, ...Shadows.sm,
  },
  openMapsText: { ...Typography.caption, color: Colors.secondary, fontWeight: '600' },

  // Coords card
  coordsCard: {},
  coordsHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  coordsTitle: { ...Typography.label, color: Colors.text, flex: 1 },
  coordsAccuracy: { backgroundColor: Colors.successSurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  coordsAccuracyText: { ...Typography.caption, color: Colors.success, fontWeight: '600' },
  coordsRow: { flexDirection: 'row', alignItems: 'center' },
  coordItem: { flex: 1, alignItems: 'center' },
  coordLabel: { ...Typography.caption, color: Colors.textSecondary },
  coordValue: { ...Typography.h4, color: Colors.text, fontWeight: '700', marginTop: 2 },
  coordDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: { flex: 1, alignItems: 'center', gap: 4, padding: Spacing.md },
  statValue: { ...Typography.h4, fontWeight: '700' },
  statLabel: { ...Typography.caption, color: Colors.textSecondary },

  activeCard: {},
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  activePulse: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.successSurface, alignItems: 'center', justifyContent: 'center' },
  activeTitle: { ...Typography.label, color: Colors.text, fontWeight: '700' },
  activeSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.dangerSurface, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },
  livePillText: { fontSize: 10, fontWeight: '800', color: Colors.danger, letterSpacing: 0.5 },
  timerRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginBottom: Spacing.sm },
  timerLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  timerValue: { ...Typography.h2, color: Colors.success, fontWeight: '800' },
  progressBg: { height: 6, backgroundColor: 'rgba(34,197,94,0.2)', borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.sm },
  progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 3 },
  remainingText: { ...Typography.caption, color: Colors.successDark },
  durationCard: {},
  cardTitle: { ...Typography.h4, color: Colors.text, marginBottom: Spacing.md },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  durationBtn: { flex: 1, minWidth: '45%', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, alignItems: 'center' },
  durationBtnActive: { borderColor: Colors.secondary, backgroundColor: Colors.secondarySurface },
  durationText: { ...Typography.buttonSmall, color: Colors.textSecondary },
  durationTextActive: { color: Colors.secondary, fontWeight: '700' },
  contactsCard: {},
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  contactInitials: { ...Typography.label, color: '#fff', fontWeight: '700' },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.label, color: Colors.text, fontWeight: '600' },
  contactRel: { ...Typography.caption, color: Colors.textSecondary },
  shareStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
  shareStatusDot: { width: 6, height: 6, borderRadius: 3 },
  shareStatusText: { ...Typography.caption, fontWeight: '600' },
  noContacts: { ...Typography.bodySmall, color: Colors.textSecondary, fontStyle: 'italic' },
});
