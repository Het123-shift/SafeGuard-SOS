// @ts-nocheck
// Supabase configuration
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Auth module configuration
export interface AuthConfig {
  enabled?: boolean;
  profileTableName?: string;
  autoCreateProfile?: boolean;
}

// Future module configuration interfaces
export interface PaymentsConfig {
  enabled?: boolean;
  stripePublishableKey?: string;
}

export interface StorageConfig {
  enabled?: boolean;
  defaultBucket?: string;
}

// Module configuration union type
export interface ModuleConfig {
  auth?: AuthConfig | false;
  payments?: PaymentsConfig | false;
  storage?: StorageConfig | false;
}

// Main configuration interface
export interface AppConfig extends ModuleConfig {
  supabase: SupabaseConfig;
}

export type OnSpaceConfig = AppConfig;

// Runtime state
export interface SDKState {
  initialized: boolean;
  enabledModules: string[];
  config: AppConfig;
}

// Error type
export interface AppError {
  code: string;
  message: string;
  module?: string;
  details?: any;
}

export type OnSpaceError = AppError;