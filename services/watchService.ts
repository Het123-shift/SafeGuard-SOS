import { Platform } from 'react-native';

export interface WatchStatus {
  isPaired: boolean;
  isConnected: boolean;
  deviceName: string;
  batteryLevel: number;
  heartRate: number;
  lastSyncTime: string;
}

class WatchService {
  private status: WatchStatus = {
    isPaired: true,
    isConnected: true,
    deviceName: 'Galaxy Watch / Apple Watch',
    batteryLevel: 88,
    heartRate: 74,
    lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  private onRemoteSOSTrigger: ((payload?: { heartRate?: number }) => void) | null = null;
  private heartRateTimer: any = null;

  public getStatus(): WatchStatus {
    return { ...this.status };
  }

  public setPaired(paired: boolean) {
    this.status.isPaired = paired;
    this.status.isConnected = paired;
    this.notifyStatusListeners();
  }

  public setConnected(connected: boolean) {
    this.status.isConnected = connected;
    this.notifyStatusListeners();
  }

  private statusListeners: Array<(status: WatchStatus) => void> = [];

  public addStatusListener(listener: (status: WatchStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatusListeners() {
    for (const listener of this.statusListeners) {
      listener({ ...this.status });
    }
  }

  public registerRemoteSOSTrigger(callback: (payload?: { heartRate?: number }) => void) {
    this.onRemoteSOSTrigger = callback;
  }

  public registerSOSTriggerCallback(callback: (payload?: { heartRate?: number }) => void) {
    this.registerRemoteSOSTrigger(callback);
  }

  // Trigger remote watch SOS button press with connection check
  public triggerWatchSOS(): { success: boolean; error?: string } {
    if (!this.status.isConnected) {
      console.warn('[WatchService] Cannot trigger SOS: Watch is disconnected from phone');
      return { success: false, error: 'Wearable is disconnected. Reconnect Bluetooth to trigger SOS.' };
    }
    if (this.onRemoteSOSTrigger) {
      this.onRemoteSOSTrigger({ heartRate: this.status.heartRate });
    }
    return { success: true };
  }

  // Simulate heart rate panic spike detection (> 130 BPM)
  public simulateHeartRateSpike(): { success: boolean; error?: string } {
    if (!this.status.isConnected) {
      console.warn('[WatchService] Cannot trigger panic spike: Watch is disconnected');
      return { success: false, error: 'Wearable is disconnected.' };
    }
    this.status.heartRate = 138;
    if (this.onRemoteSOSTrigger) {
      this.onRemoteSOSTrigger({ heartRate: 138 });
    }
    return { success: true };
  }

  public startHeartRateMonitoring() {
    if (this.heartRateTimer) return;
    this.heartRateTimer = setInterval(() => {
      // Small realistic heart rate fluctuation between 68 and 82 BPM
      const randomBpm = Math.floor(Math.random() * 14) + 68;
      this.status.heartRate = randomBpm;
      this.status.lastSyncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 5000);
  }

  public stopHeartRateMonitoring() {
    if (this.heartRateTimer) {
      clearInterval(this.heartRateTimer);
      this.heartRateTimer = null;
    }
  }
}

export const watchService = new WatchService();
