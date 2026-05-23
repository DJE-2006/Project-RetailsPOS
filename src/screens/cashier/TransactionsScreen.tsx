import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import {
  collection, query, where, onSnapshot, updateDoc, addDoc,
  doc, getDoc, getDocs, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { db } from '../../../firebase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, getStatusColor } from '../../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { CONTENT_MAX_WIDTH, MODAL_MAX_WIDTH } from '../../utils/responsive';
import TransactionCard from '../../components/TransactionCard';
import { shareReceipt } from '../../utils/receipt';
import { AnimatedListItem, PressScale, animateLayout } from '../../utils/motion';
import { SkeletonList } from '../../components/Skeleton';
import Button from '../../components/Button';

const STATUS_FILTERS = ['all', 'completed', 'pending', 'cancelled'];

const PAY_ICON = { cash: 'cash-outline', gcash: 'phone-portrait-outline', card: 'card-outline' };
const STATUS_ICON = { completed: 'checkmark-circle', cancelled: 'close-circle', pending: 'time' };

export default function TransactionsScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  // Context returns undefined when the screen is not inside a bottom-tab navigator
  // (e.g. the cashier stack), so the last list rows never sit under a tab bar there.
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const listPaddingBottom = tabBarHeight + insets.bottom + SPACING.xl;
  const [transactions, setTransactions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState(null);
  const [txItems, setTxItems]           = useState([]);
  const [txPayments, setTxPayments]     = useState([]);
  const [updating, setUpdating]         = useState(false);

  const seesAll = profile?.role === 'admin' || profile?.role === 'manager';

  useEffect(() => {
    if (!profile?.uid) return;
    const base = collection(db, 'transactions');
    // Cashiers filter by their own id only (no orderBy) so no composite
    // Firestore index is needed — ordering is applied client-side below.
    const q = seesAll
      ? query(base, orderBy('createdAt', 'desc'))
      : query(base, where('cashierId', '==', profile.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() as any }));
        if (!seesAll) {
          rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        }
        setTransactions(rows);
        setLoading(false);
      },
      (err) => {
        console.error('Transactions listener error:', err);
        setLoading(false);
        Alert.alert('Error', 'Could not load transactions. Please try again.');
      }
    );
    return unsub;
  }, [profile?.uid, seesAll]);

  const filtered = useMemo(
    () => statusFilter === 'all' ? transactions : transactions.filter((t) => t.status === statusFilter),
    [transactions, statusFilter]
  );

  const openDetail = useCallback(async (tx) => {
    setSelected(tx);
    setTxItems([]); setTxPayments([]);
    try {
      const [itemsSnap, paySnap] = await Promise.all([
        getDocs(query(collection(db, 'transaction_items'), where('transactionId', '==', tx.id))),
        getDocs(query(collection(db, 'payments'),          where('transactionId', '==', tx.id))),
      ]);
      setTxItems(itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTxPayments(paySnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  }, []);

  const handleCancel = useCallback((tx) =>
    Alert.alert('Cancel Transaction', `Cancel #${tx.id.slice(-6).toUpperCase()}? Stock will be restored.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Tx', style: 'destructive', onPress: async () => {
        setUpdating(true);
        try {
          const itemsSnap = await getDocs(
            query(collection(db, 'transaction_items'), where('transactionId', '==', tx.id))
          );
          await Promise.all(itemsSnap.docs.map(async (itemDoc) => {
            const item = itemDoc.data();
            const productRef = doc(db, 'products', item.productId);
            const prodSnap = await getDoc(productRef);
            if (!prodSnap.exists()) return;
            const prevStock = prodSnap.data().stock || 0;
            const newStock = prevStock + (item.quantity || 0);
            return Promise.all([
              updateDoc(productRef, { stock: newStock, previousStock: prevStock, updatedAt: serverTimestamp() }),
              addDoc(collection(db, 'inventory_logs'), {
                productId: item.productId,
                productName: item.productName,
                type: 'cancel_restore',
                quantity: item.quantity || 0,
                previousStock: prevStock,
                newStock,
                transactionId: tx.id,
                createdAt: serverTimestamp(),
              }),
            ]);
          }));
          await updateDoc(doc(db, 'transactions', tx.id), {
            status: 'cancelled', updatedAt: serverTimestamp(),
          });
          setSelected((prev) => prev ? { ...prev, status: 'cancelled' } : null);
        } catch (e: any) { Alert.alert('Error', e?.message ?? 'Something went wrong.'); }
        finally { setUpdating(false); }
      }},
    ]),
  []);

  const renderTx = useCallback(
    ({ item, index }) => (
      <AnimatedListItem index={index}>
        <TransactionCard transaction={item} onPress={() => openDetail(item)} />
      </AnimatedListItem>
    ),
    [openDetail]
  );

  const handleShareReceipt = useCallback(() => {
    if (!selected) return;
    shareReceipt({
      transactionId: selected.id,
      cashierName:   selected.cashierName,
      items:         txItems.map((i) => ({ name: i.productName, price: i.price, quantity: i.quantity, subtotal: i.subtotal })),
      payments:      txPayments.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference })),
      subtotal:      selected.subtotal || 0,
      tax:           selected.tax || 0,
      discount:      selected.discount || 0,
      total:         selected.total || 0,
      totalPaid:     selected.totalPaid || 0,
      change:        selected.change || 0,
      createdAt:     selected.createdAt,
    });
  }, [selected, txItems, txPayments]);

  return (
    <View style={styles.container}>
      {/* Capped, centered column so rows do not stretch on desktop */}
      <View style={styles.body}>
      {/* Status Filter */}
      <View style={styles.filterBar}>
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s;
          return (
            <PressScale
              key={s}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
              onPress={() => { animateLayout(); setStatusFilter(s); }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </PressScale>
          );
        })}
      </View>

      {loading ? <SkeletonList count={6} /> : null}
      {!loading && (

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: listPaddingBottom }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.border} />
            <Text style={styles.empty}>No {statusFilter === 'all' ? '' : statusFilter} transactions yet.</Text>
          </View>
        }
        renderItem={renderTx}
      />
      )}
      </View>

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>#{selected?.id?.slice(-6).toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.md }}
            >
              {selected && (
                <View style={[styles.statusRow, { backgroundColor: getStatusColor(selected.status) + '18' }]}>
                  <Ionicons
                    name={STATUS_ICON[selected.status] || 'time'}
                    size={22}
                    color={getStatusColor(selected.status)}
                  />
                  <Text style={[styles.statusLabel, { color: getStatusColor(selected.status) }]}>
                    {selected.status?.toUpperCase()}
                  </Text>
                  <Text style={styles.txDateTime}>{formatDateTime(selected.createdAt)}</Text>
                </View>
              )}

              <Text style={styles.sectionLabel}>Items</Text>
              {txItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                  <Text style={styles.itemQty}>×{item.quantity}</Text>
                  <Text style={styles.itemSub}>{formatCurrency(item.subtotal)}</Text>
                </View>
              ))}

              <View style={styles.totalsBox}>
                <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{formatCurrency(selected?.subtotal)}</Text></View>
                <View style={styles.totalRow}><Text style={styles.totalLabel}>VAT (12%)</Text><Text style={styles.totalValue}>{formatCurrency(selected?.tax)}</Text></View>
                {(selected?.discount || 0) > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: COLORS.success }]}>Discount</Text>
                    <Text style={{ color: COLORS.success, fontWeight: '700' }}>-{formatCurrency(selected?.discount)}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, styles.grandRow]}>
                  <Text style={styles.grandLabel}>TOTAL</Text>
                  <Text style={styles.grandValue}>{formatCurrency(selected?.total)}</Text>
                </View>
                <View style={styles.totalRow}><Text style={styles.totalLabel}>Paid</Text><Text style={{ color: COLORS.success, fontWeight: '700' }}>{formatCurrency(selected?.totalPaid)}</Text></View>
                {(selected?.change || 0) > 0 && (
                  <View style={styles.totalRow}><Text style={styles.totalLabel}>Change</Text><Text style={styles.totalValue}>{formatCurrency(selected?.change)}</Text></View>
                )}
              </View>

              <Text style={styles.sectionLabel}>Payments</Text>
              {txPayments.map((pay) => (
                <View key={pay.id} style={styles.payRow}>
                  <Ionicons name={PAY_ICON[pay.method] || 'card-outline'} size={18} color={COLORS.primary} />
                  <View style={styles.payInfo}>
                    <Text style={styles.payMethod} numberOfLines={1}>{pay.method.toUpperCase()}</Text>
                    {pay.reference ? <Text style={styles.payRef} numberOfLines={1}>Ref: {pay.reference}</Text> : null}
                  </View>
                  <Text style={styles.payAmount} numberOfLines={1}>{formatCurrency(pay.amount)}</Text>
                </View>
              ))}

              {selected?.notes ? (
                <>
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <Text style={styles.notes}>{selected.notes}</Text>
                </>
              ) : null}

              <TouchableOpacity style={styles.shareBtn} onPress={handleShareReceipt}>
                <Ionicons name="share-outline" size={18} color={COLORS.primary} />
                <Text style={styles.shareText}>Share Receipt</Text>
              </TouchableOpacity>

              {selected?.status === 'completed' && (
                <Button
                  title="Refund / Cancel Transaction"
                  variant="destructive" icon="arrow-undo-outline"
                  loading={updating} fullWidth
                  onPress={() => handleCancel(selected)}
                  style={styles.cancelBtn}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  body:         { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  filterBar:    { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterBtn:    { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:   { fontSize: FONTS.sizes.xs, fontWeight: '700', color: COLORS.textSecond },
  filterTextActive: { color: COLORS.white },

  emptyWrap:    { alignItems: 'center', marginTop: 80, gap: SPACING.md },
  empty:        { textAlign: 'center', color: COLORS.textLight, fontWeight: '600' },

  overlay:      { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  // Width-capped + centered on wide screens; full-width on phones.
  modal:        { width: '100%', maxWidth: MODAL_MAX_WIDTH, backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, maxHeight: '88%' },
  handle:       { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: SPACING.sm },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle:   { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  statusLabel:  { fontWeight: '800', fontSize: FONTS.sizes.md, flex: 1, flexShrink: 1 },
  txDateTime:   { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, flexShrink: 1, textAlign: 'right' },
  sectionLabel: { fontWeight: '800', fontSize: FONTS.sizes.sm, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  itemName:     { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.text },
  itemQty:      { fontSize: FONTS.sizes.sm, color: COLORS.textSecond, marginHorizontal: SPACING.sm },
  itemSub:      { fontWeight: '700', fontSize: FONTS.sizes.sm, color: COLORS.text, minWidth: 70, textAlign: 'right' },
  totalsBox:    { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md, marginVertical: SPACING.md },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel:   { color: COLORS.textSecond, fontSize: FONTS.sizes.sm },
  totalValue:   { color: COLORS.text, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  grandRow:     { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  grandLabel:   { fontWeight: '800', fontSize: FONTS.sizes.md, color: COLORS.text },
  grandValue:   { fontWeight: '800', fontSize: FONTS.sizes.md, color: COLORS.primary },
  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  payInfo:      { flex: 1, minWidth: 0 },
  payMethod:    { fontWeight: '800', color: COLORS.text },
  payRef:       { fontSize: FONTS.sizes.xs, color: COLORS.textSecond },
  payAmount:    { fontWeight: '800', color: COLORS.primary, flexShrink: 0 },
  notes:        { fontSize: FONTS.sizes.sm, color: COLORS.textSecond, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  cancelBtn:    { marginTop: SPACING.sm, marginBottom: SPACING.xl },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md,
    backgroundColor: COLORS.primarySoft,
  },
  shareText:    { color: COLORS.primary, fontWeight: '800', fontSize: FONTS.sizes.md },
});
