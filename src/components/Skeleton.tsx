// ─── Shimmer skeleton loaders ───────────────────────────────────────────────
// A pulsing placeholder shown while data loads. Animated API only.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle, StyleProp, Easing } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOW } from '../utils/theme';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export const SkeletonBlock = ({ width = '100%', height = 14, radius = RADIUS.sm, style }: SkeletonProps) => {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: COLORS.border, opacity: pulse },
        style,
      ]}
    />
  );
};

// A skeleton shaped like a list card row.
export const SkeletonCard = () => (
  <View style={styles.card}>
    <SkeletonBlock width={56} height={56} radius={RADIUS.md} />
    <View style={{ flex: 1, marginLeft: SPACING.md, gap: 8 }}>
      <SkeletonBlock width={'70%'} height={14} />
      <SkeletonBlock width={'40%'} height={12} />
      <SkeletonBlock width={90} height={16} radius={RADIUS.full} />
    </View>
  </View>
);

export const SkeletonList = ({ count = 6 }: { count?: number }) => (
  <View style={{ padding: SPACING.lg }}>
    {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.small,
  },
});
