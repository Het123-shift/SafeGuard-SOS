import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

export type MotionSensitivity = 'low' | 'medium' | 'high';

const THRESHOLDS: Record<MotionSensitivity, number> = {
  low: 3.2,     // Hard collision / vehicle impact (3.2G spike)
  medium: 2.2,  // Standard fall / energetic shake (2.2G spike)
  high: 1.6,    // Sensitive shake & fall detection (1.6G spike)
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
    try {
      // expo-sensors can return either Gs (1.0 = 1G) or m/s^2 (9.8 = 1G)
      const rawMagnitude = Math.sqrt((x || 0) * (x || 0) + (y || 0) * (y || 0) + (z || 0) * (z || 0));
      const gMagnitude = rawMagnitude > 4.5 ? rawMagnitude / 9.81 : rawMagnitude;
      
      // Calculate dynamic impact spike above baseline 1.0G gravity
      const impactG = Math.abs(gMagnitude - 1.0);
      if (impactG > 0.3) {
        console.log(`[MotionSensor] RAW: x=${x?.toFixed(2)} y=${y?.toFixed(2)} z=${z?.toFixed(2)} | gMag=${gMagnitude.toFixed(2)}G | impact=${impactG.toFixed(2)}G | thresh=${THRESHOLDS[this.sensitivity]}G`);
      }
      this.checkImpact(impactG);
    } catch (err) {
      console.warn('handleNativeMotion error:', err);
    }
  };

  private handleWebMotion = (event: DeviceMotionEvent) => {
    try {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const rawMagnitude = Math.sqrt((acc.x || 0) * (acc.x || 0) + (acc.y || 0) * (acc.y || 0) + (acc.z || 0) * (acc.z || 0));
      const gMagnitude = rawMagnitude > 4.5 ? rawMagnitude / 9.81 : rawMagnitude;
      const impactG = Math.abs(gMagnitude - 1.0);
      this.checkImpact(impactG);
    } catch (err) {
      console.warn('handleWebMotion error:', err);
    }
  };

  private checkImpact(impactG: number) {
    const threshold = THRESHOLDS[this.sensitivity];
    const now = Date.now();

    if (impactG >= threshold) {
      console.log(`[MotionSensor] IMPACT DETECTED! impactG=${impactG.toFixed(2)}G >= threshold=${threshold}G`);
      if (now - this.lastImpactTime > 15000) {
        this.lastImpactTime = now;
        if (this.onFallDetectedCallback) {
          const source = impactG >= 3.5 ? 'impact_detection' : 'fall_detection';
          this.onFallDetectedCallback(source);
        }
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
