import React, { createContext, useState, useRef, ReactNode, useEffect } from 'react';
import { Vibration, Platform, Linking, NativeModules, NativeEventEmitter } from 'react-native';
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
import { triggerSOS as triggerNativeSOS, syncCachedSOSTriggerData, sendDirectSMS, SOSSource } from '@/src/useSOSTrigger';
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

    // Pre-sync stored emergency contacts to native SharedPreferences for screen-off/lock-screen triggers
    StorageService.getContacts().then((stored) => {
      if (stored && stored.length > 0) {
        syncCachedSOSTriggerData(stored).catch(() => {});
      }
    }).catch(() => {});

    // Register fall/impact detection callback
    motionService.registerFallCallback((source) => {
      fallSourceRef.current = source || 'fall_detection';
      setIsFallModalVisible(true);
    });

    // Register accelerometer 5-tap lock-screen trigger callback
    motionService.registerTapCallback((source) => {
      console.log('[SOSContext] Accelerometer 5-Tap Lock-Screen Trigger received:', source);
      triggerSOS('lock_screen_tap');
    });

    // Register smartwatch remote trigger callback
    watchService.registerSOSTriggerCallback(() => {
      triggerSOS('smartwatch');
    });

    // Register watch connectivity callback
    watchConnectivityService.registerSOSCallback(() => {
      triggerSOS('smartwatch');
    });

    // Check for native hardware / widget launch trigger
    let hwSubscription: any = null;
    if (NativeModules.SOSNativeModule) {
      if (typeof NativeModules.SOSNativeModule.getPendingTrigger === 'function') {
        NativeModules.SOSNativeModule.getPendingTrigger().then((src: string | null) => {
          if (src) {
            console.log('[SOSContext] Executing pending hardware/widget trigger:', src);
            triggerSOS(src as any);
          }
        }).catch(() => {});
      }

      try {
        const emitter = new NativeEventEmitter(NativeModules.SOSNativeModule);
        hwSubscription = emitter.addListener('onHardwareSOSTriggered', (src: string) => {
          console.log('[SOSContext] Runtime hardware SOS trigger event:', src);
          triggerSOS(src as any);
        });
      } catch (err) {
        console.warn('[SOSContext] EventEmitter error:', err);
      }
    }

    return () => {
      if (hwSubscription && typeof hwSubscription.remove === 'function') {
        hwSubscription.remove();
      }
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

    const sosEventId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
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
      const emergencyMessage = `EMERGENCY SOS: ${userName} needs urgent help!\nGoogle Maps: https://maps.google.com/?q=${loc.lat},${loc.lng}\nTrack Live: ${trackingUrl}`;
      console.log(`[SOS_DEBUG] emergencyMessage generated (length=${emergencyMessage.length}):`, emergencyMessage);

      // 6b. Dispatch direct background SIM SMS natively on Android
      if (Platform.OS === 'android') {
        try {
          console.log('[SOS_DEBUG] Dispatching direct SIM SMS via SOSNativeModule...');
          const directRes = await sendDirectSMS(contactPhones, emergencyMessage);
          console.log('[SOS_DEBUG] Direct SIM SMS dispatch result:', directRes);
        } catch (directErr) {
          console.warn('[SOS_DEBUG] Direct SIM SMS error:', directErr);
        }
      }

      // 6c. Best-effort server Edge Function SMS (non-blocking)
      SupabaseService.sendSOSEmergencySMS(
        userName,
        loc.lat,
        loc.lng,
        contactPhones,
        user?.id,
        trackingUrl
      ).then((smsResponse) => {
        console.log('[SOS_DEBUG] Edge SMS response:', smsResponse);
      }).catch((err) => {
        console.warn('[SOS_DEBUG] Edge SMS network fallback (handled):', err);
      });
    }

    // 7. Log the SOS event locally and to Supabase DB
    const event: SOSEvent = {
      id: sosEventId,
      triggeredAt: new Date().toISOString(),
      resolvedAt: null,
      location: loc.address,
      contactsNotified: contactPhones.length || 1,
      duration: 0,
    };

    await StorageService.addSOSEvent(event).catch(() => {});
    SupabaseService.logSOSEvent({
      ...event,
      contacts_notified: smsStatusResults,
      trigger_type: 'manual',
      latitude: loc.lat,
      longitude: loc.lng,
    }).catch(() => {});
    await loadHistory().catch(() => {});
  };

  const deactivateSOS = async () => {
    clearActive();
    await stopLiveTrackingSession();
    sirenService.stopSiren();
    try {
      const audioResult = await webAudioService.stopRecording();
      if (audioResult && audioResult.uri) {
        const evidenceItem = {
          id: `ev_rec_${Date.now()}`,
          type: 'audio' as const,
          name: `SOS_Audio_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.m4a`,
          size: `${(audioResult.durationSeconds * 16).toFixed(0)} KB`,
          uri: audioResult.uri,
          mimeType: audioResult.mimeType || 'audio/m4a',
          encrypted: true,
          createdAt: new Date().toISOString(),
          tags: ['sos-incident-evidence', `sos_id:${currentSOSEventIdRef.current || 'event'}`],
        };
        const currentVault = await StorageService.getEvidence();
        await StorageService.saveEvidence([evidenceItem, ...currentVault]);
        console.log('[SOSContext] Saved emergency audio to Evidence Vault:', evidenceItem);
      }
    } catch (err) {
      console.warn('[SOSContext] Failed to save evidence audio:', err);
    }
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
