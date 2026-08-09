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

  private onRemoteSOSTrigger: (() => void) | null = null;
  private heartRateTimer: any = null;

  public getStatus(): WatchStatus {
    return { ...this.status };
  }

  public setPaired(paired: boolean) {
    this.status.isPaired = paired;
    this.status.isConnected = paired;
  }

  public registerRemoteSOSTrigger(callback: () => void) {
    this.onRemoteSOSTrigger = callback;
  }

  public registerSOSTriggerCallback(callback: () => void) {
    this.registerRemoteSOSTrigger(callback);
  }

  // Simulate remote watch SOS button press
  public triggerWatchSOS() {
    if (this.onRemoteSOSTrigger) {
      this.onRemoteSOSTrigger();
    }
  }

  // Simulate heart rate panic spike detection (> 130 BPM)
  public simulateHeartRateSpike() {
    this.status.heartRate = 138;
    if (this.onRemoteSOSTrigger) {
      this.onRemoteSOSTrigger();
    }
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
