export interface WatchMessagePayload {
  command: 'TRIGGER_SOS' | 'CANCEL_SOS' | 'HEART_RATE_SPIKE';
  timestamp: string;
  heartRate?: number;
}

class WatchConnectivityServiceWeb {
  private sosCallback: (() => void) | null = null;

  public registerSOSCallback(callback: () => void) {
    this.sosCallback = callback;
  }

  public sendMessageToWatch(message: WatchMessagePayload) {
    // Web stub
  }
}

export const watchConnectivityService = new WatchConnectivityServiceWeb();
