import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export interface RecordedAudioResult {
  uri: string;
  blob?: Blob;
  mimeType: string;
  durationSeconds: number;
}

class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private nativeRecording: Audio.Recording | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private isRecordingAudio: boolean = false;

  public async startRecording(): Promise<boolean> {
    if (this.isRecordingAudio) return true;
    this.startTime = Date.now();

    if (Platform.OS === 'web') {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          console.warn('[AudioService] Web Audio recording not supported in this environment');
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

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.start(500);
        this.isRecordingAudio = true;
        console.log('[AudioService] Web audio recording started successfully.');
        return true;
      } catch (err) {
        console.warn('[AudioService] Web audio recording start warning:', err);
        this.isRecordingAudio = false;
        return false;
      }
    } else {
      // Native Android / iOS via expo-av
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[AudioService] RECORD_AUDIO permission not granted on device.');
          return false;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        this.nativeRecording = recording;
        this.isRecordingAudio = true;
        console.log('[AudioService] Native emergency audio recording started successfully.');
        return true;
      } catch (err) {
        console.warn('[AudioService] Native audio recording start warning:', err);
        this.isRecordingAudio = false;
        return false;
      }
    }
  }

  public async stopRecording(): Promise<RecordedAudioResult | null> {
    if (!this.isRecordingAudio) return null;
    const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

    if (Platform.OS === 'web') {
      if (!this.mediaRecorder) return null;
      return new Promise((resolve) => {
        this.mediaRecorder!.onstop = () => {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mimeType });
          const uri = URL.createObjectURL(blob);

          if (this.mediaRecorder?.stream) {
            this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
          }

          this.isRecordingAudio = false;
          this.mediaRecorder = null;
          this.audioChunks = [];

          resolve({ uri, blob, mimeType, durationSeconds });
        };

        try {
          this.mediaRecorder!.stop();
        } catch {
          resolve(null);
        }
      });
    } else {
      try {
        if (!this.nativeRecording) return null;
        await this.nativeRecording.stopAndUnloadAsync();
        const uri = this.nativeRecording.getURI() || '';
        this.nativeRecording = null;
        this.isRecordingAudio = false;
        console.log(`[AudioService] Native recording stopped. File URI: ${uri}, Duration: ${durationSeconds}s`);
        return { uri, mimeType: 'audio/m4a', durationSeconds };
      } catch (err) {
        console.warn('[AudioService] Error stopping native recording:', err);
        this.nativeRecording = null;
        this.isRecordingAudio = false;
        return null;
      }
    }
  }

  public getIsRecording(): boolean {
    return this.isRecordingAudio;
  }
}

export const webAudioService = new AudioRecordingService();
export const audioRecordingService = webAudioService;

