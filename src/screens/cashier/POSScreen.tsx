import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, Animated,
} from 'react-native';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../../firebase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { useResponsive, gridItemWidth, CONTENT_MAX_WIDTH } from '../../utils/responsive';
import { getHeldCarts, saveHeldCart, removeHeldCart, HeldCart } from '../../utils/heldCarts';
import { confirm } from '../../utils/confirm';
import { PressScale, AnimatedListItem, animateLayout } from '../../utils/motion';
import AnimatedSheet from '../../components/AnimatedSheet';
import BarcodeScanner from '../../components/BarcodeScanner';
import { SkeletonBlock } from '../../components/Skeleton';
import Button from '../../components/Button';
import CategoryIcon from '../../components/CategoryIcon';

const LOW_STOCK_THRESHOLD = 5;
const GRID_GAP = SPACING.md;

export default function POSScreen({ navigation }) {
  const { profile, logout } = useAuth();
  const {
    items, addItem, removeItem, updateQuantity, setDiscount,
    subtotal, tax, total, discountAmount, itemCount, clearCart, loadCart,
  } = useCart();

  // ── Responsive grid metrics ─────────────────────────────
  // Column count adapts by breakpoint (2 phone · 3-4 tablet · 4-5 desktop).
  // The grid content is capped to CONTENT_MAX_WIDTH and centered on wide
  // screens, then the card width is computed from that effective width.
  const { width, columns } = useResponsive();
  const gridInnerWidth = Math.min(width, CONTENT_MAX_WIDTH) - SPACING.lg * 2;
  const cardWidth = gridItemWidth(gridInnerWidth, columns, GRID_GAP);

  const handleLogout = useCallback(() =>
    confirm({
      title: 'Logout',
      message: 'End your shift and sign out?',
      confirmText: 'Logout',
      destructive: true,
      onConfirm: () => { clearCart(); logout(); },
    }), [logout, clearCart]);

  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch]         = useState('');
  const [activeCat, setActiveCat]   = useState('');
  const [cartOpen, setCartOpen]     = useState(false);
  const [holdOpen, setHoldOpen]     = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [heldCarts, setHeldCarts]   = useState<HeldCart[]>([]);
  const [loading, setLoading]       = useState(true);

  // Cart badge bounce — pulses whenever the item count changes.
  const badgeScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (itemCount === 0) return;
    badgeScale.setValue(0.6);
    Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }).start();
  }, [itemCount]);

  // ── Real-time data ──────────────────────────────────────
  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error('Products listener error:', err); setLoading(false); });
    const unsub2 = onSnapshot(query(collection(db, 'categories'), orderBy('name')), (snap) =>
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Categories listener error:', err)
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  // ── Held carts ──────────────────────────────────────────
  const refreshHeld = useCallback(async () => setHeldCarts(await getHeldCarts()), []);
  useEffect(() => { refreshHeld(); }, [refreshHeld]);

  // Computed values based on current state
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if ((p.stock || 0) <= 0) return false;
      if (activeCat && p.categoryId !== activeCat) return false;
      if (term) {
        const matchesName    = p.name?.toLowerCase().includes(term);
        const matchesBarcode = p.barcode && String(p.barcode).toLowerCase().includes(term);
        if (!matchesName && !matchesBarcode) return false;
      }
      return true;
    });
  }, [products, activeCat, search]);

  const lowStockCount = useMemo(
    () => products.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= LOW_STOCK_THRESHOLD).length,
    [products]
  );

  const cartQtyMap = useMemo(() => {
    const m = new Map();
    items.forEach((i) => m.set(i.id, i.quantity));
    return m;
  }, [items]);

  const catData = useMemo(() => [{ id: '', name: 'All' }, ...categories], [categories]);

  // Map product IDs to quantities in cart
  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  // Look up product by barcode and add to cart
  const addByBarcode = useCallback((code: string) => {
    const term = code.trim();
    if (!term) return false;
    const exact = products.find((p) => String(p.barcode || '') === term);
    if (!exact) {
      Alert.alert('Not Found', `No product matches barcode ${term}.`);
      return false;
    }
    if ((exact.stock || 0) <= 0) {
      Alert.alert('Out of Stock', `${exact.name} is out of stock.`);
      return false;
    }
    const inCart = cartQtyMap.get(exact.id) || 0;
    if (inCart >= (exact.stock || 0)) {
      Alert.alert('Stock Limit', `Only ${exact.stock} of ${exact.name} in stock.`);
      return false;
    }
    animateLayout();
    addItem({ id: exact.id, name: exact.name, price: exact.price, imageUrl: exact.imageUrl, stock: exact.stock });
    return true;
  }, [products, cartQtyMap, addItem]);

  // Handle search box submit (treat as barcode scan)
  const handleScanSubmit = useCallback(() => {
    if (addByBarcode(search)) setSearch('');
  }, [search, addByBarcode]);

  // Scanner modal result
  const handleScannerResult = useCallback((code: string) => {
    setScannerOpen(false);
    addByBarcode(code);
  }, [addByBarcode]);

  // Add product or show validation errors
  const handleAddItem = useCallback((product) => {
    if ((product.stock || 0) <= 0) {
      Alert.alert('Out of Stock', `${product.name} is out of stock.`);
      return;
    }
    const inCart = cartQtyMap.get(product.id) || 0;
    if (inCart >= (product.stock || 0)) {
      Alert.alert('Stock Limit', `Only ${product.stock} of ${product.name} in stock.`);
      return;
    }
    animateLayout();
    addItem({ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, stock: product.stock });
  }, [addItem, cartQtyMap]);

  const handleClearCart = useCallback(() => {
    if (items.length === 0) return;
    Alert.alert('Clear Cart', 'Remove all items from cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setDiscount(0); clearCart(); } },
    ]);
  }, [items.length, clearCart, setDiscount]);

  // ── Hold / Resume ───────────────────────────────────────
  const handleHoldCart = useCallback(async () => {
    if (items.length === 0) { Alert.alert('Nothing to hold', 'Cart is empty.'); return; }
    await saveHeldCart({
      label: `${itemCount} item${itemCount === 1 ? '' : 's'} · ${formatCurrency(total)}`,
      items, discount: discountAmount, itemCount, total,
    });
    setDiscount(0);
    clearCart();
    setCartOpen(false);
    await refreshHeld();
    Alert.alert('Cart Held', 'Order parked. Resume it anytime from the hold list.');
  }, [items, itemCount, total, discountAmount, clearCart, setDiscount, refreshHeld]);

  const handleResume = useCallback(async (held: HeldCart) => {
    const apply = async () => {
      loadCart(held.items, held.discount);
      await removeHeldCart(held.id);
      await refreshHeld();
      setHoldOpen(false);
      setCartOpen(true);
    };
    if (items.length > 0) {
      Alert.alert('Resume Cart', 'This replaces the current cart. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resume', onPress: apply },
      ]);
    } else {
      apply();
    }
  }, [items.length, loadCart, refreshHeld]);

  const handleDeleteHeld = useCallback(async (held: HeldCart) => {
    await removeHeldCart(held.id);
    await refreshHeld();
  }, [refreshHeld]);

  // ── Renderers ───────────────────────────────────────────
  const renderProduct = useCallback(({ item, index }) => {
    const cartQty = cartQtyMap.get(item.id) || 0;
    const inStock = (item.stock || 0) > 0;
    const isLow   = (item.stock || 0) <= LOW_STOCK_THRESHOLD;
    return (
      <AnimatedListItem index={index}>
        <PressScale
          style={[styles.productCard, { width: cardWidth }, !inStock && styles.outOfStock]}
          onPress={() => handleAddItem(item)}
          disabled={!inStock}
        >
          <CategoryIcon
            category={catNameById.get(item.categoryId)}
            size={96}
            radius={RADIUS.md}
            style={styles.productImg}
          />
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
          </View>
          <View style={[styles.stockPill, { backgroundColor: isLow ? COLORS.danger + '15' : COLORS.success + '15' }]}>
            <Text style={[styles.stockText, { color: isLow ? COLORS.danger : COLORS.success }]}>
              {inStock ? `${item.stock} left` : 'Out of stock'}
            </Text>
          </View>
          {cartQty > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartQty}</Text>
            </View>
          )}
        </PressScale>
      </AnimatedListItem>
    );
  }, [cartQtyMap, handleAddItem, cardWidth, catNameById]);

  const renderCategory = useCallback(({ item }) => {
    const active = activeCat === item.id;
    return (
      <PressScale
        style={[styles.catChip, active && styles.catChipActive]}
        onPress={() => setActiveCat(item.id)}
      >
        <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{item.name}</Text>
      </PressScale>
    );
  }, [activeCat]);

  const renderCartItem = useCallback(({ item, index }) => (
    <AnimatedListItem index={index}>
      <View style={styles.cartItem}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cartItemPrice}>{formatCurrency(item.price)} ea.</Text>
        </View>
        <View style={styles.qtyControls}>
          <PressScale style={styles.qtyBtn} scaleTo={0.85} onPress={() => { animateLayout(); updateQuantity(item.id, item.quantity - 1); }}>
            <Ionicons name="remove" size={16} color={COLORS.primary} />
          </PressScale>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <PressScale style={styles.qtyBtn} scaleTo={0.85} onPress={() => updateQuantity(item.id, item.quantity + 1)}>
            <Ionicons name="add" size={16} color={COLORS.primary} />
          </PressScale>
        </View>
        <Text style={styles.cartItemSubtotal}>{formatCurrency(item.subtotal)}</Text>
        <TouchableOpacity onPress={() => { animateLayout(); removeItem(item.id); }} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </AnimatedListItem>
  ), [updateQuantity, removeItem]);

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or scan barcode…"
            placeholderTextColor={COLORS.textLight}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleScanSubmit}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setScannerOpen(true)} hitSlop={8} style={styles.scanInline}>
            <Ionicons name="barcode-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => { refreshHeld(); setHoldOpen(true); }} activeOpacity={0.7}>
          <Ionicons name="pause-circle-outline" size={22} color={COLORS.accentDark} />
          {heldCarts.length > 0 && (
            <View style={[styles.cartCount, { backgroundColor: COLORS.accentDark }]}>
              <Text style={styles.cartCountText}>{heldCarts.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setCartOpen(true)} activeOpacity={0.7}>
          <Ionicons name="cart-outline" size={22} color={COLORS.primary} />
          {itemCount > 0 && (
            <Animated.View style={[styles.cartCount, { transform: [{ scale: badgeScale }] }]}>
              <Text style={styles.cartCountText}>{itemCount}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Transactions')} activeOpacity={0.7}>
          <Ionicons name="receipt-outline" size={22} color={COLORS.textSecond} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ShiftSummary')} activeOpacity={0.7}>
          <Ionicons name="stats-chart-outline" size={22} color={COLORS.textSecond} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout} activeOpacity={0.7} hitSlop={6}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <View style={styles.lowStockBar}>
          <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
          <Text style={styles.lowStockText}>
            {lowStockCount} product{lowStockCount === 1 ? '' : 's'} running low on stock
          </Text>
        </View>
      )}

      {/* Category Filter */}
      <View style={styles.catBar}>
        <FlatList
          data={catData}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => i.id || 'all'}
          contentContainerStyle={styles.catList}
          renderItem={renderCategory}
        />
      </View>

      {/* Product Grid — column count adapts by screen width; the grid is
          width-capped and centered on wide desktop windows. */}
      {loading ? (
        <View style={styles.gridScroll}>
          <View style={[styles.gridContent, styles.gridCentered]}>
            <View style={styles.gridRow}>
              {Array.from({ length: columns * 2 }).map((_, i) => (
                <View key={i} style={[styles.productCard, { width: cardWidth, paddingBottom: SPACING.md }]}>
                  <SkeletonBlock width={'100%'} height={96} radius={RADIUS.md} />
                  <View style={{ height: SPACING.sm }} />
                  <SkeletonBlock width={'80%'} height={14} />
                  <View style={{ height: 6 }} />
                  <SkeletonBlock width={'45%'} height={16} />
                  <View style={{ height: 8 }} />
                  <SkeletonBlock width={64} height={16} radius={RADIUS.full} />
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          // `key` forces a fresh mount when the column count changes — RN
          // FlatList cannot change numColumns on an existing instance.
          key={`grid-${columns}`}
          data={filtered}
          keyExtractor={(i) => i.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
          style={styles.gridScroll}
          contentContainerStyle={[styles.gridContent, styles.gridCentered]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={56} color={COLORS.border} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
          renderItem={renderProduct}
          removeClippedSubviews
          initialNumToRender={columns * 5}
          windowSize={7}
        />
      )}

      {/* Cart Bottom Sheet */}
      <AnimatedSheet visible={cartOpen} onClose={() => setCartOpen(false)} sheetStyle={styles.cartSheet}>
          <>
            <View style={styles.handle} />
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Cart · {itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
              <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                <TouchableOpacity onPress={handleHoldCart}>
                  <Text style={{ color: COLORS.accentDark, fontWeight: '700' }}>Hold</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClearCart}>
                  <Text style={{ color: COLORS.danger, fontWeight: '700' }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCartOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 260 }}
              ListEmptyComponent={<Text style={styles.emptyCart}>Cart is empty</Text>}
              renderItem={renderCartItem}
            />

            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>VAT (12%)</Text>
                <Text style={styles.totalValue}>{formatCurrency(tax)}</Text>
              </View>
              {discountAmount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: COLORS.success }]}>Discount</Text>
                  <Text style={{ color: COLORS.success, fontWeight: '700' }}>-{formatCurrency(discountAmount)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandRow]}>
                <Text style={styles.grandLabel}>TOTAL</Text>
                <Text style={styles.grandValue}>{formatCurrency(total)}</Text>
              </View>
            </View>

            <Button
              title={`Checkout · ${formatCurrency(total)}`}
              icon="card-outline" size="lg" fullWidth
              disabled={items.length === 0}
              onPress={() => { setCartOpen(false); navigation.navigate('Payment'); }}
              style={styles.checkoutBtn}
            />
          </>
      </AnimatedSheet>

      {/* Held Carts Sheet */}
      <AnimatedSheet visible={holdOpen} onClose={() => setHoldOpen(false)} sheetStyle={styles.cartSheet}>
          <>
            <View style={styles.handle} />
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Held Orders · {heldCarts.length}</Text>
              <TouchableOpacity onPress={() => setHoldOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={heldCarts}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={<Text style={styles.emptyCart}>No held orders</Text>}
              renderItem={({ item }) => (
                <View style={styles.heldRow}>
                  <Ionicons name="bag-handle-outline" size={20} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName}>{item.label}</Text>
                    <Text style={styles.cartItemPrice}>
                      {new Date(item.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.resumeBtn} onPress={() => handleResume(item)}>
                    <Text style={styles.resumeBtnText}>Resume</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteHeld(item)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              )}
            />
          </>
      </AnimatedSheet>

      {/* Barcode scanner (camera on native, scan-gun field on web) */}
      <BarcodeScanner
        visible={scannerOpen}
        title="Scan Product"
        onClose={() => setScannerOpen(false)}
        onScanned={handleScannerResult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  topBar:       { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, ...SHADOW.small },
  searchWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, height: 40, marginRight: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  searchInput:  { flex: 1, marginLeft: SPACING.xs, color: COLORS.text, fontSize: FONTS.sizes.sm },
  scanInline:   { marginLeft: SPACING.xs, paddingLeft: SPACING.xs, borderLeftWidth: 1, borderLeftColor: COLORS.border },
  iconBtn:      { position: 'relative', padding: SPACING.sm, marginLeft: 2 },
  cartCount: {
    position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full, minWidth: 18, height: 18, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
  },
  cartCountText:{ color: COLORS.textOnAccent, fontSize: 10, fontWeight: '800' },
  lowStockBar:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.danger + '12', paddingHorizontal: SPACING.md, paddingVertical: 6 },
  lowStockText: { color: COLORS.danger, fontSize: FONTS.sizes.xs, fontWeight: '700' },
  catBar:       { backgroundColor: COLORS.surface, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  catList:      { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  catChip:      { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  catChipActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:  { fontSize: FONTS.sizes.sm, color: COLORS.textSecond, fontWeight: '600' },
  catChipTextActive: { color: COLORS.white, fontWeight: '700' },
  // FlatList itself stretches; its content is capped + centered.
  gridScroll:   { flex: 1, alignSelf: 'stretch' },
  gridCentered: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  // Each wrapped row lays cards out with an even gap; cards wrap naturally.
  gridRow:      { gap: GRID_GAP },
  gridContent:  { paddingVertical: SPACING.md, paddingBottom: SPACING.xxl, paddingHorizontal: SPACING.lg },
  productCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.sm, marginBottom: GRID_GAP, ...SHADOW.small, position: 'relative',
  },
  outOfStock:   { opacity: 0.5 },
  productImg:   { alignSelf: 'center', marginBottom: SPACING.sm },
  productName:  { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, minHeight: 36 },
  priceRow:     { marginTop: 2, marginBottom: 6 },
  productPrice: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.primary },
  stockPill:    { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  stockText:    { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  cartBadge: {
    position: 'absolute', top: 8, right: 8, backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full, minWidth: 24, height: 24, paddingHorizontal: 6,
    justifyContent: 'center', alignItems: 'center', ...SHADOW.small,
  },
  cartBadgeText:{ color: COLORS.textOnAccent, fontSize: FONTS.sizes.xs, fontWeight: '800' },
  emptyWrap:    { alignItems: 'center', marginTop: 80, gap: SPACING.md },
  emptyText:    { color: COLORS.textLight, fontSize: FONTS.sizes.md, fontWeight: '600' },

  // Cart Sheet — capped + centered on wide screens so it does not stretch
  // edge to edge on a desktop browser window.
  cartSheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, ...SHADOW.large,
    maxHeight: '78%', maxWidth: 560, width: '100%', alignSelf: 'center',
  },
  handle:       { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  cartHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  cartTitle:    { fontSize: FONTS.sizes.lg, fontWeight: '800', color: COLORS.text },
  emptyCart:    { textAlign: 'center', color: COLORS.textLight, padding: SPACING.lg },
  cartItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  cartItemName: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: '600' },
  cartItemPrice:{ fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2 },
  qtyControls:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.sm },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  qtyText:      { fontWeight: '800', color: COLORS.text, minWidth: 22, textAlign: 'center' },
  cartItemSubtotal: { fontWeight: '800', color: COLORS.primary, marginRight: SPACING.sm, minWidth: 70, textAlign: 'right' },
  heldRow:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  resumeBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full },
  resumeBtnText:{ color: COLORS.white, fontWeight: '800', fontSize: FONTS.sizes.xs },
  totals:       { borderTopWidth: 1, borderTopColor: COLORS.divider, paddingTop: SPACING.md, marginTop: SPACING.sm },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel:   { color: COLORS.textSecond, fontSize: FONTS.sizes.sm },
  totalValue:   { fontWeight: '600', color: COLORS.text, fontSize: FONTS.sizes.sm },
  grandRow:     { marginTop: SPACING.xs, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  grandLabel:   { fontWeight: '800', fontSize: FONTS.sizes.lg, color: COLORS.text },
  grandValue:   { fontWeight: '800', fontSize: FONTS.sizes.lg, color: COLORS.primary },
  checkoutBtn:  { marginTop: SPACING.md },
});
