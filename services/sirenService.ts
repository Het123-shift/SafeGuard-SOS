import { Platform } from 'react-native';

class SirenService {
  private audioCtx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isSirenActive: boolean = false;
  private isMuted: boolean = false;
  private sirenTimer: any = null;

  public startSiren() {
    if (this.isSirenActive || Platform.OS !== 'web') return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.isMuted ? 0 : 0.4;
      this.gainNode.connect(this.audioCtx.destination);

      this.osc1 = this.audioCtx.createOscillator();
      this.osc2 = this.audioCtx.createOscillator();

      this.osc1.type = 'sawtooth';
      this.osc2.type = 'sine';

      this.osc1.connect(this.gainNode);
      this.osc2.connect(this.gainNode);

      this.osc1.start();
      this.osc2.start();

      let freq = 700;
      let goingUp = true;

      this.sirenTimer = setInterval(() => {
        if (!this.osc1 || !this.osc2) return;
        if (goingUp) {
          freq += 30;
          if (freq >= 1200) goingUp = false;
        } else {
          freq -= 30;
          if (freq <= 700) goingUp = true;
        }
        this.osc1.frequency.value = freq;
        this.osc2.frequency.value = freq * 1.2;
      }, 30);

      this.isSirenActive = true;
    } catch (e) {
      console.warn('Could not start web AudioContext siren:', e);
    }
  }

  public stopSiren() {
    if (this.sirenTimer) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
    try {
      if (this.osc1) {
        this.osc1.stop();
        this.osc1.disconnect();
        this.osc1 = null;
      }
      if (this.osc2) {
        this.osc2.stop();
        this.osc2.disconnect();
        this.osc2 = null;
      }
      if (this.audioCtx) {
        this.audioCtx.close();
        this.audioCtx = null;
      }
    } catch (e) {
      console.warn('Error stopping siren:', e);
    }
    this.isSirenActive = false;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(muted ? 0 : 0.4, this.audioCtx.currentTime);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsActive(): boolean {
    return this.isSirenActive;
  }
}

export const sirenService = new SirenService();
