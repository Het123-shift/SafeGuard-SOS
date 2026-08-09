import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

export type MotionSensitivity = 'low' | 'medium' | 'high';

const THRESHOLDS: Record<MotionSensitivity, number> = {
  low: 3.8,     // Hard impact / car crash / violent fall
  medium: 3.0,  // Standard fall
  high: 2.2,    // Sensitive fall detection
};

class MotionService {
  private isListening: boolean = false;
  private sensitivity: MotionSensitivity = 'medium';
  private onFallDetectedCallback: ((source: 'fall_detection' | 'impact_detection') => void) | null = null;
  private subscription: any = null;
  private lastImpactTime: number = 0;

  public setSensitivity(sensitivity: MotionSensitivity) {
    this.sensitivity = sensitivity;
  }

  public getSensitivity(): MotionSensitivity {
    return this.sensitivity;
  }

  public startListening(onFallDetected: (source: 'fall_detection' | 'impact_detection') => void) {
    if (this.isListening) return;
    this.onFallDetectedCallback = onFallDetected;
    this.isListening = true;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', this.handleWebMotion);
      }
    } else {
      Accelerometer.setUpdateInterval(100);
      this.subscription = Accelerometer.addListener(this.handleNativeMotion);
    }
  }

  public registerFallCallback(onFallDetected: (source: 'fall_detection' | 'impact_detection') => void) {
    this.startListening(onFallDetected);
  }

  public stopFallDetection() {
    this.stopListening();
  }

  public stopListening() {
    this.isListening = false;
    this.onFallDetectedCallback = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        window.removeEventListener('devicemotion', this.handleWebMotion);
      }
    } else if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  private handleNativeMotion = ({ x, y, z }: { x: number; y: number; z: number }) => {
    // Total acceleration magnitude in Gs
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    this.checkImpact(magnitude);
  };

  private handleWebMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const x = (acc.x || 0) / 9.81;
    const y = (acc.y || 0) / 9.81;
    const z = (acc.z || 0) / 9.81;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    this.checkImpact(magnitude);
  };

  private checkImpact(magnitude: number) {
    const threshold = THRESHOLDS[this.sensitivity];
    const now = Date.now();

    // Prevent duplicate triggers within 10 seconds
    if (magnitude >= threshold && now - this.lastImpactTime > 10000) {
      this.lastImpactTime = now;
      if (this.onFallDetectedCallback) {
        const source = (magnitude >= 3.8 || this.sensitivity === 'low') ? 'impact_detection' : 'fall_detection';
        this.onFallDetectedCallback(source);
      }
    }
  }

  // Simulated fall for testing in browser / dev mode
  public simulateFallImpact(source: 'fall_detection' | 'impact_detection' = 'fall_detection') {
    const now = Date.now();
    if (now - this.lastImpactTime > 3000) {
      this.lastImpactTime = now;
      if (this.onFallDetectedCallback) {
        this.onFallDetectedCallback(source);
      }
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const motionService = new MotionService();
