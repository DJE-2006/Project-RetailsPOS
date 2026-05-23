import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../utils/theme';

const ProductCard = ({ product, onEdit, onDelete }) => {
  const isLow = (product.stock || 0) <= 5;
  return (
    <View style={styles.card}>
      {product.imageUrl
        ? <Image source={{ uri: product.imageUrl }} style={styles.image} />
        : <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="cube-outline" size={26} color={COLORS.textLight} />
          </View>
      }
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>
        <View style={[styles.stockBadge, { backgroundColor: isLow ? COLORS.danger + '15' : COLORS.success + '15' }]}>
          <Text style={[styles.stockText, { color: isLow ? COLORS.danger : COLORS.success }]}>
            {isLow ? '⚠ ' : ''}Stock: {product.stock || 0}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {onEdit && (
          <TouchableOpacity onPress={() => onEdit(product)} style={styles.btn} hitSlop={6}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity onPress={() => onDelete(product)} style={styles.btn} hitSlop={6}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.small,
  },
  image:            { width: 60, height: 60, borderRadius: RADIUS.md, marginRight: SPACING.md },
  imagePlaceholder: { backgroundColor: COLORS.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  info:             { flex: 1 },
  name:             { fontWeight: '700', fontSize: FONTS.sizes.md, color: COLORS.text },
  price:            { color: COLORS.primary, fontWeight: '800', marginTop: 2 },
  stockBadge:       { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, marginTop: 6 },
  stockText:        { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  actions:          { gap: SPACING.sm },
  btn:              { padding: SPACING.sm },
});

export default React.memo(ProductCard);
