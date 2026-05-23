import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../../firebase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatTime } from '../../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { useResponsive, CONTENT_MAX_WIDTH } from '../../utils/responsive';
import { FadeInView } from '../../utils/motion';

// Daily shift close-out summary for the signed-in cashier.
export default function ShiftSummaryScreen() {
  const { profile } = useAuth();
  const { width } = useResponsive();
  const insets = useSafeAreaInsets();
  const scrollPaddingBottom = insets.bottom + SPACING.xxxl;
  const bodyMaxWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    sales: 0, count: 0, cancelled: 0, items: 0, avg: 0,
    cash: 0, gcash: 0, card: 0,
    first: null as any, last: null as any,
  });

  const load = useCallback(async () => {
    if (!profile?.uid) return;
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayMs = todayStart.getTime();

      // Single equality filter — today's window is applied client-side
      // so no composite Firestore index is required.
      const txSnap = await getDocs(query(
        collection(db, 'transactions'),
        where('cashierId', '==', profile.uid),
      ));

      const txs = txSnap.docs
        .map((d) => ({ id: d.id, ...d.data() as any }))
        .filter((t) => (t.createdAt?.toMillis?.() || 0) >= todayMs);
      const completed = txs.filter((t) => t.status === 'completed');
      const cancelled = txs.filter((t) => t.status === 'cancelled').length;
      const sales = completed.reduce((s, t) => s + (t.total || 0), 0);
      const itemsSold = completed.reduce((s, t) => s + (t.itemCount || 0), 0);

      // Payment method breakdown across completed transactions.
      let cash = 0, gcash = 0, card = 0;
      if (completed.length) {
        const paySnaps = await Promise.all(
          completed.map((t) =>
            getDocs(query(collection(db, 'payments'), where('transactionId', '==', t.id)))
          )
        );
        paySnaps.forEach((snap) => snap.forEach((p) => {
          const d = p.data();
          if (d.method === 'cash')  cash  += d.amount || 0;
          else if (d.method === 'gcash') gcash += d.amount || 0;
          else if (d.method === 'card')  card  += d.amount || 0;
        }));
      }

      const sorted = [...txs].sort((a, b) => {
        const av = a.createdAt?.toMillis?.() || 0;
        const bv = b.createdAt?.toMillis?.() || 0;
        return av - bv;
      });

      setSummary({
        sales, count: completed.length, cancelled, items: itemsSold,
        avg: completed.length ? sales / completed.length : 0,
        cash, gcash, card,
        first: sorted[0]?.createdAt || null,
        last: sorted[sorted.length - 1]?.createdAt || null,
      });
    } catch (e) {
      console.error('ShiftSummary load error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.uid]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: scrollPaddingBottom, alignItems: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Capped, centered body — does not stretch on wide desktop windows */}
      <View style={[styles.body, { maxWidth: bodyMaxWidth }]}>
      {/* Hero */}
      <FadeInView style={styles.hero}>
        <Text style={styles.heroLabel}>MY SHIFT TODAY</Text>
        <Text style={styles.heroValue}>{formatCurrency(summary.sales)}</Text>
        <Text style={styles.heroSub}>
          {summary.count} sale{summary.count === 1 ? '' : 's'} · {summary.items} items
          {summary.first ? ` · since ${formatTime(summary.first)}` : ''}
        </Text>
      </FadeInView>

      {/* Quick stats */}
      <FadeInView style={styles.statRow} delay={90}>
        <Stat label="Transactions" value={String(summary.count)}            color={COLORS.primary} />
        <Stat label="Avg. Sale"    value={formatCurrency(summary.avg)}       color={COLORS.roleManager} />
        <Stat label="Cancelled"    value={String(summary.cancelled)}         color={COLORS.danger} />
      </FadeInView>

      {/* Payment breakdown */}
      <Text style={styles.sectionTitle}>Payment Breakdown</Text>
      <FadeInView style={styles.card} delay={180}>
        <PayRow icon="cash-outline"           label="Cash"  amount={summary.cash}  color={COLORS.cashColor} />
        <PayRow icon="phone-portrait-outline" label="GCash" amount={summary.gcash} color={COLORS.gcashColor} />
        <PayRow icon="card-outline"           label="Card"  amount={summary.card}  color={COLORS.cardColor} />
        <View style={styles.totalLine}>
          <Text style={styles.totalLineLabel}>Total Collected</Text>
          <Text style={styles.totalLineValue}>
            {formatCurrency(summary.cash + summary.gcash + summary.card)}
          </Text>
        </View>
      </FadeInView>

      {/* Shift window */}
      <Text style={styles.sectionTitle}>Shift Window</Text>
      <FadeInView style={styles.card} delay={260}>
        <View style={styles.windowRow}>
          <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          <Text style={styles.windowLabel}>First sale</Text>
          <Text style={styles.windowValue}>{summary.first ? formatTime(summary.first) : '—'}</Text>
        </View>
        <View style={styles.windowRow}>
          <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          <Text style={styles.windowLabel}>Last sale</Text>
          <Text style={styles.windowValue}>{summary.last ? formatTime(summary.last) : '—'}</Text>
        </View>
      </FadeInView>

      <Text style={styles.note}>
        Pull down to refresh. Cash drawer should match the cash total above at close-out.
      </Text>
      </View>
    </ScrollView>
  );
}

const Stat = ({ label, value, color }: any) => (
  <View style={[styles.statBox, { borderTopColor: color }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const PayRow = ({ icon, label, amount, color }: any) => (
  <View style={styles.payRow}>
    <View style={[styles.payIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={styles.payLabel}>{label}</Text>
    <Text style={[styles.payAmount, { color }]}>{formatCurrency(amount)}</Text>
  </View>
);

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  body:       { width: '100%', alignSelf: 'center' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  hero:       { margin: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: SPACING.xl, ...SHADOW.medium },
  heroLabel:  { color: COLORS.primarySoft, fontSize: FONTS.sizes.xs, fontWeight: '800', letterSpacing: 0.6 },
  heroValue:  { color: COLORS.white, fontSize: FONTS.sizes.xxxl, fontWeight: '800', marginTop: 4 },
  heroSub:    { color: COLORS.primarySoft, fontSize: FONTS.sizes.xs, fontWeight: '600', marginTop: 4 },
  statRow:    { flexDirection: 'row', paddingHorizontal: SPACING.md, gap: SPACING.sm },
  statBox:    { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderTopWidth: 3, alignItems: 'center', ...SHADOW.small },
  statValue:  { fontSize: FONTS.sizes.lg, fontWeight: '800', textAlign: 'center' },
  statLabel:  { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, paddingHorizontal: SPACING.xl, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  card:       { backgroundColor: COLORS.surface, marginHorizontal: SPACING.lg, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.small },
  payRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, gap: SPACING.md },
  payIcon:    { width: 36, height: 36, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  payLabel:   { flex: 1, fontWeight: '700', color: COLORS.text, fontSize: FONTS.sizes.sm },
  payAmount:  { fontWeight: '800', fontSize: FONTS.sizes.sm, flexShrink: 0 },
  totalLine:  { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.sm, paddingTop: SPACING.md },
  totalLineLabel: { fontWeight: '800', color: COLORS.text },
  totalLineValue: { fontWeight: '800', color: COLORS.primary, fontSize: FONTS.sizes.md },
  windowRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  windowLabel:{ flex: 1, color: COLORS.textSecond, fontSize: FONTS.sizes.sm },
  windowValue:{ fontWeight: '800', color: COLORS.text },
  note:       { color: COLORS.textLight, fontSize: FONTS.sizes.xs, textAlign: 'center', paddingHorizontal: SPACING.xl, marginTop: SPACING.lg },
});
