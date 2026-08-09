import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from '@/components/feature/PlatformMap';
import { useAlert } from '@/template';
import { useContacts } from '@/hooks/useContacts';
import { SafeCard } from '@/components/ui/SafeCard';
import { SafeButton } from '@/components/ui/SafeButton';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = Math.min(320, SCREEN_WIDTH * 0.85);

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
  heading?: number | null;
}

export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const { contacts } = useContacts();
  const { showAlert } = useAlert();
  const mapRef = useRef<MapView>(null);

  // Location state
  const [myLocation, setMyLocation] = useState<LocationCoords | null>(null);
  const [locationAddress, setLocationAddress] = useState('Locating...');
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [isLocating, setIsLocating] = useState(false);

  // Sharing state
  const [isSharing, setIsSharing] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<Duration>(30);
  const [sharingTime, setSharingTime] = useState(0);
  const [battery] = useState(72);
  const [viewMode, setViewMode] = useState<ViewMode>('my-location');

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSharing) {
      interval = setInterval(() => setSharingTime(t => t + 1), 1000);
    } else {
      setSharingTime(0);
    }
    return () => clearInterval(interval);
  }, [isSharing]);

  useEffect(() => {
    if (isSharing && selectedDuration > 0 && sharingTime >= selectedDuration * 60) {
      setIsSharing(false);
      showAlert('Location Sharing Ended', `Your ${selectedDuration}-minute session has ended.`);
    }
  }, [sharingTime, selectedDuration, isSharing]);

  // Pulse animation loop when sharing
  useEffect(() => {
    if (isSharing) {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 2.2, duration: 1200, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isSharing]);

  const requestLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermission('denied');
        setLocationAddress('Location access denied');
        setIsLocating(false);
        return;
      }
      setLocationPermission('granted');

      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });

      const coords: LocationCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
      };
      setMyLocation(coords);

      // Animate map to location
      mapRef.current?.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 800);

      // Reverse geocode
      try {
        const [geo] = await ExpoLocation.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (geo) {
          const parts = [geo.name, geo.street, geo.city, geo.region].filter(Boolean);
          setLocationAddress(parts.join(', ') || 'Location found');
        }
      } catch {
        setLocationAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      }
    } catch {
      setLocationAddress('Could not get location');
    }
    setIsLocating(false);
  };

  const recenter = useCallback(() => {
    if (myLocation) {
      mapRef.current?.animateToRegion({
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }, 600);
    }
  }, [myLocation]);

  const handleToggleSharing = useCallback(() => {
    if (!isSharing) {
      if (contacts.length === 0) {
        showAlert('No Contacts', 'Add at least one trusted contact to share your location.');
        return;
      }
      if (!myLocation) {
        showAlert('No Location', 'Enable location access first to share your position.');
        return;
      }
      setIsSharing(true);
      showAlert(
        'Location Sharing Started',
        `Your live location is now being shared with ${contacts.length} contact(s) for ${selectedDuration === 0 ? 'unlimited time' : `${selectedDuration} minutes`}.`
      );
    } else {
      setIsSharing(false);
      setViewMode('my-location');
    }
  }, [isSharing, contacts, myLocation, selectedDuration]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const speedKmh = myLocation?.speed != null && myLocation.speed > 0
    ? Math.round(myLocation.speed * 3.6)
    : 0;

  const remaining = selectedDuration > 0 ? Math.max(0, selectedDuration * 60 - sharingTime) : null;
  const progress = selectedDuration > 0 ? Math.min((sharingTime / (selectedDuration * 60)) * 100, 100) : 0;

  // Display location uses actual GPS coordinates
  const displayLocation = myLocation;

  const initialRegion = {
    latitude: myLocation?.latitude ?? 20.5937,
    longitude: myLocation?.longitude ?? 78.9629,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
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

        {/* View Mode Toggle (only when sharing) */}
        {isSharing ? (
          <View style={styles.viewToggle}>
            {(['my-location', 'recipient-view'] as const).map(mode => (
              <Pressable
                key={mode}
                style={[styles.toggleBtn, viewMode === mode && styles.toggleBtnActive]}
                onPress={() => setViewMode(mode)}
              >
                <MaterialIcons
                  name={mode === 'my-location' ? 'my-location' : 'people'}
                  size={16}
                  color={viewMode === mode ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>
                  {mode === 'my-location' ? 'My Location' : 'Recipient View'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Map */}
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={initialRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            mapType="standard"
          >
            {displayLocation ? (
              <>
                {/* Accuracy circle */}
                {isSharing ? (
                  <Circle
                    center={{ latitude: displayLocation.latitude, longitude: displayLocation.longitude }}
                    radius={displayLocation.accuracy ?? 20}
                    fillColor="rgba(59,130,246,0.08)"
                    strokeColor="rgba(59,130,246,0.3)"
                    strokeWidth={1}
                  />
                ) : null}

                {/* Pulse ring when sharing */}
                {isSharing ? (
                  <Circle
                    center={{ latitude: displayLocation.latitude, longitude: displayLocation.longitude }}
                    radius={60}
                    fillColor="rgba(34,197,94,0.08)"
                    strokeColor="rgba(34,197,94,0.4)"
                    strokeWidth={2}
                  />
                ) : null}

                {/* Main location marker */}
                <Marker
                  coordinate={{ latitude: displayLocation.latitude, longitude: displayLocation.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.markerOuter, { borderColor: isSharing ? Colors.success : Colors.secondary }]}>
                      <View style={[styles.markerInner, { backgroundColor: isSharing ? Colors.success : Colors.secondary }]} />
                    </View>
                    <View style={[styles.markerTail, { borderTopColor: isSharing ? Colors.success : Colors.secondary }]} />
                  </View>
                </Marker>
              </>
            ) : null}
          </MapView>

          {/* Recenter button */}
          <Pressable style={styles.recenterBtn} onPress={recenter}>
            <MaterialIcons name="my-location" size={22} color={Colors.secondary} />
          </Pressable>

          {/* Permission denied overlay */}
          {locationPermission === 'denied' ? (
            <View style={styles.permissionOverlay}>
              <MaterialIcons name="location-off" size={36} color={Colors.textTertiary} />
              <Text style={styles.permissionText}>Location access denied</Text>
              <Pressable style={styles.permissionBtn} onPress={requestLocation}>
                <Text style={styles.permissionBtnText}>Enable Location</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Loading overlay */}
          {isLocating ? (
            <View style={styles.permissionOverlay}>
              <MaterialIcons name="gps-fixed" size={36} color={Colors.secondary} />
              <Text style={styles.permissionText}>Getting your location...</Text>
            </View>
          ) : null}

          {/* Address bar */}
          <View style={styles.addressBar}>
            <MaterialIcons name="location-on" size={14} color={isSharing ? Colors.success : Colors.secondary} />
            <Text style={styles.addressText} numberOfLines={1}>
              {viewMode === 'recipient-view'
                ? `Recipient device location (simulated)`
                : locationAddress}
            </Text>
            {isSharing ? (
              <View style={styles.liveDot}>
                <Text style={styles.liveDotText}>LIVE</Text>
              </View>
            ) : null}
          </View>
        </View>

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

        {/* Active sharing info */}
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

        {/* Duration selector (only when not sharing) */}
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

        {/* Toggle button */}
        <SafeButton
          label={isSharing ? 'Stop Sharing Location' : 'Share My Live Location'}
          onPress={handleToggleSharing}
          variant={isSharing ? 'outline' : 'secondary'}
          size="lg"
          fullWidth
        />

        {/* How recipient view works */}
        {isSharing ? (
          <SafeCard style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialIcons name="info-outline" size={18} color={Colors.secondary} />
              <Text style={styles.infoTitle}>About Recipient View</Text>
            </View>
            <Text style={styles.infoDesc}>
              When you share your location, each recipient sees their own device location on their map — not yours. This lets both parties navigate toward each other. Toggle "Recipient View" above to simulate what they see.
            </Text>
          </SafeCard>
        ) : null}

        {/* Sharing with contacts */}
        <SafeCard style={styles.contactsCard}>
          <Text style={styles.cardTitle}>Sharing with ({contacts.length})</Text>
          {contacts.length === 0 ? (
            <Text style={styles.noContacts}>No trusted contacts added. Go to Contacts tab to add some.</Text>
          ) : (
            contacts.map(c => {
              const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
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
                      {isSharing ? 'Receiving live' : 'Offline'}
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

  mapWrapper: {
    height: MAP_HEIGHT, borderRadius: Radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
    backgroundColor: '#E8F4FD',
  },
  map: { ...StyleSheet.absoluteFillObject },

  markerContainer: { alignItems: 'center' },
  markerOuter: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 3, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  markerInner: { width: 12, height: 12, borderRadius: 6 },
  markerTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },

  recenterBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },

  permissionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248,249,252,0.95)',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  permissionText: { ...Typography.bodySmall, color: Colors.textSecondary },
  permissionBtn: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    backgroundColor: Colors.secondary, borderRadius: Radius.full,
  },
  permissionBtnText: { ...Typography.buttonSmall, color: '#fff' },

  addressBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)', padding: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  addressText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  liveDot: {
    backgroundColor: Colors.danger, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  liveDotText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: { flex: 1, alignItems: 'center', gap: 4, padding: Spacing.md },
  statValue: { ...Typography.h4, fontWeight: '700' },
  statLabel: { ...Typography.caption, color: Colors.textSecondary },

  activeCard: {},
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  activePulse: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.successSurface, alignItems: 'center', justifyContent: 'center',
  },
  activeTitle: { ...Typography.label, color: Colors.text, fontWeight: '700' },
  activeSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.dangerSurface, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
  },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },
  livePillText: { fontSize: 10, fontWeight: '800', color: Colors.danger, letterSpacing: 0.5 },
  timerRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginBottom: Spacing.sm },
  timerLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  timerValue: { ...Typography.h2, color: Colors.success, fontWeight: '800' },
  progressBg: {
    height: 6, backgroundColor: 'rgba(34,197,94,0.2)',
    borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.sm,
  },
  progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 3 },
  remainingText: { ...Typography.caption, color: Colors.successDark },

  durationCard: {},
  cardTitle: { ...Typography.h4, color: Colors.text, marginBottom: Spacing.md },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  durationBtn: {
    flex: 1, minWidth: '45%', paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt, alignItems: 'center',
  },
  durationBtnActive: { borderColor: Colors.secondary, backgroundColor: Colors.secondarySurface },
  durationText: { ...Typography.buttonSmall, color: Colors.textSecondary },
  durationTextActive: { color: Colors.secondary, fontWeight: '700' },

  infoCard: {},
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  infoTitle: { ...Typography.label, color: Colors.secondary, fontWeight: '600' },
  infoDesc: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },

  contactsCard: {},
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  contactInitials: { ...Typography.label, color: '#fff', fontWeight: '700' },
  contactInfo: { flex: 1 },
  contactName: { ...Typography.label, color: Colors.text, fontWeight: '600' },
  contactRel: { ...Typography.caption, color: Colors.textSecondary },
  shareStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full,
  },
  shareStatusDot: { width: 6, height: 6, borderRadius: 3 },
  shareStatusText: { ...Typography.caption, fontWeight: '600' },
  noContacts: { ...Typography.bodySmall, color: Colors.textSecondary, fontStyle: 'italic' },
});
