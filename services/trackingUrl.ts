import { Platform } from 'react-native';

/**
 * Dynamically resolves the tracking web URL for live emergency location sharing.
 * Priority:
 * 1. EXPO_PUBLIC_WEB_BASE_URL (if configured in .env)
 * 2. Window location origin (if running on web)
 * 3. Fallback to official safeguard-sos web tracking URL
 */
export function getTrackingUrl(sosEventId: string): string {
  const customBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (customBaseUrl && customBaseUrl.trim() !== '') {
    return `${customBaseUrl.trim().replace(/\/$/, '')}/track/${sosEventId}`;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/track/${sosEventId}`;
  }

  return `https://safeguard-sos.app/track/${sosEventId}`;
}
