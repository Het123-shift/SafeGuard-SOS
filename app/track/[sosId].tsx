import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { SupabaseService } from '@/services/supabaseService';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { SafeCard } from '@/components/ui/SafeCard';

interface LiveLocationRecord {
  sos_event_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  is_active: boolean;
}

export default function PublicLiveTrackingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sosId: string }>();
  const sosId = params.sosId;

  const [location, setLocation] = useState<LiveLocationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!sosId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // Fetch initial live location snapshot
    const fetchInitial = async () => {
      setIsLoading(true);
      const data = await SupabaseService.getLiveLocation(sosId);
      if (isMounted && data) {
        setLocation(data);
        const lastUpdated = new Date(data.updated_at).getTime();
        const now = Date.now();
        setSecondsAgo(Math.max(0, Math.floor((now - lastUpdated) / 1000)));
      }
      if (isMounted) setIsLoading(false);
    };

    fetchInitial();

    // Subscribe to real-time changes via Supabase Realtime channel
    const unsubscribe = SupabaseService.subscribeToLiveLocation(sosId, (newLoc) => {
      console.log('[TrackScreen] Realtime update received:', newLoc);
      if (isMounted) {
        setLocation(newLoc);
        setSecondsAgo(0);
      }
    });

    // Seconds-ago ticker interval
    const ticker = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(ticker);
    };
  }, [sosId]);

  const openInGoogleMaps = () => {
    if (!location) return;
    const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const isActive = location?.is_active ?? false;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialIcons name="security" size={24} color={Colors.danger} />
        <Text style={styles.headerTitle}>SafeGuard Emergency Tracking</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* Status Banner */}
        <SafeCard variant={isActive ? 'danger' : 'default'} style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusPulse, { backgroundColor: isActive ? Colors.dangerSurface : Colors.surfaceAlt }]}>
              <MaterialIcons
                name={isActive ? "radar" : "check-circle"}
                size={24}
                color={isActive ? Colors.danger : Colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>
                {isActive ? 'LIVE EMERGENCY TRACKING ACTIVE' : 'TRACKING ENDED'}
              </Text>
              <Text style={styles.statusSub}>
                {isActive
                  ? 'Real-time GPS updates from user device'
                  : 'The user has deactivated or resolved the SOS alert'}
              </Text>
            </View>
            {isActive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            ) : null}
          </View>
        </SafeCard>

        {/* Map / Coordinates Card */}
        <View style={styles.mapCard}>
          <View style={styles.mapHeader}>
            <MaterialIcons name="my-location" size={20} color={isActive ? Colors.danger : Colors.secondary} />
            <Text style={styles.mapTitle}>Current Location Coordinates</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <MaterialIcons name="gps-fixed" size={32} color={Colors.secondary} />
              <Text style={styles.loadingText}>Fetching live GPS signal...</Text>
            </View>
          ) : location ? (
            <View style={styles.coordsBox}>
              <View style={styles.coordRow}>
                <View style={styles.coordItem}>
                  <Text style={styles.coordLabel}>Latitude</Text>
                  <Text style={styles.coordValue}>{location.latitude.toFixed(6)}°</Text>
                </View>
                <View style={styles.coordDivider} />
                <View style={styles.coordItem}>
                  <Text style={styles.coordLabel}>Longitude</Text>
                  <Text style={styles.coordValue}>{location.longitude.toFixed(6)}°</Text>
                </View>
              </View>

              <View style={styles.updateTicker}>
                <MaterialIcons name="access-time" size={14} color={Colors.textSecondary} />
                <Text style={styles.updateTickerText}>
                  {isActive
                    ? `Updated ${secondsAgo} seconds ago`
                    : `Ended at ${new Date(location.updated_at).toLocaleTimeString()}`}
                </Text>
              </View>

              <Pressable style={styles.mapsBtn} onPress={openInGoogleMaps}>
                <MaterialIcons name="directions" size={20} color="#fff" />
                <Text style={styles.mapsBtnText}>Open Directions in Google Maps</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <MaterialIcons name="location-off" size={36} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No location data found for SOS ID: {sosId}</Text>
            </View>
          )}
        </View>

        {/* Safety Instructions Card for Contact */}
        <SafeCard style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Emergency Responder Instructions</Text>
          <Text style={styles.safetyBody}>
            1. Click "Open Directions in Google Maps" above to navigate immediately to the user's location.
          </Text>
          <Text style={styles.safetyBody}>
            2. If you cannot reach the user, call local emergency services (112 / 911 / 100) immediately.
          </Text>
          <Text style={styles.safetyBody}>
            3. Keep this page open; coordinates update automatically via live satellite GPS.
          </Text>
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
  content: { padding: Spacing.base, gap: Spacing.base },
  statusCard: {},
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusPulse: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { ...Typography.label, color: Colors.text, fontWeight: '700' },
  statusSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.dangerSurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.danger, letterSpacing: 0.5 },
  mapCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border, ...Shadows.card },
  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  mapTitle: { ...Typography.h4, color: Colors.text, flex: 1 },
  loadingBox: { paddingVertical: 40, alignItems: 'center', gap: Spacing.md },
  loadingText: { ...Typography.bodySmall, color: Colors.textSecondary },
  coordsBox: { gap: Spacing.base },
  coordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: Radius.lg },
  coordItem: { flex: 1, alignItems: 'center' },
  coordLabel: { ...Typography.caption, color: Colors.textSecondary },
  coordValue: { ...Typography.h3, color: Colors.text, fontWeight: '700', marginTop: 2 },
  coordDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  updateTicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  updateTickerText: { ...Typography.caption, color: Colors.textSecondary },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.lg, ...Shadows.md },
  mapsBtnText: { ...Typography.button, color: '#fff', fontWeight: '700' },
  emptyBox: { paddingVertical: 40, alignItems: 'center', gap: Spacing.sm },
  emptyText: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center' },
  safetyCard: {},
  safetyTitle: { ...Typography.h4, color: Colors.text, marginBottom: Spacing.md },
  safetyBody: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 20 },
});
