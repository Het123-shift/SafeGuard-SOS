// SafeGuard SOS Design Tokens
export const Colors = {
  primary: '#FF2D2D',
  primaryDark: '#CC0000',
  primaryLight: '#FF6B6B',
  primarySurface: '#FFF0F0',

  secondary: '#3B82F6',
  secondaryDark: '#1D4ED8',
  secondaryLight: '#93C5FD',
  secondarySurface: '#EFF6FF',

  success: '#22C55E',
  successDark: '#15803D',
  successLight: '#86EFAC',
  successSurface: '#F0FDF4',

  warning: '#F97316',
  warningDark: '#C2410C',
  warningSurface: '#FFF7ED',

  danger: '#EF4444',
  dangerSurface: '#FEF2F2',

  background: '#F8F9FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  surfaceCard: '#FFFFFF',

  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#E5E7EB',

  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.15)',

  sosRed: '#FF2D2D',
  sosGlow: 'rgba(255,45,45,0.3)',
  sosPulse: 'rgba(255,45,45,0.15)',

  gradient: {
    emergency: ['#FF2D2D', '#CC0000'],
    safe: ['#22C55E', '#15803D'],
    dark: ['#1F2937', '#111827'],
    surface: ['#FFFFFF', '#F8F9FC'],
  },
};

export const Typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  h4: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  bodyLarge: { fontSize: 17, fontWeight: '400' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '500' as const, lineHeight: 20 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  buttonSmall: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  sos: {
    shadowColor: '#FF2D2D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
};
