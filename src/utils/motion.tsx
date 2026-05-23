// ─── Reusable animation primitives (built-in Animated API only) ─────────────
// No extra dependencies — works in Expo Go on all platforms.
import React, { useEffect, useRef } from 'react';
import {
  Animated, Easing, Platform, Pressable, UIManager, LayoutAnimation,
  ViewStyle, StyleProp, PressableProps,
} from 'react-native';

// Enable LayoutAnimation on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A smooth spring layout transition — call right before a state change
// that adds/removes/reorders items in a list.
export const animateLayout = () => {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );
};

// ── FadeInView ──────────────────────────────────────────────
// Fades + slides its children in on mount. Used for data-load reveals.
type FadeInProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  offsetY?: number;
};
export const FadeInView = ({ children, style, delay = 0, duration = 320, offsetY = 12 }: FadeInProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offsetY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: 0, duration, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// ── PressScale ──────────────────────────────────────────────
// Drop-in replacement for TouchableOpacity that scales down on press
// for a tactile micro-interaction.
type PressScaleProps = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
};
export const PressScale = ({
  children, style, scaleTo = 0.96, disabled, onPress, ...rest
}: PressScaleProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  return (
    <Pressable
      onPressIn={disabled ? undefined : pressIn}
      onPressOut={disabled ? undefined : pressOut}
      onPress={onPress}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ── useStagger ──────────────────────────────────────────────
// Returns an animated style for a list item that fades + slides in
// with a stagger based on its index.
export const useStaggeredEntrance = (index: number, step = 45, max = 8) => {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, max) * step,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
    ],
  };
};

// ── AnimatedListItem ────────────────────────────────────────
// Wrap a list row to give it a staggered entrance animation.
type AnimatedListItemProps = {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};
export const AnimatedListItem = ({ index, children, style }: AnimatedListItemProps) => {
  const animStyle = useStaggeredEntrance(index);
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
};
