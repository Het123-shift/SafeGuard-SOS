import { Platform } from 'react-native';

export interface WatchMessagePayload {
  command: 'TRIGGER_SOS' | 'CANCEL_SOS' | 'HEART_RATE_SPIKE';
  timestamp: string;
  heartRate?: number;
}

class WatchConnectivityServiceIOS {
  private isWatchSupported: boolean = false;
  private sosCallback: (() => void) | null = null;

  constructor() {
    this.initWatchListener();
  }

  private async initWatchListener() {
    if (Platform.OS === 'ios') {
      try {
        const watch = require('react-native-watch-connectivity');
        this.isWatchSupported = true;

        watch.subscribeToMessages((err: any, message: WatchMessagePayload, reply: any) => {
          if (err) {
            console.error('WatchConnectivity message error:', err);
            return;
          }
          if (message && message.command === 'TRIGGER_SOS') {
            if (this.sosCallback) {
              this.sosCallback();
            }
          }
          if (reply) {
            reply({ status: 'received' });
          }
        });
      } catch (e) {
        console.warn('WatchConnectivity native module not loaded in iOS runtime:', e);
      }
    }
  }

  public registerSOSCallback(callback: () => void) {
    this.sosCallback = callback;
  }

  public sendMessageToWatch(message: WatchMessagePayload) {
    if (Platform.OS === 'ios') {
      try {
        const watch = require('react-native-watch-connectivity');
        watch.sendMessage(message, (err: any) => {
          if (err) console.warn('Failed to send message to Apple Watch:', err);
        });
      } catch (e) {
        console.warn('Watch messaging unavailable:', e);
      }
    }
  }
}

export const watchConnectivityService = new WatchConnectivityServiceIOS();
