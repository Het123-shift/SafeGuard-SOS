import React, { useCallback } from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, Radius, Spacing } from '@/constants/theme';

interface SafeButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const SafeButton = React.memo(function SafeButton({
  label, onPress, variant = 'primary', size = 'md', disabled, loading, fullWidth, style, textStyle,
}: SafeButtonProps) {
  const handlePress = useCallback(() => {
    if (!disabled && !loading) onPress();
  }, [disabled, loading, onPress]);

  const btnStyle = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style,
  ];

  const txtStyle = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    textStyle,
  ];

  return (
    <Pressable
      style={({ pressed }) => [...btnStyle, pressed && styles.pressed]}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {loading
        ? <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.textInverse} />
        : <Text style={txtStyle}>{label}</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 0,
  },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },

  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.secondary },
  danger: { backgroundColor: Colors.danger },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  ghost: { backgroundColor: 'transparent' },

  size_sm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 36 },
  size_md: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, minHeight: 48 },
  size_lg: { paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.base, minHeight: 56 },

  text: { ...Typography.button, textAlign: 'center' },
  text_primary: { color: Colors.textInverse },
  text_secondary: { color: Colors.textInverse },
  text_danger: { color: Colors.textInverse },
  text_outline: { color: Colors.primary },
  text_ghost: { color: Colors.primary },

  textSize_sm: { fontSize: 14 },
  textSize_md: { fontSize: 16 },
  textSize_lg: { fontSize: 17 },
});
