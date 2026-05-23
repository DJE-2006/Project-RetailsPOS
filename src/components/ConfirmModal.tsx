// ─── ConfirmHost ────────────────────────────────────────────────────
// Mount once at the app root. Renders a styled confirmation modal in
// response to confirm() calls (see src/utils/confirm.ts). Works the same
// on web (react-native-web) and native.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  TouchableWithoutFeedback, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../utils/theme';
import { ConfirmOptions, registerConfirmHost } from '../utils/confirm';

export default function ConfirmHost() {
  const [opts, setOpts]   = useState<ConfirmOptions | null>(null);
  const [visible, setVisible] = useState(false);

  const overlay = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.9)).current;

  useEffect(() => registerConfirmHost((o) => {
    setOpts(o);
    setVisible(true);
  }), []);

  useEffect(() => {
    if (!visible) return;
    overlay.setValue(0);
    scale.setValue(0.9);
    Animated.parallel([
      Animated.timing(overlay, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }),
    ]).start();
  }, [visible]);

  // Animate out, then run the chosen callback.
  const dismiss = useCallback((action?: () => void) => {
    Animated.parallel([
      Animated.timing(overlay, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.9, duration: 140, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      action?.();
    });
  }, []);

  if (!opts) return null;

  const isAlert = opts.kind === 'alert';
  const destructive = !!opts.destructive;
  // Resolve tone -> accent colour + icon. `alert()` defaults to the 'error'
  // tone; `confirm()` keeps the existing destructive/default behaviour.
  const tone = opts.tone ?? (destructive ? 'destructive' : 'default');
  const accent =
    tone === 'error'       ? COLORS.danger
    : tone === 'destructive' ? COLORS.danger
    :                          COLORS.primary;
  const iconName =
    tone === 'error'       ? 'alert-circle-outline'
    : tone === 'destructive' ? 'log-out-outline'
    :                          'help-circle-outline';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => dismiss(opts.onCancel)}>
      <TouchableWithoutFeedback onPress={() => dismiss(isAlert ? opts.onConfirm : opts.onCancel)}>
        <Animated.View style={[styles.overlay, { opacity: overlay }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
              <View style={[styles.iconWrap, { backgroundColor: accent + '18' }]}>
                <Ionicons name={iconName as any} size={28} color={accent} />
              </View>

              <Text style={styles.title}>{opts.title}</Text>
              {!!opts.message && <Text style={styles.message}>{opts.message}</Text>}

              <View style={styles.actions}>
                {!isAlert && (
                  <TouchableOpacity
                    style={[styles.btn, styles.cancelBtn]}
                    activeOpacity={0.8}
                    onPress={() => dismiss(opts.onCancel)}
                  >
                    <Text style={styles.cancelText}>{opts.cancelText ?? 'Cancel'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: accent }]}
                  activeOpacity={0.85}
                  onPress={() => dismiss(opts.onConfirm)}
                >
                  <Text style={styles.confirmText}>{opts.confirmText ?? 'OK'}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', ...SHADOW.large,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: RADIUS.full,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text, textAlign: 'center',
  },
  message: {
    fontSize: FONTS.sizes.sm, color: COLORS.textSecond, textAlign: 'center',
    marginTop: SPACING.xs, lineHeight: 20,
  },
  actions: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, alignSelf: 'stretch',
  },
  btn: {
    flex: 1, height: 46, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  cancelText:  { color: COLORS.textSecond, fontWeight: '700', fontSize: FONTS.sizes.md },
  confirmText: { color: COLORS.white, fontWeight: '800', fontSize: FONTS.sizes.md },
});
