export interface WatchMessagePayload {
  command: 'TRIGGER_SOS' | 'CANCEL_SOS' | 'HEART_RATE_SPIKE';
  timestamp: string;
  heartRate?: number;
}

class WatchConnectivityServiceStub {
  private sosCallback: (() => void) | null = null;

  public registerSOSCallback(callback: () => void) {
    this.sosCallback = callback;
  }

  public sendMessageToWatch(message: WatchMessagePayload) {
    // Apple Watch connectivity is iOS-only.
    // Wear OS & Galaxy Watch sync is handled via bluetooth/watchService.
  }
}

export const watchConnectivityService = new WatchConnectivityServiceStub();
