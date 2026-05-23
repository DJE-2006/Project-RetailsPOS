import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  addDoc, collection, doc, getDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Ionicons } from '@expo/vector-icons';
import { db, storage } from '../../../firebase';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { FORM_MAX_WIDTH } from '../../utils/responsive';
import { pickImage as pickImageShim } from '../../utils/imagePicker';
import { shareReceipt } from '../../utils/receipt';
import { FadeInView, PressScale, animateLayout } from '../../utils/motion';
import Button from '../../components/Button';

const PAYMENT_METHODS = [
  { key: 'cash',  label: 'Cash',  icon: 'cash-outline',           color: COLORS.cashColor },
  { key: 'gcash', label: 'GCash', icon: 'phone-portrait-outline', color: COLORS.gcashColor },
  { key: 'card',  label: 'Card',  icon: 'card-outline',           color: COLORS.cardColor },
];

const makePayment = () => ({ method: 'cash', amount: '', reference: '', proofUri: null });

const uploadImage = async (uri: string, path: string) => {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob);
    task.on('state_changed', null, reject, () => resolve());
  });
  return getDownloadURL(storageRef);
};

export default function PaymentScreen({ navigation }: any) {
  const { items, subtotal, tax, total, discount, setDiscount, clearCart } = useCart();
  const { profile } = useAuth();
  const [discountInput, setDiscountInput] = useState(discount ? String(discount) : '');

  const applyDiscount = useCallback(() => {
    const v = parseFloat(discountInput);
    if (isNaN(v) || v < 0) { Alert.alert('Invalid discount', 'Enter a valid amount.'); return; }
    const maxDiscount = subtotal + tax;
    if (v > maxDiscount) { Alert.alert('Invalid discount', `Discount cannot exceed ${formatCurrency(maxDiscount)}.`); return; }
    setDiscount(v);
  }, [discountInput, subtotal, tax, setDiscount]);

  const clearDiscount = useCallback(() => { setDiscount(0); setDiscountInput(''); }, [setDiscount]);

  const [payments, setPayments]         = useState([makePayment()]);
  const [notes, setNotes]               = useState('');
  const [processing, setProcessing]     = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);

  // ── Derived totals (memoized) ───────────────────────────
  const totalPaid = useMemo(
    () => payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
    [payments]
  );
  const change      = Math.max(0, totalPaid - total);
  const remaining   = Math.max(0, total - totalPaid);
  const canCheckout = totalPaid >= total && items.length > 0;

  // ── Payment helpers ─────────────────────────────────────
  const setPaymentField = useCallback((idx, field, value) =>
    setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))),
  []);

  const addPayment = useCallback(() => {
    if (totalPaid >= total) { Alert.alert('Payment Complete', 'Total is already covered.'); return; }
    animateLayout();
    setPayments((prev) => [...prev, makePayment()]);
  }, [totalPaid, total]);

  const removePayment = useCallback((idx) => {
    animateLayout();
    setPayments((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  }, []);

  // ── Proof of Payment Upload ─────────────────────────────
  const pickProof = useCallback(async (idx) => {
    const result = await pickImageShim({ aspect: [3, 4], quality: 0.7, allowsEditing: false });
    if (result?.uri) setPaymentField(idx, 'proofUri', result.uri);
  }, [setPaymentField]);

  // ── Checkout ────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    for (let i = 0; i < payments.length; i++) {
      const amt = parseFloat(payments[i].amount);
      if (!amt || amt <= 0) { Alert.alert('Validation', `Enter a valid amount for payment ${i + 1}.`); return; }
      if (payments[i].method === 'gcash' && !payments[i].reference.trim()) {
        Alert.alert('Validation', `Enter a GCash reference for payment ${i + 1}.`); return;
      }
    }
    if (!canCheckout) { Alert.alert('Incomplete', `Still ${formatCurrency(remaining)} remaining.`); return; }

    setProcessing(true);
    try {
      // 1. Create transaction document
      const txRef = await addDoc(collection(db, 'transactions'), {
        cashierId:   profile.uid,
        cashierName: profile.name,
        status:      'completed',
        subtotal, tax, discount: discount || 0, total, totalPaid, change,
        notes:       notes.trim(),
        itemCount:   items.reduce((s, i) => s + i.quantity, 0),
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      const txId = txRef.id;

      // 2. Items + inventory in parallel
      await Promise.all(items.map(async (item) => {
        const productRef = doc(db, 'products', item.id);
        const prodSnap   = await getDoc(productRef);
        const prevStock  = prodSnap.exists() ? (prodSnap.data().stock || 0) : 0;
        const newStock   = Math.max(0, prevStock - item.quantity);

        return Promise.all([
          addDoc(collection(db, 'transaction_items'), {
            transactionId: txId,
            productId:     item.id,
            productName:   item.name,
            price:         item.price,
            quantity:      item.quantity,
            subtotal:      item.subtotal,
            createdAt:     serverTimestamp(),
          }),
          addDoc(collection(db, 'inventory_logs'), {
            productId:     item.id,
            productName:   item.name,
            type:          'sale',
            quantity:      -item.quantity,
            previousStock: prevStock,
            newStock,
            transactionId: txId,
            createdAt:     serverTimestamp(),
          }),
          prodSnap.exists()
            ? updateDoc(productRef, { stock: newStock, previousStock: prevStock, updatedAt: serverTimestamp() })
            : Promise.resolve(),
        ]);
      }));

      // 3. Upload proofs (sequential to surface errors per index) + payment docs
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        let proofUrl = '';
        if (p.proofUri) {
          setUploadingIdx(i);
          try {
            proofUrl = await uploadImage(p.proofUri, `payment_proofs/${txId}_${i}_${Date.now()}.jpg`);
          } finally {
            setUploadingIdx(null);
          }
        }
        await addDoc(collection(db, 'payments'), {
          transactionId: txId,
          method:        p.method,
          amount:        parseFloat(p.amount),
          reference:     p.reference.trim(),
          proofUrl,
          createdAt:     serverTimestamp(),
        });
      }

      // 4. Receipt snapshot
      const receiptData = {
        transactionId: txId,
        cashierId:     profile.uid,
        cashierName:   profile.name,
        items:         items.map((i) => ({ productId: i.id, name: i.name, price: i.price, quantity: i.quantity, subtotal: i.subtotal })),
        payments:      payments.map((p) => ({ method: p.method, amount: parseFloat(p.amount), reference: p.reference })),
        subtotal, tax, discount: discount || 0, total, totalPaid, change,
      };
      await addDoc(collection(db, 'receipts'), { ...receiptData, createdAt: serverTimestamp() });

      clearCart();
      setDiscount(0);
      Alert.alert(
        'Sale Complete',
        `Total: ${formatCurrency(total)}\nPaid: ${formatCurrency(totalPaid)}\nChange: ${formatCurrency(change)}`,
        [
          {
            text: 'Share Receipt',
            onPress: async () => {
              await shareReceipt({ ...receiptData, createdAt: new Date() });
              navigation.navigate('POS');
            },
          },
          { text: 'New Transaction', onPress: () => navigation.navigate('POS') },
        ]
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Unknown error');
    } finally {
      setProcessing(false);
    }
  }, [payments, canCheckout, remaining, profile, subtotal, tax, total, totalPaid, change, discount, notes, items, clearCart, setDiscount, navigation]);

  const handleCancel = useCallback(() =>
    Alert.alert('Cancel Transaction', 'Discard this transaction?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { clearCart(); navigation.navigate('POS'); } },
    ]),
  [clearCart, navigation]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Width-capped, centered column — does not stretch on tablet/desktop */}
        <View style={styles.column}>

        {/* Order Summary */}
        <FadeInView style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemQty}>×{item.quantity}</Text>
              <Text style={styles.itemSubtotal}>{formatCurrency(item.subtotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>VAT (12%)</Text><Text style={styles.totalValue}>{formatCurrency(tax)}</Text></View>
          {discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: COLORS.success }]}>Discount</Text>
              <Text style={{ color: COLORS.success, fontWeight: '700' }}>-{formatCurrency(discount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>TOTAL DUE</Text>
            <Text style={styles.grandValue}>{formatCurrency(total)}</Text>
          </View>
        </FadeInView>

        {/* Discount */}
        <FadeInView style={styles.card} delay={80}>
          <Text style={styles.cardTitle}>Discount (optional)</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
            <TextInput
              style={[styles.refInput, { flex: 1, marginBottom: 0 }]}
              value={discountInput}
              onChangeText={setDiscountInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.applyBtn} onPress={applyDiscount} activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
            {discount > 0 && (
              <TouchableOpacity style={styles.clearDiscountBtn} onPress={clearDiscount} activeOpacity={0.85}>
                <Ionicons name="close" size={16} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>
          {discount > 0 && (
            <Text style={{ color: COLORS.success, fontWeight: '700', marginTop: SPACING.sm }}>
              Applied: -{formatCurrency(discount)}
            </Text>
          )}
        </FadeInView>

        {/* Payment Splits */}
        <FadeInView style={styles.card} delay={160}>
          <View style={styles.payHeader}>
            <Text style={styles.cardTitle}>Payment</Text>
            <TouchableOpacity onPress={addPayment} style={styles.addPayBtn} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.addPayText}>Split</Text>
            </TouchableOpacity>
          </View>

          {payments.map((pay, idx) => (
            <View key={idx} style={styles.paymentBlock}>
              {payments.length > 1 && (
                <View style={styles.paymentBlockHeader}>
                  <Text style={styles.paymentNum}>Payment {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removePayment(idx)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map((m) => {
                  const active = pay.method === m.key;
                  return (
                    <PressScale
                      key={m.key}
                      style={[styles.methodBtn, active && { backgroundColor: m.color + '15', borderColor: m.color }]}
                      onPress={() => { animateLayout(); setPaymentField(idx, 'method', m.key); }}
                    >
                      <Ionicons name={m.icon as any} size={22} color={active ? m.color : COLORS.textLight} />
                      <Text style={[styles.methodLabel, active && { color: m.color, fontWeight: '800' }]}>{m.label}</Text>
                    </PressScale>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Amount (₱)</Text>
              <TextInput
                style={styles.amountInput}
                value={pay.amount}
                onChangeText={(v) => setPaymentField(idx, 'amount', v)}
                keyboardType="decimal-pad"
                placeholder={formatCurrency(remaining > 0 ? remaining : total)}
                placeholderTextColor={COLORS.textLight}
              />

              {pay.method === 'cash' && parseFloat(pay.amount) > 0 && payments.length === 1 && (
                <Text style={styles.changeHint}>
                  Change: {formatCurrency(Math.max(0, parseFloat(pay.amount) - total))}
                </Text>
              )}

              {pay.method === 'gcash' && (
                <>
                  <Text style={styles.fieldLabel}>Reference No. *</Text>
                  <TextInput
                    style={styles.refInput}
                    value={pay.reference}
                    onChangeText={(v) => setPaymentField(idx, 'reference', v)}
                    placeholder="13-digit GCash ref"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                  />
                </>
              )}

              {pay.method === 'card' && (
                <>
                  <Text style={styles.fieldLabel}>Last 4 Digits</Text>
                  <TextInput
                    style={styles.refInput}
                    value={pay.reference}
                    onChangeText={(v) => setPaymentField(idx, 'reference', v)}
                    placeholder="e.g. 1234"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </>
              )}

              {(pay.method === 'gcash' || pay.method === 'card') && (
                <TouchableOpacity style={styles.proofBtn} onPress={() => pickProof(idx)} activeOpacity={0.85}>
                  {pay.proofUri
                    ? <Image source={{ uri: pay.proofUri }} style={styles.proofThumb} />
                    : <>
                        <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.proofBtnText}>Upload Proof of Payment</Text>
                      </>
                  }
                  {uploadingIdx === idx && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              )}
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={[styles.totalLabel, { color: totalPaid >= total ? COLORS.success : COLORS.warning, fontWeight: '800' }]}>
              {formatCurrency(totalPaid)}
            </Text>
          </View>
          {remaining > 0 && <Text style={styles.remainingText}>Still needed: {formatCurrency(remaining)}</Text>}
          {change > 0 && <Text style={styles.changeText}>Change: {formatCurrency(change)}</Text>}
        </FadeInView>

        {/* Notes */}
        <FadeInView style={styles.card} delay={240}>
          <Text style={styles.cardTitle}>Notes (optional)</Text>
          <TextInput
            style={[styles.refInput, { height: 70 }]}
            value={notes} onChangeText={setNotes}
            placeholder="Transaction notes…"
            placeholderTextColor={COLORS.textLight}
            multiline
            textAlignVertical="top"
          />
        </FadeInView>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            title="Cancel" variant="destructive" size="lg"
            onPress={handleCancel} style={styles.cancelBtn}
          />
          <Button
            title="Confirm Sale" variant="success" size="lg"
            icon="checkmark-circle" loading={processing}
            disabled={!canCheckout} onPress={handleCheckout}
            style={styles.confirmBtn}
          />
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  scrollContent:{ padding: SPACING.xl, paddingBottom: SPACING.xxxl + SPACING.xl, alignItems: 'center' },
  // Capped at a comfortable single-column width and centered on wide screens.
  column:       { width: '100%', maxWidth: FORM_MAX_WIDTH + 120, alignSelf: 'center' },
  card:         { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOW.small },
  cardTitle:    { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  orderItem:    { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  itemName:     { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.text },
  itemQty:      { fontSize: FONTS.sizes.sm, color: COLORS.textSecond, marginHorizontal: SPACING.sm },
  itemSubtotal: { fontWeight: '700', color: COLORS.text, minWidth: 80, textAlign: 'right' },
  divider:      { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.md },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel:   { color: COLORS.textSecond, fontSize: FONTS.sizes.sm },
  totalValue:   { color: COLORS.text, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  grandRow:     { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  grandLabel:   { fontWeight: '800', fontSize: FONTS.sizes.lg, color: COLORS.text },
  grandValue:   { fontWeight: '800', fontSize: FONTS.sizes.lg, color: COLORS.primary },
  payHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  addPayBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary },
  addPayText:   { color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sizes.sm },
  paymentBlock: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.surfaceAlt },
  paymentBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  paymentNum:   { fontWeight: '700', color: COLORS.text },
  methodRow:    { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  methodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border, gap: 4, backgroundColor: COLORS.surface,
  },
  methodLabel:  { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, fontWeight: '600' },
  fieldLabel:   { fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  amountInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONTS.sizes.xxl, fontWeight: '800',
    color: COLORS.primary, marginBottom: SPACING.sm, textAlign: 'right',
    backgroundColor: COLORS.surface,
  },
  refInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONTS.sizes.md, color: COLORS.text, marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  changeHint:    { fontSize: FONTS.sizes.sm, color: COLORS.success, fontWeight: '700', marginBottom: SPACING.sm },
  proofBtn: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md,
    justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.sm, backgroundColor: COLORS.primarySoft,
  },
  proofBtnText:  { color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sizes.sm },
  proofThumb:    { width: 64, height: 64, borderRadius: RADIUS.sm },
  remainingText: { color: COLORS.danger, fontWeight: '800', textAlign: 'right', fontSize: FONTS.sizes.sm, marginTop: 4 },
  changeText:    { color: COLORS.success, fontWeight: '800', textAlign: 'right', fontSize: FONTS.sizes.sm, marginTop: 4 },
  actionRow:     { flexDirection: 'row', gap: SPACING.md },
  cancelBtn:     { flex: 1 },
  confirmBtn:    { flex: 2 },
  applyBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, height: 46, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  applyBtnText:  { color: COLORS.white, fontWeight: '800' },
  clearDiscountBtn: { width: 38, height: 46, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.danger, justifyContent: 'center', alignItems: 'center' },
});
