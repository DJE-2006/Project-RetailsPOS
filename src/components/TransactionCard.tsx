import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../utils/theme';

const TransactionCard = ({ transaction: tx, onPress }) => {
  const c = getStatusColor(tx.status);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.statusIndicator, { backgroundColor: c }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.txId}>#{tx.id?.slice(-6).toUpperCase()}</Text>
          <Text style={styles.total}>{formatCurrency(tx.total)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.date}>{formatDateTime(tx.createdAt)}</Text>
          <View style={[styles.badge, { backgroundColor: c + '18' }]}>
            <Text style={[styles.badgeText, { color: c }]}>{getStatusLabel(tx.status)}</Text>
          </View>
        </View>
        {tx.cashierName ? <Text style={styles.cashier}>By: {tx.cashierName}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} style={{ marginRight: SPACING.sm }} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.sm, ...SHADOW.small,
  },
  statusIndicator: { width: 4, alignSelf: 'stretch' },
  content:         { flex: 1, padding: SPACING.md },
  topRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txId:            { fontWeight: '800', fontSize: FONTS.sizes.md, color: COLORS.text },
  total:           { fontWeight: '800', color: COLORS.primary, fontSize: FONTS.sizes.md },
  bottomRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  date:            { fontSize: FONTS.sizes.xs, color: COLORS.textSecond },
  badge:           { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeText:       { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  cashier:         { fontSize: FONTS.sizes.xs, color: COLORS.textLight, marginTop: 2 },
});

export default React.memo(TransactionCard);
