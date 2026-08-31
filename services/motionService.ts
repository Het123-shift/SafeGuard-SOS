import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

export type MotionSensitivity = 'low' | 'medium' | 'high';

const THRESHOLDS: Record<MotionSensitivity, number> = {
  low: 3.2,     // Hard collision / vehicle impact (3.2G spike)
  medium: 2.2,  // Standard fall / energetic shake (2.2G spike)
  high: 1.6,    // Sensitive shake & fall detection (1.6G spike)
};

// Tap detection configuration
const TAP_CONFIG = {
  MIN_JERK_G: 1.2,          // Minimum jerk delta between consecutive 50ms samples
  MIN_PEAK_G: 1.9,          // Minimum peak G-magnitude to qualify as a deliberate physical tap
  MIN_INTER_TAP_MS: 140,    // Refractory period: reject acoustic buzz / single tap multi-bounce (< 140ms)
  MAX_INTER_TAP_MS: 1100,   // Maximum interval between consecutive taps in sequence
  ROLLING_WINDOW_MS: 3000,  // Complete 5-tap sequence must occur within 3.0 seconds
  REQUIRED_TAP_COUNT: 5,    // 5 physical taps required
  FREE_FALL_THRESHOLD: 0.45,// Below 0.45G indicates free fall / phone drop, not a tap
};

class MotionService {
  private isListening: boolean = false;
  private sensitivity: MotionSensitivity = 'medium';
  private onFallDetectedCallback: ((source: 'fall_detection' | 'impact_detection') => void) | null = null;
  private onTapDetectedCallback: ((source: 'lock_screen_tap') => void) | null = null;
  private subscription: any = null;
  private lastImpactTime: number = 0;

  // Tap detection state
  private prevGMagnitude: number = 1.0;
  private lastSampleTime: number = 0;
  private lastTapTimestamp: number = 0;
  private tapTimestamps: number[] = [];
  private lastFreeFallTime: number = 0;
  private rhythmicStepCount: number = 0;
  private lastStepTime: number = 0;

  public setSensitivity(sensitivity: MotionSensitivity) {
    this.sensitivity = sensitivity;
  }

  public getSensitivity(): MotionSensitivity {
    return this.sensitivity;
  }

