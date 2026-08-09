import { Platform } from 'react-native';

export interface RecordedAudioResult {
  uri: string;
  blob?: Blob;
  mimeType: string;
  durationSeconds: number;
}

class WebAudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private isRecordingAudio: boolean = false;

  public async isSupported(): Promise<boolean> {
    if (Platform.OS !== 'web') return false;
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  public async startRecording(): Promise<boolean> {
    if (this.isRecordingAudio) return true;
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        console.warn('Web Audio recording not supported in this environment');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? { mimeType: 'audio/mp4' }
        : undefined;

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(500);
      this.isRecordingAudio = true;
      return true;
    } catch (err) {
      console.error('Failed to start web audio recording:', err);
      this.isRecordingAudio = false;
      return false;
    }
  }

  public async stopRecording(): Promise<RecordedAudioResult | null> {
    if (!this.mediaRecorder || !this.isRecordingAudio) return null;

    return new Promise((resolve) => {
      const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

      this.mediaRecorder!.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const uri = URL.createObjectURL(blob);

        // Stop all audio tracks to release microphone
        if (this.mediaRecorder?.stream) {
          this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        }

        this.isRecordingAudio = false;
        this.mediaRecorder = null;
        this.audioChunks = [];

        resolve({
          uri,
          blob,
          mimeType,
          durationSeconds,
        });
      };

      this.mediaRecorder!.stop();
    });
  }

  public getIsRecording(): boolean {
    return this.isRecordingAudio;
  }
}

export const webAudioService = new WebAudioService();
