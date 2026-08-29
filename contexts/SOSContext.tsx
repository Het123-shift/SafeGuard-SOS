import React, { createContext, useState, useRef, ReactNode, useEffect } from 'react';
import { Vibration, Platform, Linking } from 'react-native';
import * as ExpoLocation from 'expo-location';
import { StorageService } from '@/services/storageService';
import { webAudioService } from '@/services/webAudioService';
import { sirenService } from '@/services/sirenService';
import { SupabaseService } from '@/services/supabaseService';
import { motionService } from '@/services/motionService';
import { watchService } from '@/services/watchService';
import { getTrackingUrl } from '@/services/trackingUrl';
import { FallDetectionModal } from '@/components/feature/FallDetectionModal';
import { watchConnectivityService } from '@/services/watchConnectivityService';
import { triggerSOS as triggerNativeSOS, syncCachedSOSTriggerData, SOSSource } from '@/src/useSOSTrigger';
import { openWhatsAppForFirstContact } from '@/services/whatsappService';
import { requestSMSAndEmergencyPermissions, checkSMSPermission } from '@/services/permissionService';

type SOSPhase = 'idle' | 'arming' | 'countdown' | 'active' | 'cancelling';

interface SOSContextType {
  phase: SOSPhase;
  countdown: number;
  activeSeconds: number;
  isSirenMuted: boolean;
  isFallModalVisible: boolean;
  activeSOSEventId: string | null;
  hasSMSPermission: boolean;
  requestEmergencyPermissions: () => Promise<boolean>;
  toggleSirenMute: () => void;
  startArming: () => void;
  cancelSOS: () => void;
  triggerSOS: (source?: SOSSource) => void;
  deactivateSOS: () => void;
  dismissFallModal: () => void;
  sosHistory: SOSEvent[];
  loadHistory: () => Promise<void>;
}

export interface SOSEvent {
  id: string;
  triggeredAt: string;
  resolvedAt: string | null;
  location: string;
  contactsNotified: number;
  duration: number;
}

export const SOSContext = createContext<SOSContextType>({
  phase: 'idle',
  countdown: 3,
  activeSeconds: 0,
  isSirenMuted: false,
  isFallModalVisible: false,
  activeSOSEventId: null,
  hasSMSPermission: true,
  requestEmergencyPermissions: async () => true,
  toggleSirenMute: () => { },
  startArming: () => { },
  cancelSOS: () => { },
  triggerSOS: () => { },
  deactivateSOS: () => { },
  dismissFallModal: () => { },
  sosHistory: [],
  loadHistory: async () => { },
});

