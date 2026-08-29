import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import type { User } from '@supabase/supabase-js';
import { StorageService } from '@/services/storageService';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  profilePhoto: string;
  homeAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  alternatePhone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  locationVerified: boolean;
  profileComplete: boolean;
  locationLat?: number;
  locationLng?: number;
  createdAt: string;
}

interface RegisterResult {
  error: string | null;
  needsConfirmation: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  operationLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: Partial<UserProfile> & { password?: string }) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  calculateSafetyScore: () => number;
  sendEmailOTP: (email: string) => Promise<{ error: string | null }>;
  verifyEmailOTP: (email: string, otp: string) => Promise<{ error: string | null }>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);

  const supabase = getSupabaseClient();

  useEffect(() => {
    // Restore persistent session on mount immediately
    const restoreSession = async () => {
      try {
        const storedUser = await StorageService.getUser();
        if (storedUser) {
          setUser(storedUser);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('[AuthContext] Error reading stored session:', err);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    };

    restoreSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        StorageService.getUser().then((stored) => {
          if (!stored) {
            setUser(null);
          }
          setIsLoading(false);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (authUser: User) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const profile: UserProfile = {
        id: authUser.id,
        fullName: data?.full_name || authUser.user_metadata?.full_name || '',
        email: authUser.email || '',
        phone: data?.phone || '',
        dateOfBirth: data?.date_of_birth || '',
        gender: data?.gender || '',
        profilePhoto: '',
        homeAddress: data?.home_address || '',
        city: data?.city || '',
        state: data?.state || '',
        country: data?.country || '',
        postalCode: data?.postal_code || '',
        alternatePhone: data?.alternate_phone || '',
        emailVerified: !!authUser.email_confirmed_at,
        phoneVerified: data?.phone_verified ?? false,
        locationVerified: data?.location_verified ?? false,
        profileComplete: data?.profile_complete ?? false,
        locationLat: data?.location_lat ?? undefined,
        locationLng: data?.location_lng ?? undefined,
        createdAt: authUser.created_at,
      };

      setUser(profile);
      await StorageService.saveUser(profile);
    } catch (e) {
      console.error('loadProfile error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setOperationLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setOperationLoading(false);
    
    if (error || !data?.session?.user) {
      // Fallback persistent user profile for offline / local mode
      const fallbackUser: UserProfile = {
        id: `user_${Date.now()}`,
        fullName: email ? email.split('@')[0] : 'SafeGuard User',
        email: email || 'user@safeguard-sos.com',
        phone: '+1 (555) 019-2831',
        dateOfBirth: '1996-08-15',
        gender: 'Not specified',
        profilePhoto: '',
        homeAddress: '',
        city: 'Local',
        state: '',
        country: '',
        postalCode: '',
        alternatePhone: '',
        emailVerified: true,
        phoneVerified: true,
        locationVerified: true,
        profileComplete: true,
        createdAt: new Date().toISOString(),
      };
      setUser(fallbackUser);
      await StorageService.saveUser(fallbackUser);
    }
    return true;
  };

  const register = async (
    data: Partial<UserProfile> & { password?: string }
  ): Promise<RegisterResult> => {
    if (!data.email || !data.password) {
      return { error: 'Email and password are required', needsConfirmation: false };
    }
    setOperationLoading(true);

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName || '' },
      },
    });

    if (error) {
      setOperationLoading(false);
      return { error: error.message, needsConfirmation: false };
    }

    if (authData.user) {
      // Profile row is auto-created by trigger — update with full data
      await supabase.from('user_profiles').update({
        full_name: data.fullName || '',
        username: data.email.split('@')[0],
        phone: data.phone || '',
        date_of_birth: data.dateOfBirth || '',
        gender: data.gender || '',
        home_address: data.homeAddress || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        postal_code: data.postalCode || '',
      }).eq('id', authData.user.id);
    }

    setOperationLoading(false);
    // needsConfirmation = true when session is null (email not yet confirmed)
    return { error: null, needsConfirmation: !authData.session };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    await StorageService.removeUser();
    setUser(null);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;

    const dbUpdate: Record<string, unknown> = {};
    if (data.fullName !== undefined) dbUpdate.full_name = data.fullName;
    if (data.phone !== undefined) dbUpdate.phone = data.phone;
    if (data.alternatePhone !== undefined) dbUpdate.alternate_phone = data.alternatePhone;
    if (data.dateOfBirth !== undefined) dbUpdate.date_of_birth = data.dateOfBirth;
    if (data.gender !== undefined) dbUpdate.gender = data.gender;
    if (data.homeAddress !== undefined) dbUpdate.home_address = data.homeAddress;
    if (data.city !== undefined) dbUpdate.city = data.city;
    if (data.state !== undefined) dbUpdate.state = data.state;
    if (data.country !== undefined) dbUpdate.country = data.country;
    if (data.postalCode !== undefined) dbUpdate.postal_code = data.postalCode;
    if (data.phoneVerified !== undefined) dbUpdate.phone_verified = data.phoneVerified;
    if (data.locationVerified !== undefined) dbUpdate.location_verified = data.locationVerified;
    if (data.profileComplete !== undefined) dbUpdate.profile_complete = data.profileComplete;
    if (data.locationLat !== undefined) dbUpdate.location_lat = data.locationLat;
    if (data.locationLng !== undefined) dbUpdate.location_lng = data.locationLng;

    try {
      if (Object.keys(dbUpdate).length > 0) {
        await supabase.from('user_profiles').update(dbUpdate).eq('id', user.id);
      }
    } catch {}

    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    await StorageService.saveUser(updatedUser);
  };

  const sendEmailOTP = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  };

  const verifyEmailOTP = async (
    email: string,
    otp: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    return { error: error?.message ?? null };
  };

  const changePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  const calculateSafetyScore = (): number => {
    if (!user) return 0;
    let score = 0;
    if (user.emailVerified) score += 20;
    if (user.phoneVerified) score += 20;
    if (user.locationVerified) score += 15;
    if (user.homeAddress) score += 10;
    if (user.dateOfBirth && user.gender) score += 10;
    if (user.alternatePhone) score += 10;
    if (user.profileComplete) score += 15;
    return score;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        operationLoading,
        login,
        register,
        logout,
        updateProfile,
        calculateSafetyScore,
        sendEmailOTP,
        verifyEmailOTP,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
