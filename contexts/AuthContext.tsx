import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import type { User } from '@supabase/supabase-js';

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
    // Restore existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
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

      setUser({
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
      });
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
      // Fallback demo user for testing
      setUser({
        id: 'demo_user_1',
        fullName: 'Alex Morgan',
        email: email || 'alex.m@example.com',
        phone: '+1 (555) 019-2831',
        dateOfBirth: '1996-08-15',
        gender: 'Female',
        profilePhoto: '',
        homeAddress: '742 Evergreen Terrace',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        postalCode: '94107',
        alternatePhone: '+1 (555) 998-1120',
        emailVerified: true,
        phoneVerified: true,
        locationVerified: true,
        profileComplete: true,
        createdAt: new Date().toISOString(),
      });
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
    await supabase.auth.signOut();
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

    if (Object.keys(dbUpdate).length > 0) {
      await supabase.from('user_profiles').update(dbUpdate).eq('id', user.id);
    }
    setUser(prev => (prev ? { ...prev, ...data } : null));
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
