import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

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
  status: 'sent' | 'failed';
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
    return !!supabase;
  },

  getClient(): SupabaseClient | null {
    return supabase;
  },

  // Server-enforced PIN verification via Postgres RPC
  async verifyServerVaultPin(inputPin: string): Promise<any | null> {
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

  // Server-side PIN setup via Postgres RPC
  async setServerVaultPin(newPin: string): Promise<boolean> {
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

  // Invoke send-sos-sms Edge Function with retry logic & per-contact delivery status
  async sendSOSEmergencySMS(
    userName: string,
    latitude: number,
    longitude: number,
    contactPhones: string[],
    userId?: string,
    trackingUrl?: string
  ): Promise<SendSMSResponse> {
    if (!supabase) {
      console.error('[sendSOSEmergencySMS] Supabase client is null/unconfigured. SUPABASE_URL:', SUPABASE_URL);
      return {
        success: false,
        results: contactPhones.map((phone) => ({
          phone,
          status: 'failed',
          error: 'Supabase client not initialized',
        })),
        error: 'Supabase client not configured',
      };
    }

    const payload = { userId, userName, latitude, longitude, contactPhones, trackingUrl };
    let attempt = 0;
    const maxRetries = 2;

    console.log('[sendSOSEmergencySMS] Preparing to invoke "send-sos-sms". Configured SUPABASE_URL:', SUPABASE_URL);
    console.log('[sendSOSEmergencySMS] Full Payload:', JSON.stringify(payload, null, 2));

    while (attempt <= maxRetries) {
      try {
        console.log(`[sendSOSEmergencySMS] Invoking function (Attempt ${attempt + 1}/${maxRetries + 1})...`);
        
        const { data, error } = await supabase.functions.invoke('send-sos-sms', {
          body: payload,
        });

        console.log('[sendSOSEmergencySMS] RAW invoke response - data:', data);
        console.log('[sendSOSEmergencySMS] RAW invoke response - error:', error);

        if (error) {
          console.error('[sendSOSEmergencySMS] Function invocation returned an error:', error);
          throw new Error(error.message || `Edge function error: ${JSON.stringify(error)}`);
        }

        if (data && typeof data === 'object') {
          console.log('[sendSOSEmergencySMS] Function returned data:', data);
          return {
            success: !!data.success,
            results: data.results || [],
            error: data.error,
          };
        }
      } catch (err: any) {
        console.error(`[sendSOSEmergencySMS] Catch block triggered on attempt ${attempt + 1}:`, err);
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
        // Exponential backoff delay (500ms, 1000ms)
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

  // Sync contacts to Supabase
  async syncContacts(contacts: any[]): Promise<boolean> {
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

  // Log SOS event to Supabase DB
  async logSOSEvent(event: any): Promise<boolean> {
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

  // Upload Evidence file blob to Supabase storage bucket
  async uploadEvidenceFile(fileBlob: Blob, fileName: string, userId: string = 'default'): Promise<string | null> {
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

  // Upsert live location row for an active SOS event
  async upsertLiveLocation(sosEventId: string, latitude: number, longitude: number, isActive: boolean = true): Promise<boolean> {
    if (!supabase) return false;
    try {
      const payload = {
        sos_event_id: sosEventId,
        latitude,
        longitude,
        updated_at: new Date().toISOString(),
        is_active: isActive,
      };
      const { error } = await supabase.from('live_locations').upsert(payload, { onConflict: 'sos_event_id' });
      if (error) throw error;
      console.log(`[SupabaseService] Upserted live location for ${sosEventId}:`, { latitude, longitude, isActive });
      return true;
    } catch (err) {
      console.warn('Supabase upsertLiveLocation error:', err);
      return false;
    }
  },

  // Get current live location for an SOS event
  async getLiveLocation(sosEventId: string): Promise<any | null> {
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

  // Subscribe to real-time changes on live_locations for a specific SOS event
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
          console.log('[SupabaseService] Realtime live_locations payload received:', payload);
          if (payload.new) {
            onUpdate(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[SupabaseService] Realtime channel status for ${sosEventId}:`, status);
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  },
};
