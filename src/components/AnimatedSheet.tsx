// ─── Animated bottom sheet (backdrop fade + sheet slide-up) ─────────────────
// Built on the Animated API — no native deps, Expo Go safe.
// On wide screens the sheet caps its width and centers (see consumers'
// sheetStyle with maxWidth + alignSelf:'center').
import React, { useEffect, useRef } from 'react';
import {
  Animated, Easing, StyleSheet, TouchableWithoutFeedback,
  ViewStyle, StyleProp, useWindowDimensions,
} from 'react-native';
import { COLORS } from '../utils/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
};

export default function AnimatedSheet({ visible, onClose, children, sheetStyle }: Props) {
  // Reactive height so the slide-out distance is correct after a resize /
  // rotation (important on web and tablets).
  const { height: screenH } = useWindowDimensions();
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(screenH)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (visible) {
      mounted.current = true;
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }),
      ]).start();
    } else if (mounted.current) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: screenH, duration: 220,
          easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, screenH]);

  if (!visible && !mounted.current) return null;

  return (
    <>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdrop }]}
          pointerEvents={visible ? 'auto' : 'none'}
        />
      </TouchableWithoutFeedback>
      {/* Full-bleed anchor: pins to the bottom and centers the sheet so a
          maxWidth in sheetStyle produces a centered card on wide screens. */}
      <Animated.View
        style={styles.anchor}
        pointerEvents={visible ? 'box-none' : 'none'}
      >
        <Animated.View
          style={[styles.sheet, sheetStyle, { transform: [{ translateY }] }]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  anchor: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    backgroundColor: COLORS.surface,
  },
});
