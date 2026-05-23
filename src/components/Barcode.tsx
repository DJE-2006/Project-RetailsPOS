// ─── Barcode ────────────────────────────────────────────────────────
// Renders a scannable Code-128 barcode for any product code using plain
// Views — works identically on web and native, no SVG dependency.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../utils/theme';
import { encodeCode128 } from '../utils/code128';

type Props = {
  value: string;
  height?: number;       // bar height in px
  width?: number;        // target width of the bars area in px
  showText?: boolean;    // print the human-readable value below
  style?: StyleProp<ViewStyle>;
};

export default function Barcode({
  value, height = 60, width = 260, showText = true, style,
}: Props) {
  const modules = useMemo(() => {
    if (!value) return null;
    try { return encodeCode128(value); } catch { return null; }
  }, [value]);

  if (!value) return null;

  // Unsupported value (e.g. non-ASCII) — fail soft with a readable label.
  if (!modules) {
    return (
      <View style={[styles.card, style]}>
        <Text style={styles.invalid}>Can't render barcode for "{value}"</Text>
      </View>
    );
  }

  const totalModules = modules.reduce((a, b) => a + b, 0);
  const unit = width / totalModules;

  return (
    <View style={[styles.card, style]}>
      <View style={[styles.bars, { height }]}>
        {modules.map((m, i) => (
          <View
            key={i}
            style={{
              width: m * unit,
              height,
              // Even indices are bars (black), odd are spaces (transparent).
              backgroundColor: i % 2 === 0 ? '#000000' : 'transparent',
            }}
          />
        ))}
      </View>
      {showText && <Text style={styles.text}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    alignItems: 'center', alignSelf: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  bars:    { flexDirection: 'row', alignItems: 'stretch' },
  text: {
    marginTop: SPACING.sm, fontSize: FONTS.sizes.sm, color: COLORS.text,
    fontWeight: '700', letterSpacing: 3,
  },
  invalid: { fontSize: FONTS.sizes.xs, color: COLORS.danger, fontWeight: '600' },
});
