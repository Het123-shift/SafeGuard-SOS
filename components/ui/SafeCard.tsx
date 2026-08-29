import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

interface SafeCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'flat' | 'danger' | 'success';
  padding?: number;
}

export const SafeCard = React.memo(function SafeCard({ children, style, variant = 'default', padding }: SafeCardProps) {
  return (
    <View style={[styles.base, styles[variant], padding !== undefined && { padding }, style]}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.xl,
    padding: Spacing.base,
    backgroundColor: Colors.surface,
  },
  default: {
    ...Shadows.card,
    backgroundColor: Colors.surface,
  },
  elevated: {
    ...Shadows.md,
    backgroundColor: Colors.surface,
  },
  flat: {
    backgroundColor: Colors.surfaceAlt,
  },
  danger: {
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  success: {
    backgroundColor: Colors.successSurface,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
});
