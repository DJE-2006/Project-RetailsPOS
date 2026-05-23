import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';

const CartItem = ({ item, onIncrease, onDecrease, onRemove }) => (
  <View style={styles.row}>
    <View style={styles.info}>
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.price}>{formatCurrency(item.price)} each</Text>
    </View>

    <View style={styles.controls}>
      <TouchableOpacity style={styles.qtyBtn} onPress={onDecrease} hitSlop={6}>
        <Ionicons name="remove" size={14} color={COLORS.primary} />
      </TouchableOpacity>
      <Text style={styles.qty}>{item.quantity}</Text>
      <TouchableOpacity style={styles.qtyBtn} onPress={onIncrease} hitSlop={6}>
        <Ionicons name="add" size={14} color={COLORS.primary} />
      </TouchableOpacity>
    </View>

    <Text style={styles.subtotal}>{formatCurrency(item.subtotal)}</Text>

    <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={8}>
      <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  info:      { flex: 1 },
  name:      { fontWeight: '700', fontSize: FONTS.sizes.sm, color: COLORS.text },
  price:     { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2 },
  controls:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.sm },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  qty:       { fontWeight: '800', color: COLORS.text, minWidth: 22, textAlign: 'center', fontSize: FONTS.sizes.sm },
  subtotal:  { fontWeight: '800', color: COLORS.primary, minWidth: 64, textAlign: 'right', fontSize: FONTS.sizes.sm },
  removeBtn: { padding: SPACING.xs, marginLeft: SPACING.sm },
});

export default React.memo(CartItem);
