import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert,
} from 'react-native';
import { collection, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Ionicons } from '@expo/vector-icons';
import { db, storage } from '../../../firebase';
import { formatCurrency } from '../../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { CONTENT_MAX_WIDTH } from '../../utils/responsive';
import { AnimatedListItem, animateLayout } from '../../utils/motion';
import { SkeletonList } from '../../components/Skeleton';
import CategoryIcon from '../../components/CategoryIcon';

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubCat = onSnapshot(query(collection(db, 'categories'), orderBy('name')), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { unsub(); unsubCat(); };
  }, []);

  // Map category IDs to names for display
  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      p.name?.toLowerCase().includes(term) || p.barcode?.includes(term)
    );
  }, [search, products]);

  const handleDelete = useCallback((product) =>
    Alert.alert('Delete Product', `Delete "${product.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          if (product.imagePath) {
            try { await deleteObject(ref(storage, product.imagePath)); } catch (_) {}
          }
          await deleteDoc(doc(db, 'products', product.id));
        } catch (e) { Alert.alert('Error', e.message); }
      }},
    ]),
  []);

  const onChangeSearch = useCallback((t: string) => { animateLayout(); setSearch(t); }, []);

  const renderItem = useCallback(({ item, index }) => {
    const isLow = (item.stock || 0) <= 5;
    return (
      <AnimatedListItem index={index}>
      <View style={styles.productCard}>
        <CategoryIcon
          category={catNameById.get(item.categoryId)}
          size={64}
          radius={RADIUS.md}
          style={styles.productImg}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
          <View style={[styles.stockBadge, { backgroundColor: isLow ? COLORS.danger + '15' : COLORS.success + '15' }]}>
            <Text style={[styles.stockText, { color: isLow ? COLORS.danger : COLORS.success }]}>
              {isLow ? '⚠ ' : ''}Stock: {item.stock || 0}
            </Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => navigation.navigate('AddEditProduct', { product: item })} style={styles.iconBtn} hitSlop={6}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn} hitSlop={6}>
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
      </AnimatedListItem>
    );
  }, [navigation, handleDelete, catNameById]);

  return (
    <View style={styles.container}>
      {/* Capped, centered column so list rows do not stretch on desktop */}
      <View style={styles.body}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products or barcode…"
          placeholderTextColor={COLORS.textLight}
          value={search}
          onChangeText={onChangeSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => onChangeSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? <SkeletonList count={7} /> : (
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="cube-outline" size={48} color={COLORS.border} />
            <Text style={styles.empty}>{search ? 'No products match your search.' : 'No products yet. Tap + to add one.'}</Text>
          </View>
        }
        renderItem={renderItem}
        removeClippedSubviews
        initialNumToRender={12}
      />
      )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddEditProduct', {})} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  body:        { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    margin: SPACING.lg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    height: 46, ...SHADOW.small, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, marginLeft: SPACING.sm, color: COLORS.text, fontSize: FONTS.sizes.md },
  productCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOW.small,
  },
  productImg:           { marginRight: SPACING.md },
  productInfo:          { flex: 1 },
  productName:          { fontWeight: '700', fontSize: FONTS.sizes.md, color: COLORS.text },
  productPrice:         { fontSize: FONTS.sizes.md, color: COLORS.primary, fontWeight: '800', marginTop: 2 },
  stockBadge:           { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, marginTop: 6 },
  stockText:            { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  cardActions:          { gap: SPACING.sm },
  iconBtn:              { padding: SPACING.sm },
  emptyWrap:            { alignItems: 'center', marginTop: 80, gap: SPACING.md },
  empty:                { textAlign: 'center', color: COLORS.textLight, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 28, right: 24, width: 60, height: 60,
    borderRadius: RADIUS.full, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', ...SHADOW.medium,
  },
});
