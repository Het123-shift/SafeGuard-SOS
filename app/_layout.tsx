import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { AlertProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { ContactsProvider } from '@/contexts/ContactsContext';
import { SOSProvider, SOSContext } from '@/contexts/SOSContext';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ensureSOSServiceRunning } from '@/src/useSOSTrigger';

function GlobalHotkeyHandler({ children }: { children: React.ReactNode }) {
  const sos = React.useContext(SOSContext);
  const spacePressCount = useRef(0);
  const spaceTimer = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Emergency shortcut: Ctrl+Shift+S
      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        sos?.triggerSOS();
        return;
      }

      // Emergency shortcut: Triple space press within 1 second
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
        spacePressCount.current += 1;
        if (spaceTimer.current) clearTimeout(spaceTimer.current);

        if (spacePressCount.current >= 3) {
          spacePressCount.current = 0;
          sos?.triggerSOS();
        } else {
          spaceTimer.current = setTimeout(() => {
            spacePressCount.current = 0;
          }, 1000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sos]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    ensureSOSServiceRunning().catch((err) => console.warn('Foreground service start error:', err));
  }, []);

  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <ContactsProvider>
            <SOSProvider>
              <GlobalHotkeyHandler>
                <StatusBar style="auto" />
                <View style={styles.webCanvas}>
                  <View style={styles.appContainer}>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="index" />
                      <Stack.Screen name="onboarding" />
                      <Stack.Screen name="auth/login" />
                      <Stack.Screen name="auth/register" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen
                        name="screens/helplines"
                        options={{ headerShown: true, title: 'Emergency Helplines', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen
                        name="screens/medical"
                        options={{ headerShown: true, title: 'Medical Profile', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen
                        name="screens/watch-pairing"
                        options={{ headerShown: true, title: 'Smartwatch Realtime Sync', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen
                        name="screens/phone-verification"
                        options={{ headerShown: true, title: 'SMS OTP Phone Verification', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen
                        name="screens/location-setup"
                        options={{ headerShown: true, title: 'GPS Location Verification', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen
                        name="screens/evidence"
                        options={{ headerShown: true, title: 'Evidence Vault', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen
                        name="screens/family"
                        options={{ headerShown: true, title: 'Family Safety Circle', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen
                        name="screens/sos-history"
                        options={{ headerShown: true, title: 'SOS History', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen
                        name="screens/settings"
                        options={{ headerShown: true, title: 'Settings', headerTintColor: '#FF2D2D' }}
                      />
                      <Stack.Screen name="screens/edit-profile" options={{ headerShown: false }} />
                      <Stack.Screen name="screens/change-password" options={{ headerShown: false }} />
                    </Stack>
                  </View>
                </View>
              </GlobalHotkeyHandler>
            </SOSProvider>
          </ContactsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}

const styles = StyleSheet.create({
  webCanvas: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#0F172A' : '#F8F9FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    height: '100%',
    maxHeight: Platform.OS === 'web' ? 920 : undefined,
    backgroundColor: '#F8F9FC',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    borderRadius: Platform.OS === 'web' ? 16 : 0,
  },
});