  public startListening(
    onFallDetected?: (source: 'fall_detection' | 'impact_detection') => void,
    onTapDetected?: (source: 'lock_screen_tap') => void
  ) {
    if (onFallDetected) this.onFallDetectedCallback = onFallDetected;
    if (onTapDetected) this.onTapDetectedCallback = onTapDetected;

    if (this.isListening) return;
    this.isListening = true;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', this.handleWebMotion);
      }
    } else {
      // 50ms interval (20Hz) provides optimal transient capture for sharp 60-100ms tap spikes
      Accelerometer.setUpdateInterval(50);
      this.subscription = Accelerometer.addListener(this.handleNativeMotion);
    }
  }

  public registerFallCallback(onFallDetected: (source: 'fall_detection' | 'impact_detection') => void) {
    this.startListening(onFallDetected, undefined);
  }

  public registerTapCallback(onTapDetected: (source: 'lock_screen_tap') => void) {
    this.startListening(undefined, onTapDetected);
  }

  public stopFallDetection() {
    this.stopListening();
  }

  public stopListening() {
    this.isListening = false;
    this.onFallDetectedCallback = null;
    this.onTapDetectedCallback = null;
    this.tapTimestamps = [];
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
      const rawMagnitude = Math.sqrt((x || 0) * (x || 0) + (y || 0) * (y || 0) + (z || 0) * (z || 0));
      const gMagnitude = rawMagnitude > 4.5 ? rawMagnitude / 9.81 : rawMagnitude;
      const now = Date.now();

      this.processSharedSensorData(gMagnitude, now);
    } catch (err) {
      console.warn('[MotionService] handleNativeMotion error:', err);
    }
  };

  private handleWebMotion = (event: DeviceMotionEvent) => {
    try {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const rawMagnitude = Math.sqrt((acc.x || 0) * (acc.x || 0) + (acc.y || 0) * (acc.y || 0) + (acc.z || 0) * (acc.z || 0));
      const gMagnitude = rawMagnitude > 4.5 ? rawMagnitude / 9.81 : rawMagnitude;
      const now = Date.now();

      this.processSharedSensorData(gMagnitude, now);
    } catch (err) {
      console.warn('[MotionService] handleWebMotion error:', err);
    }
  };

  /**
   * Dual-phase shared processor: evaluates both fall/impact and 5-tap lock triggers
   * from the same continuous sensor stream without competing listeners.
   */
  private processSharedSensorData(gMagnitude: number, now: number) {
    const deltaG = Math.abs(gMagnitude - this.prevGMagnitude);
    const impactG = Math.abs(gMagnitude - 1.0);

    // Track free-fall state for drop vs tap discrimination
    if (gMagnitude < TAP_CONFIG.FREE_FALL_THRESHOLD) {
      this.lastFreeFallTime = now;
    }

    // 1. Process 5-Tap Lock-Screen Trigger
    this.processTapDetection(gMagnitude, deltaG, now);

    // 2. Process Fall & Impact Detection
    this.checkImpact(impactG, now);

    this.prevGMagnitude = gMagnitude;
    this.lastSampleTime = now;
  }

  /**
   * Evaluates sharp acceleration impulse spikes to recognize deliberate 5-tap sequence
   * with anti-walking cadence discrimination and vibration suppression.
   */
  private processTapDetection(gMagnitude: number, deltaG: number, now: number) {
    // A. Detect walking cadence: repetitive low-jerk step peaks (deltaG 0.4-0.9G) at 1.2-2.2Hz
    if (deltaG >= 0.4 && deltaG < 0.9 && gMagnitude > 1.2 && gMagnitude < 1.7) {
      const stepInterval = now - this.lastStepTime;
      if (stepInterval >= 400 && stepInterval <= 800) {
        this.rhythmicStepCount++;
        this.lastStepTime = now;
      } else if (stepInterval > 1200) {
        this.rhythmicStepCount = 0;
      }
    }

    // If walking cadence is sustained (>= 4 rhythmic steps), suppress tap recognition
    const isWalking = this.rhythmicStepCount >= 4 && (now - this.lastStepTime < 1500);
    if (isWalking) {
      if (this.tapTimestamps.length > 0) {
        console.log('[MotionService] Walking motion detected -> Cleared tap sequence buffer');
        this.tapTimestamps = [];
      }
      return;
    }

    // B. Check for sharp physical tap signature
    const isTapSpike = deltaG >= TAP_CONFIG.MIN_JERK_G && gMagnitude >= TAP_CONFIG.MIN_PEAK_G;
    if (!isTapSpike) return;

    // Discard if phone was in free fall in last 400ms (indicates a drop/fall, not a tap)
    if (now - this.lastFreeFallTime < 400) {
      return;
    }

    // Enforce minimum refractory interval (reject acoustic buzzer / multi-bounce ringing)
    const timeSinceLastTap = now - this.lastTapTimestamp;
    if (timeSinceLastTap < TAP_CONFIG.MIN_INTER_TAP_MS) {
      return;
    }

    // Enforce maximum interval between taps (decay stale taps)
    if (this.tapTimestamps.length > 0 && timeSinceLastTap > TAP_CONFIG.MAX_INTER_TAP_MS) {
      this.tapTimestamps = [];
    }

    // Register valid tap spike
    this.lastTapTimestamp = now;
    this.tapTimestamps.push(now);

    // Prune taps outside rolling 3.0-second window
    this.tapTimestamps = this.tapTimestamps.filter((t) => now - t <= TAP_CONFIG.ROLLING_WINDOW_MS);

    console.log(`[MotionService] Valid Tap #${this.tapTimestamps.length}/${TAP_CONFIG.REQUIRED_TAP_COUNT} registered | deltaG=${deltaG.toFixed(2)}G | gMag=${gMagnitude.toFixed(2)}G`);

    // Check if 5-tap sequence completed
    if (this.tapTimestamps.length >= TAP_CONFIG.REQUIRED_TAP_COUNT) {
      console.log('🚨 [MotionService] 5-TAP LOCK SCREEN TRIGGER ACTIVATED! Routing to SOS...');
      this.tapTimestamps = [];
      if (this.onTapDetectedCallback) {
        this.onTapDetectedCallback('lock_screen_tap');
      }
    }
  }

  private checkImpact(impactG: number, now: number) {
    const threshold = THRESHOLDS[this.sensitivity];

    if (impactG >= threshold) {
      if (now - this.lastImpactTime > 15000) {
        this.lastImpactTime = now;
        console.log(`[MotionService] IMPACT DETECTED! impactG=${impactG.toFixed(2)}G >= threshold=${threshold}G`);
        if (this.onFallDetectedCallback) {
          const source = impactG >= 3.5 ? 'impact_detection' : 'fall_detection';
          this.onFallDetectedCallback(source);
        }
      }
    }
  }

  /**
   * Test Harness Simulation: simulates 5 deliberate physical taps with realistic intervals.
   */
  public simulate5Taps() {
    console.log('[MotionService] Simulating 5 physical taps in rolling window...');
    let count = 0;
    const interval = setInterval(() => {
      count++;
      const now = Date.now();
      this.processSharedSensorData(2.8, now); // 2.8G tap spike
      if (count >= 5) {
        clearInterval(interval);
      }
    }, 280);
  }

  // Simulated fall for testing
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