export const SOSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [phase, setPhase] = useState<SOSPhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [isSirenMuted, setIsSirenMuted] = useState(false);
  const [isFallModalVisible, setIsFallModalVisible] = useState(false);
  const [activeSOSEventId, setActiveSOSEventId] = useState<string | null>(null);
  const [hasSMSPermission, setHasSMSPermission] = useState(true);
  const [sosHistory, setSosHistory] = useState<SOSEvent[]>([]);

  const countdownRef = useRef<any>(null);
  const activeRef = useRef<any>(null);
  const armStart = useRef<number>(0);
  const currentSOSEventIdRef = useRef<string | null>(null);
  const locationWatchRef = useRef<any>(null);
  const autoExpireTimerRef = useRef<any>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const fallSourceRef = useRef<SOSSource>('fall_detection');

  const requestEmergencyPermissions = async (): Promise<boolean> => {
    const res = await requestSMSAndEmergencyPermissions();
    setHasSMSPermission(res.smsGranted);
    return res.smsGranted;
  };

  useEffect(() => {
    checkSMSPermission().then(setHasSMSPermission);
    loadHistory();

    // Register fall/impact detection callback
    motionService.registerFallCallback((source) => {
      fallSourceRef.current = source || 'fall_detection';
      setIsFallModalVisible(true);
    });

    // Register smartwatch remote trigger callback
    watchService.registerSOSTriggerCallback(() => {
      triggerSOS('smartwatch');
    });

    // Register watch connectivity callback
    watchConnectivityService.registerSOSCallback(() => {
      triggerSOS('smartwatch');
    });

    return () => {
      clearCountdown();
      clearActive();
      stopLocationWatch();
      if (autoExpireTimerRef.current) {
        clearTimeout(autoExpireTimerRef.current);
        autoExpireTimerRef.current = null;
      }
      motionService.stopFallDetection();
    };
  }, []);

  const loadHistory = async () => {
    const history = await StorageService.getSOSHistory();
    setSosHistory(history);
  };

  const stopLocationWatch = () => {
    if (autoExpireTimerRef.current) {
      clearTimeout(autoExpireTimerRef.current);
      autoExpireTimerRef.current = null;
    }
    if (locationWatchRef.current) {
      if (typeof locationWatchRef.current === 'number' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      } else if (typeof locationWatchRef.current.remove === 'function') {
        locationWatchRef.current.remove();
      }
      locationWatchRef.current = null;
    }
  };

  const toggleSirenMute = () => {
    const nextMute = !isSirenMuted;
    setIsSirenMuted(nextMute);
    sirenService.setMuted(nextMute);
  };

  const clearCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const clearActive = () => {
    if (activeRef.current) {
      clearInterval(activeRef.current);
      activeRef.current = null;
    }
  };

  const startArming = () => {
    setIsFallModalVisible(false);
    setPhase('arming');
    armStart.current = Date.now();
  };

  const stopLiveTrackingSession = async () => {
    stopLocationWatch();
    if (currentSOSEventIdRef.current) {
      const sosId = currentSOSEventIdRef.current;
      const coords = lastCoordsRef.current || { lat: 37.7749, lng: -122.4194 };
      await SupabaseService.upsertLiveLocation(sosId, coords.lat, coords.lng, false);
      currentSOSEventIdRef.current = null;
    }
    setActiveSOSEventId(null);
  };

  const cancelSOS = () => {
    clearCountdown();
    clearActive();
    stopLiveTrackingSession();
    sirenService.stopSiren();
    webAudioService.stopRecording();
    setIsFallModalVisible(false);
    setPhase('idle');
    setCountdown(3);
    setActiveSeconds(0);
    setActiveSOSEventId(null);
  };

  const triggerSOS = (source: SOSSource = 'in_app_button') => {
    console.log(`[SOS_DEBUG] triggerSOS() called. Source: ${source}, Platform: ${Platform.OS}`);
    setIsFallModalVisible(false);
    setPhase('countdown');
    setCountdown(3);

    // Call native Android bridge for persistent service + recording + SMS + call
    if (Platform.OS === 'android') {
      try {
        console.log('[SOS_DEBUG] Checking SEND_SMS runtime permission before native dispatch...');
        checkSMSPermission()
          .then((granted) => {
            console.log(`[SOS_DEBUG] checkSMSPermission() result: ${granted}`);
            setHasSMSPermission(granted);
            if (!granted) {
              console.log('[SOS_DEBUG] SMS permission not granted, requesting from user...');
              requestEmergencyPermissions()
                .then((res) => {
                  console.log(`[SOS_DEBUG] requestEmergencyPermissions() returned:`, res);
                })
                .catch((err) => {
                  console.error('[SOS_DEBUG] requestEmergencyPermissions() error:', err);
                });
            }
          })
          .catch((err) => {
            console.error('[SOS_DEBUG] checkSMSPermission() error:', err);
          });

        // 1. Immediately invoke native SOS dispatch (non-blocking) so dispatch never stalls
        triggerNativeSOS(source)
          .then((res) => console.log(`[SOS_DEBUG] triggerNativeSOS(${source}) returned:`, res))
          .catch((err: any) => console.error('[SOS_DEBUG] Native SOS trigger error:', err));

        // 2. Best-effort parallel data sync (contacts + latest GPS) to SharedPreferences
        StorageService.getContacts()
          .then((contacts) => {
            console.log(`[SOS_DEBUG] Retrieved ${contacts.length} contacts for SharedPreferences sync:`, JSON.stringify(contacts));
            getCurrentLocation()
              .then((loc) => {
                console.log(`[SOS_DEBUG] Current location for sync: lat=${loc.lat}, lng=${loc.lng}`);
                syncCachedSOSTriggerData(contacts, loc.lat, loc.lng)
                  .then(() => {
                    console.log('[SOS_DEBUG] syncCachedSOSTriggerData completed.');
                  })
                  .catch((err) => {
                    console.error('[SOS_DEBUG] syncCachedSOSTriggerData error:', err);
                  });
              })
              .catch((locErr) => {
                console.error('[SOS_DEBUG] getCurrentLocation() error during sync:', locErr);
                syncCachedSOSTriggerData(contacts).catch((e) =>
                  console.error('[SOS_DEBUG] Fallback syncCachedSOSTriggerData error:', e)
                );
              });
          })
          .catch((contactsErr) => {
            console.error('[SOS_DEBUG] StorageService.getContacts() error:', contactsErr);
          });
      } catch (dispatchErr) {
        console.error('[SOS_DEBUG] Top-level error in native dispatch block:', dispatchErr);
        triggerNativeSOS(source).catch((e) =>
          console.error('[SOS_DEBUG] Emergency fallback triggerNativeSOS error:', e)
        );
      }
    }

    if (Platform.OS !== 'web') {
      Vibration.vibrate([200, 100, 200, 100, 200]);
    }
    let c = 3;
    countdownRef.current = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearCountdown();
        activateSOS();
      }
    }, 1000);
  };

  const getCurrentLocation = async (): Promise<{ lat: number; lng: number; address: string }> => {
    const fallback = { lat: 37.7749, lng: -122.4194, address: 'Live GPS Location' };

    const locationPromise = (async () => {
      try {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
          const webPosition = await new Promise<any>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve(pos),
              () => resolve(null),
              { timeout: 3000, enableHighAccuracy: true }
            );
          });
          if (webPosition) {
            const lat = webPosition.coords.latitude;
            const lng = webPosition.coords.longitude;
            return { lat, lng, address: `Live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})` };
          }
        }
        const perm = await ExpoLocation.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
          return {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            address: `Live GPS (${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)})`,
          };
        }
      } catch (e) {
        console.warn('[SOS_DEBUG] GPS location retrieval error:', e);
      }
      return fallback;
    })();

    const timeoutPromise = new Promise<{ lat: number; lng: number; address: string }>((resolve) =>
      setTimeout(() => {
        console.warn('[SOS_DEBUG] getCurrentLocation() timed out after 3000ms, using fallback.');
        resolve(fallback);
      }, 3000)
    );

    return Promise.race([locationPromise, timeoutPromise]);
  };

  const startContinuousLocationWatch = async (sosEventId: string) => {
    stopLocationWatch();
    currentSOSEventIdRef.current = sosEventId;

    const onNewCoords = (lat: number, lng: number) => {
      lastCoordsRef.current = { lat, lng };
      SupabaseService.upsertLiveLocation(sosEventId, lat, lng, true);
    };

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        locationWatchRef.current = navigator.geolocation.watchPosition(
          (pos) => onNewCoords(pos.coords.latitude, pos.coords.longitude),
          (err) => console.warn('Web live location watch error:', err),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      } else {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          locationWatchRef.current = await ExpoLocation.watchPositionAsync(
            {
              accuracy: ExpoLocation.Accuracy.High,
              timeInterval: 10000, // Update every 10s
              distanceInterval: 15, // Or every 15 meters
            },
            (loc) => onNewCoords(loc.coords.latitude, loc.coords.longitude)
          );
        }
      }
    } catch (err) {
      console.warn('Failed to start continuous location watch:', err);
    }

    // Auto-expire tracking session after 2 hours to avoid battery drain
    autoExpireTimerRef.current = setTimeout(() => {
      console.log('[SOSContext] Auto-expiring live tracking session after 2 hours');
      stopLiveTrackingSession();
    }, 2 * 60 * 60 * 1000);
  };

  const activateSOS = async () => {
    setIsFallModalVisible(false);
    setPhase('active');
    setActiveSeconds(0);

    const sosEventId = `sos_${Date.now()}`;
    currentSOSEventIdRef.current = sosEventId;
    setActiveSOSEventId(sosEventId);

    // Start Web Audio Siren
    sirenService.startSiren();

    // Start Web Ambient Audio Recording
    webAudioService.startRecording();

    if (Platform.OS !== 'web') {
      Vibration.vibrate([500, 200, 500, 200, 500, 200, 500]);
    }
    let secs = 0;
    activeRef.current = setInterval(() => {
      secs += 1;
      setActiveSeconds(secs);
    }, 1000);

    // 1. Fetch User Profile
    const user = await StorageService.getUser();
    const userName = user?.name || user?.email || 'SafeGuard User';
    console.log(`[SOS_DEBUG] activateSOS() active! User: ${userName}, sosEventId: ${sosEventId}`);

    // 2. Retrieve Initial Live GPS Coordinates
    const loc = await getCurrentLocation();
    lastCoordsRef.current = { lat: loc.lat, lng: loc.lng };
    console.log(`[SOS_DEBUG] activateSOS() initial GPS: lat=${loc.lat}, lng=${loc.lng}`);

    // 3. Upsert initial live location to live_locations table
    await SupabaseService.upsertLiveLocation(sosEventId, loc.lat, loc.lng, true);

    // 4. Start continuous real-time location watching
    startContinuousLocationWatch(sosEventId);

    // 5. Fetch Priority Emergency Contacts
    const contacts = await StorageService.getContacts();
    const contactPhones = contacts.map((c) => c.phone).filter(Boolean);
    console.log(`[SOS_DEBUG] activateSOS() contact count=${contacts.length}, phones:`, contactPhones);

    let smsStatusResults: any[] = [];
    if (contactPhones.length > 0) {
      // 6a. Compute Live Tracking Web Portal URL
      const trackingUrl = getTrackingUrl(sosEventId);
      const emergencyMessage = `EMERGENCY SOS: ${userName} needs urgent help!\nTrack Live: ${trackingUrl}\nGoogle Maps: https://maps.google.com/?q=${loc.lat},${loc.lng}`;
      console.log(`[SOS_DEBUG] emergencyMessage generated (length=${emergencyMessage.length}):`, emergencyMessage);

      // 6b. Call Edge Function (Twilio / MSG91 SMS) with Live Tracking Link
      console.log('[SOS_DEBUG] Invoking SupabaseService.sendSOSEmergencySMS...');
      const smsResponse = await SupabaseService.sendSOSEmergencySMS(
        userName,
        loc.lat,
        loc.lng,
        contactPhones,
        user?.id,
        trackingUrl
      );
      console.log('[SOS_DEBUG] SupabaseService.sendSOSEmergencySMS response:', JSON.stringify(smsResponse));
      smsStatusResults = smsResponse.results || [];
      for (const phone of contactPhones) {
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(emergencyMessage)}`;
        try {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.open(smsUrl, '_blank');
          } else {
            await Linking.openURL(smsUrl);
          }
        } catch (err) {
          console.warn(`Direct SMS dispatch error for ${cleanPhone}:`, err);
        }
      }

      // 6c. WhatsApp Deep-Link Fallback for first contact on Android (fails silently if WhatsApp is not installed)
      if (Platform.OS === 'android') {
        try {
          await openWhatsAppForFirstContact(contacts, emergencyMessage);
        } catch (waErr) {
          console.warn('[SOSContext] WhatsApp auto-trigger error:', waErr);
        }
      }
    }

    // 7. Log the SOS event locally and to Supabase DB
    const event: SOSEvent = {
      id: sosEventId,
      triggeredAt: new Date().toISOString(),
      resolvedAt: null,
      location: loc.address,
      contactsNotified: smsStatusResults.filter((r) => r.status === 'sent').length || contacts.length,
      duration: 0,
    };

    await StorageService.addSOSEvent(event);
    await SupabaseService.logSOSEvent({
      ...event,
      contacts_notified: smsStatusResults,
      trigger_type: 'manual',
      latitude: loc.lat,
      longitude: loc.lng,
    });
    await loadHistory();
  };

  const deactivateSOS = async () => {
    clearActive();
    await stopLiveTrackingSession();
    sirenService.stopSiren();
    webAudioService.stopRecording();
    setPhase('idle');
    setActiveSeconds(0);
    setCountdown(3);
    await loadHistory();
  };

  const dismissFallModal = () => {
    setIsFallModalVisible(false);
  };

  return (
    <SOSContext.Provider
      value={{
        phase,
        countdown,
        activeSeconds,
        isSirenMuted,
        isFallModalVisible,
        activeSOSEventId,
        hasSMSPermission,
        requestEmergencyPermissions,
        toggleSirenMute,
        startArming,
        cancelSOS,
        triggerSOS,
        deactivateSOS,
        dismissFallModal,
        sosHistory,
        loadHistory,
      }}
    >
      {children}
      <FallDetectionModal
        visible={isFallModalVisible}
        onConfirmSOS={() => triggerSOS(fallSourceRef.current || 'fall_detection')}
        onCancel={dismissFallModal}
      />
    </SOSContext.Provider>
  );
};
