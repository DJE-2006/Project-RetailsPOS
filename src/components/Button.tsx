// Core button component with variants and sizes
// Primary: main CTAs like checkout, sign in, save
// Secondary: cancel, neutral actions
// Destructive: danger actions like delete
// Success: confirm/complete actions
// Accent: highlight CTAs
// Sizes: sm (40px) · md (46px) · lg (54px)
import React from 'react';
import {
  Text, StyleSheet, ActivityIndicator, View,
  StyleProp, ViewStyle, TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { PressScale } from '../utils/motion';

type Variant = 'primary' | 'secondary' | 'destructive' | 'success' | 'accent';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const HEIGHTS: Record<Size, number> = { sm: 40, md: 46, lg: 54 };
const FONT_SIZE: Record<Size, number> = { sm: FONTS.sizes.sm, md: FONTS.sizes.md, lg: FONTS.sizes.md };
const ICON_SIZE: Record<Size, number> = { sm: 16, md: 18, lg: 20 };

// Color & style config for each variant
const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string; shadow: boolean }> = {
  primary:     { bg: COLORS.primary, fg: COLORS.white,      shadow: true },
  success:     { bg: COLORS.success, fg: COLORS.white,      shadow: true },
  accent:      { bg: COLORS.accent,  fg: COLORS.textOnAccent, shadow: true },
  secondary:   { bg: COLORS.surface, fg: COLORS.textSecond, border: COLORS.border, shadow: false },
  destructive: { bg: COLORS.surface, fg: COLORS.danger,     border: COLORS.danger, shadow: false },
};

export default function Button({
  title, onPress, variant = 'primary', size = 'md',
  icon, iconRight, loading = false, disabled = false,
  fullWidth = false, style, textStyle,
}: Props) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  const iconSize = ICON_SIZE[size];

  return (
    <PressScale
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        { height: HEIGHTS[size], backgroundColor: v.bg },
        v.border ? { borderWidth: 1.5, borderColor: v.border } : null,
        v.shadow && !isDisabled ? SHADOW.small : null,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={iconSize} color={v.fg} />}
          <Text style={[styles.text, { color: v.fg, fontSize: FONT_SIZE[size] }, textStyle]}>
            {title}
          </Text>
          {iconRight && <Ionicons name={iconRight} size={iconSize} color={v.fg} />}
        </View>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  fullWidth:  { alignSelf: 'stretch' },
  disabled:   { opacity: 0.5 },
  content:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  text:       { fontWeight: '800', letterSpacing: 0.3 },
});
