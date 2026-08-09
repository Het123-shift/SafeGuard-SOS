import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing } from '@/constants/theme';

interface SafeInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof MaterialIcons.glyphMap;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export const SafeInput = React.memo(function SafeInput({
  label, error, leftIcon, rightIcon, onRightIconPress, containerStyle, isPassword, ...props
}: SafeInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, isFocused && styles.focused, error ? styles.errorBorder : null]}>
        {leftIcon ? (
          <MaterialIcons name={leftIcon} size={20} color={isFocused ? Colors.primary : Colors.textTertiary} style={styles.leftIcon} />
        ) : null}
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword ? (
          <Pressable onPress={() => setShowPassword(v => !v)} style={styles.rightIcon}>
            <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={Colors.textTertiary} />
          </Pressable>
        ) : rightIcon ? (
          <Pressable onPress={onRightIconPress} style={styles.rightIcon}>
            <MaterialIcons name={rightIcon} size={20} color={Colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.base },
  label: { ...Typography.label, color: Colors.text, marginBottom: Spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
  },
  focused: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  errorBorder: { borderColor: Colors.danger },
  leftIcon: { marginRight: Spacing.sm },
  rightIcon: { marginLeft: Spacing.sm, padding: 4 },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  error: { ...Typography.caption, color: Colors.danger, marginTop: 4 },
});
