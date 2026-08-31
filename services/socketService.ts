import { ApiService } from './apiService';

type LocationChangedCallback = (data: { latitude: number; longitude: number; updatedAt?: string; isActive?: boolean }) => void;
type SessionExpiredCallback = () => void;

class TrackingSocketManager {
  private socket: any = null;
  private currentSosId: string | null = null;
  private pollInterval: any = null;

  connect(
    sosId: string,
    token?: string,
    onLocationChanged?: LocationChangedCallback,
    onExpired?: SessionExpiredCallback
  ): any {
    this.disconnect();
    this.currentSosId = sosId;
    const baseUrl = ApiService.getBaseUrl();

    // Try loading socket.io-client if installed
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const socketIoModule = require('socket.io-client');
      const io = socketIoModule.io || socketIoModule.default || socketIoModule;

      if (typeof io === 'function') {
        this.socket = io(baseUrl, {
          auth: { sosId, token },
          query: { sosId, token },
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
          console.log(`[SocketService] Connected to tracking socket for SOS: ${sosId}`);
        });

        if (onLocationChanged) {
          this.socket.on('location_changed', (data: any) => {
            console.log('[SocketService] Location changed event:', data);
            onLocationChanged(data);
          });
        }

        if (onExpired) {
          this.socket.on('session_expired', () => {
            console.warn(`[SocketService] Session expired for SOS: ${sosId}`);
            onExpired();
          });
        }

        this.socket.on('connect_error', (err: any) => {
          console.warn('[SocketService] Connection error, polling fallback active:', err.message);
        });

        return this.socket;
      }
    } catch {
      console.log('[SocketService] socket.io-client not loaded; using high-frequency GPS polling sync.');
    }

    // High-frequency REST polling fallback (2.5s interval)
    this.pollInterval = setInterval(async () => {
      try {
        const snapshot = await ApiService.getTrackingSnapshot(sosId, token);
        if (snapshot) {
          if (snapshot.isExpired && onExpired) {
            onExpired();
            this.disconnect();
          } else if (onLocationChanged && snapshot.latitude !== undefined) {
            onLocationChanged({
              latitude: snapshot.latitude,
              longitude: snapshot.longitude,
              updatedAt: snapshot.updatedAt,
              isActive: snapshot.isActive,
            });
          }
        }
      } catch (pollErr) {
        // Handled silently
      }
    }, 2500);

    return null;
  }

  sendLocationUpdate(latitude: number, longitude: number, isActive: boolean = true): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('location_update', {
        latitude,
        longitude,
        isActive,
      });
    } else if (this.currentSosId) {
      // Fallback REST location update
      ApiService.updateLiveLocation(this.currentSosId, latitude, longitude, isActive).catch(() => {});
    }
  }

  disconnect(): void {
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch {}
      this.socket = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.currentSosId = null;
  }
}

export const socketService = new TrackingSocketManager();
