import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@safeguard_jwt_access_token';
const REFRESH_TOKEN_KEY = '@safeguard_jwt_refresh_token';

const getBackendUrl = (): string => {
  const customUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (customUrl && customUrl.trim() !== '') {
    return customUrl.trim().replace(/\/$/, '');
  }
  return 'http://localhost:4000';
};

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export const ApiService = {
  getBaseUrl(): string {
    return getBackendUrl();
  },

  async getAccessToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  async clearTokens(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (!options.skipAuth) {
      const token = await this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized with automatic refresh token rotation
    if (response.status === 401 && !options.skipAuth) {
      const refreshToken = await this.getRefreshToken();
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.tokens) {
              await this.setTokens(refreshData.tokens.accessToken, refreshData.tokens.refreshToken);
              headers['Authorization'] = `Bearer ${refreshData.tokens.accessToken}`;
              response = await fetch(url, { ...options, headers });
            }
          } else {
            await this.clearTokens();
          }
        } catch {
          await this.clearTokens();
        }
      }
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMsg = data.error || `HTTP Error ${response.status}: ${response.statusText}`;
      const err = new Error(errorMsg);
      (err as any).status = response.status;
      (err as any).data = data;
      throw err;
    }

    return data as T;
  },

  // Auth
  async register(payload: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
    homeAddress?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  }) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
    if (res.tokens) {
      await this.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    }
    return res;
  },

  async login(email: string, password: string) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    if (res.tokens) {
      await this.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    }
    return res;
  },

  async sendEmailOTP(email: string) {
    return this.request<{ success: boolean; message: string; expiresInSeconds: number }>('/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  },

  async verifyEmailOTP(email: string, otp: string) {
    const res = await this.request<{ success: boolean; user: any; tokens: { accessToken: string; refreshToken: string } }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
      skipAuth: true,
    });
    if (res.tokens) {
      await this.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    }
    return res;
  },

  async logout() {
    const refreshToken = await this.getRefreshToken();
    if (refreshToken) {
      try {
        await this.request('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
          skipAuth: true,
        });
      } catch {}
    }
    await this.clearTokens();
  },

  // Profile
  async getProfile() {
    return await this.request('/api/profile');
  },

  async updateProfile(data: any) {
    return await this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Contacts
  async getContacts() {
    return await this.request('/api/contacts');
  },

  async addContact(contact: any) {
    return await this.request('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  },

  async updateContact(id: string, contact: any) {
    return await this.request(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contact),
    });
  },

  async removeContact(id: string) {
    return await this.request(`/api/contacts/${id}`, {
      method: 'DELETE',
    });
  },

  // Vault PIN
  async setVaultPin(pin: string) {
    return await this.request('/api/vault/pin/set', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  async verifyVaultPin(pin: string) {
    return await this.request('/api/vault/pin/verify', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  async getVaultPinStatus() {
    return await this.request('/api/vault/pin/status');
  },

  // SOS Events
  async triggerSOS(payload: {
    latitude: number;
    longitude: number;
    address?: string;
    triggerType?: string;
    contactPhones?: string[];
  }) {
    return await this.request('/api/sos/trigger', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getSOSEvents() {
    return await this.request('/api/sos/events');
  },

  async resolveSOSEvent(id: string) {
    return await this.request(`/api/sos/events/${id}/resolve`, {
      method: 'PUT',
    });
  },

  async updateLiveLocation(id: string, latitude: number, longitude: number, isActive: boolean = true) {
    return await this.request(`/api/sos/events/${id}/location`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, isActive }),
    });
  },

  // Evidence
  async getEvidenceUploadUrl(fileName: string, contentType: string = 'application/octet-stream') {
    return await this.request('/api/evidence/upload-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, contentType }),
    });
  },

  async saveEvidenceRecord(record: { name: string; filePath: string; mimeType: string; fileSizeBytes?: number; sosEventId?: string }) {
    return await this.request('/api/evidence', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  async getEvidenceList() {
    return await this.request('/api/evidence');
  },

  async getEvidenceDownloadUrl(id: string) {
    return await this.request(`/api/evidence/${id}/download-url`);
  },

  async deleteEvidence(id: string) {
    return await this.request(`/api/evidence/${id}`, {
      method: 'DELETE',
    });
  },

  // SMS
  async sendSOSEmergencySMS(payload: {
    userName: string;
    latitude: number;
    longitude: number;
    contactPhones: string[];
    trackingUrl?: string;
  }) {
    return await this.request('/api/sms/send-sos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async sendOTP(phone: string, code: string) {
    return await this.request('/api/sms/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
      skipAuth: true,
    });
  },

  // Tracking snapshot
  async getTrackingSnapshot(sosId: string, token?: string) {
    const queryStr = token ? `?token=${encodeURIComponent(token)}` : '';
    return await this.request(`/api/track/${sosId}${queryStr}`, {
      skipAuth: true,
    });
  },
};
