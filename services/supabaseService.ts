import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ApiService } from './apiService';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const USE_SELF_HOSTED = process.env.EXPO_PUBLIC_USE_SELF_HOSTED_BACKEND === 'true';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
  }
}

export interface SMSContactResult {
  phone: string;
  status: 'sent' | 'failed' | 'cooldown_suppressed';
  messageSid?: string;
  error?: string;
}

export interface SendSMSResponse {
  success: boolean;
  results: SMSContactResult[];
  error?: string;
}

export const SupabaseService = {
  isConfigured(): boolean {
    return !!supabase || USE_SELF_HOSTED;
  },

  getClient(): SupabaseClient | null {
    return supabase;
  },

  // Server-enforced PIN verification
  async verifyServerVaultPin(inputPin: string): Promise<any | null> {
    if (USE_SELF_HOSTED) {
      try {
        const res = await ApiService.verifyVaultPin(inputPin);
        return res;
      } catch (err: any) {
        if (err.status === 423) {
          return err.data || { is_locked_out: true, remaining_seconds: 300 };
        }
        console.warn('[ApiService] verifyVaultPin error:', err);
      }
    }

    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('verify_vault_pin', { p_pin: inputPin });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase verifyServerVaultPin offline fallback:', err);
      return null;
    }
  },

  // Server-side PIN setup
  async setServerVaultPin(newPin: string): Promise<boolean> {
    if (USE_SELF_HOSTED) {
      try {
        const res = await ApiService.setVaultPin(newPin);
        return !!res.success;
      } catch (err) {
        console.warn('[ApiService] setVaultPin error:', err);
      }
    }

    if (!supabase) return false;
    try {
      const { data, error } = await supabase.rpc('set_vault_pin', { p_pin: newPin });
      if (error) throw error;
      return !!data?.success;
    } catch (err) {
      console.warn('Supabase setServerVaultPin offline fallback:', err);
      return false;
    }
  },

  // Invoke send-sos-sms with retry logic & per-contact delivery status
  async sendSOSEmergencySMS(
    userName: string,
    latitude: number,
    longitude: number,
    contactPhones: string[],
    userId?: string,
    trackingUrl?: string
  ): Promise<SendSMSResponse> {
    if (USE_SELF_HOSTED) {
      try {
        const res = await ApiService.sendSOSEmergencySMS({
          userName,
          latitude,
          longitude,
          contactPhones,
          trackingUrl,
        });
        return res;
      } catch (err: any) {
        console.warn('[ApiService] sendSOSEmergencySMS fallback to Supabase:', err);
      }
    }

    if (!supabase) {
      return {
        success: false,
        results: contactPhones.map((phone) => ({
          phone,
          status: 'failed',
          error: 'Backend client not initialized',
        })),
        error: 'Backend client not configured',
      };
    }

    const payload = { userId, userName, latitude, longitude, contactPhones, trackingUrl };
    let attempt = 0;
    const maxRetries = 2;

    while (attempt <= maxRetries) {
      try {
        const { data, error } = await supabase.functions.invoke('send-sos-sms', {
          body: payload,
        });

        if (error) throw new Error(error.message || 'Edge function error');

        if (data && typeof data === 'object') {
          return {
            success: !!data.success,
            results: data.results || [],
            error: data.error,
          };
        }
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries) {
          return {
            success: false,
            results: contactPhones.map((phone) => ({
              phone,
              status: 'failed',
              error: err.message || 'Network invocation failure after 2 retries',
            })),
            error: err.message || 'Network invocation failure',
          };
        }
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 250));
      }
    }

    return {
      success: false,
      results: contactPhones.map((phone) => ({
        phone,
        status: 'failed',
        error: 'Unknown dispatch failure',
      })),
    };
  },

  // Sync contacts
  async syncContacts(contacts: any[]): Promise<boolean> {
    if (USE_SELF_HOSTED) {
      try {
        for (const contact of contacts) {
          await ApiService.addContact(contact);
        }
        return true;
      } catch (err) {
        console.warn('[ApiService] syncContacts error:', err);
      }
    }

    if (!supabase) return false;
    try {
      const { error } = await supabase.from('contacts').upsert(contacts);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase syncContacts error:', err);
      return false;
    }
  },

  // Log SOS event
  async logSOSEvent(event: any): Promise<boolean> {
    if (USE_SELF_HOSTED) {
      try {
        await ApiService.triggerSOS({
          latitude: event.latitude || 0,
          longitude: event.longitude || 0,
          address: event.location || '',
          triggerType: event.trigger_type || 'manual',
        });
        return true;
      } catch (err) {
        console.warn('[ApiService] logSOSEvent error:', err);
      }
    }

    if (!supabase) return false;
    try {
      const { error } = await supabase.from('sos_events').insert([event]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase logSOSEvent error:', err);
      return false;
    }
  },

  // Upload Evidence file
  async uploadEvidenceFile(fileBlob: Blob, fileName: string, userId: string = 'default'): Promise<string | null> {
    if (USE_SELF_HOSTED) {
      try {
        const { uploadUrl, filePath } = await ApiService.getEvidenceUploadUrl(fileName, fileBlob.type || 'application/octet-stream');
        await fetch(uploadUrl, {
          method: 'PUT',
          body: fileBlob,
          headers: { 'Content-Type': fileBlob.type || 'application/octet-stream' },
        });
        await ApiService.saveEvidenceRecord({
          name: fileName,
          filePath,
          mimeType: fileBlob.type || 'application/octet-stream',
          fileSizeBytes: fileBlob.size,
        });
        return filePath;
      } catch (err) {
        console.warn('[ApiService] uploadEvidenceFile error:', err);
      }
    }

    if (!supabase) return null;
    try {
      const filePath = `${userId}/${Date.now()}_${fileName}.enc`;
      const { data, error } = await supabase.storage.from('evidence').upload(filePath, fileBlob);
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('evidence').getPublicUrl(data.path);
      return publicUrlData?.publicUrl || null;
    } catch (err) {
      console.warn('Supabase uploadEvidenceFile error:', err);
      return null;
    }
  },

  // Upsert live location
  async upsertLiveLocation(
    sosEventId: string,
    latitude: number,
    longitude: number,
    isActive: boolean = true,
    expiresAt?: string
  ): Promise<boolean> {
    if (USE_SELF_HOSTED) {
      try {
        await ApiService.updateLiveLocation(sosEventId, latitude, longitude, isActive);
        return true;
      } catch (err) {
        console.warn('[ApiService] upsertLiveLocation error:', err);
      }
    }

    if (!supabase) return false;
    try {
      const now = new Date();
      const expirationDate = expiresAt || new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
      const payload: Record<string, any> = {
        sos_event_id: sosEventId,
        latitude,
        longitude,
        updated_at: now.toISOString(),
        is_active: isActive,
        expires_at: expirationDate,
      };
      const { error } = await supabase.from('live_locations').upsert(payload, { onConflict: 'sos_event_id' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('Supabase upsertLiveLocation error:', err);
      return false;
    }
  },

  // Get current live location
  async getLiveLocation(sosEventId: string): Promise<any | null> {
    if (USE_SELF_HOSTED) {
      try {
        const data = await ApiService.getTrackingSnapshot(sosEventId);
        if (data) return data;
      } catch (err) {
        console.warn('[ApiService] getLiveLocation error:', err);
      }
    }

    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .eq('sos_event_id', sosEventId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (err) {
      console.warn('Supabase getLiveLocation error:', err);
      return null;
    }
  },

  // Subscribe to real-time changes
  subscribeToLiveLocation(sosEventId: string, onUpdate: (data: any) => void) {
    if (!supabase) return () => {};

    const channel = supabase
      .channel(`live-location-${sosEventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
          filter: `sos_event_id=eq.${sosEventId}`,
        },
        (payload) => {
          if (payload.new) {
            onUpdate(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  },
};
