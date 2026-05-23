import React, { useContext, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import {
  collection, query, where, getDocs, orderBy, Timestamp,
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { db } from '../../../firebase';
import { formatCurrency, formatDateTime, getStatusColor } from '../../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { useResponsive, CONTENT_MAX_WIDTH } from '../../utils/responsive';

const PERIODS = [
  { label: 'Today',      value: 'today' },
  { label: 'This Week',  value: 'week' },
  { label: 'This Month', value: 'month' },
];

const getStartDate = (period) => {
  const start = new Date();
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === 'week') { start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0); }
  else { start.setDate(1); start.setHours(0, 0, 0, 0); }
  return start;
};

export default function ReportsScreen() {
  const navigation = useNavigation<any>();
  const { width } = useResponsive();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const scrollPaddingBottom = tabBarHeight + insets.bottom + SPACING.xl;
  const bodyMaxWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const [period, setPeriod] = useState('today');
  const [stats, setStats]   = useState({ total: 0, count: 0, avgOrder: 0, cancelled: 0 });
  const [topProducts, setTopProducts]   = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const start = getStartDate(period);
      const startTs = Timestamp.fromDate(start);

      const [txSnap, itemsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'transactions'),
          where('createdAt', '>=', startTs),
          orderBy('createdAt', 'desc'),
        )),
        getDocs(query(
          collection(db, 'transaction_items'),
          where('createdAt', '>=', startTs),
        )),
      ]);

      const allTx: any[]     = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const completed = allTx.filter((t: any) => t.status === 'completed');
      const cancelled = allTx.reduce((c: number, t: any) => c + (t.status === 'cancelled' ? 1 : 0), 0);
      const total     = completed.reduce((s: number, t: any) => s + (t.total || 0), 0);

      const productMap = new Map();
      itemsSnap.forEach((d) => {
        const item = d.data();
        const cur = productMap.get(item.productId) || { name: item.productName, qty: 0, revenue: 0 };
        cur.qty     += item.quantity || 0;
        cur.revenue += item.subtotal || 0;
        productMap.set(item.productId, cur);
      });
      const top = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

      setStats({
        total, count: completed.length,
        avgOrder: completed.length ? total / completed.length : 0,
        cancelled,
      });
      setTopProducts(top);
      setTransactions(allTx.slice(0, 20));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadReport(); setRefreshing(false);
  }, [loadReport]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: scrollPaddingBottom, alignItems: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Capped, centered body — does not stretch on wide desktop windows */}
      <View style={[styles.body, { maxWidth: bodyMaxWidth }]}>
      {/* Period Filter */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const active = period === p.value;
          return (
            <TouchableOpacity
              key={p.value}
              style={[styles.periodBtn, active && styles.periodBtnActive]}
              onPress={() => setPeriod(p.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} size="large" />
      ) : (
        <>
          {/* Hero Sales Card */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total Sales</Text>
            <Text style={styles.heroValue}>{formatCurrency(stats.total)}</Text>
            <Text style={styles.heroSub}>{stats.count} completed · Avg {formatCurrency(stats.avgOrder)}</Text>
          </View>

          {/* Stat strip */}
          <View style={styles.statsRow}>
            <StatBox label="Transactions" value={stats.count}     color={COLORS.primary} />
            <StatBox label="Avg. Order"   value={formatCurrency(stats.avgOrder)} color={COLORS.roleManager} />
            <StatBox label="Cancelled"    value={stats.cancelled} color={COLORS.danger} />
          </View>

          {/* Top Products */}
          <Text style={styles.sectionTitle}>Top Products</Text>
          {topProducts.length === 0
            ? <Text style={styles.empty}>No sales data for this period.</Text>
            : topProducts.map((p, i) => (
                <View key={i} style={styles.productRow}>
                  <View style={[styles.rankBadge, i === 0 && { backgroundColor: COLORS.accent }]}>
                    <Text style={styles.rankText}>#{i + 1}</Text>
                  </View>
                  <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                  <View style={styles.productStats}>
                    <Text style={styles.productQty}>{p.qty} sold</Text>
                    <Text style={styles.productRevenue}>{formatCurrency(p.revenue)}</Text>
                  </View>
                </View>
              ))
          }

          {/* Recent Transactions */}
          <Text style={styles.sectionTitle}>Transactions</Text>
          {transactions.length === 0
            ? <Text style={styles.empty}>No transactions found.</Text>
            : transactions.map((tx) => {
                const c = getStatusColor(tx.status);
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.txRow}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Sales')}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.txId} numberOfLines={1}>#{tx.id.slice(-6).toUpperCase()}</Text>
                      <Text style={styles.txDate} numberOfLines={1}>{formatDateTime(tx.createdAt)}</Text>
                      <Text style={styles.txCashier} numberOfLines={1}>By: {tx.cashierName || '—'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                      <Text style={styles.txTotal}>{formatCurrency(tx.total)}</Text>
                      <View style={[styles.badge, { backgroundColor: c + '18' }]}>
                        <Text style={[styles.badgeText, { color: c }]}>{tx.status}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
          }
        </>
      )}
      </View>
    </ScrollView>
  );
}

const StatBox = React.memo(({ label, value, color }: any) => (
  <View style={[styles.statBox, { borderTopColor: color }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  body:         { width: '100%', alignSelf: 'center' },
  periodRow:    { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: COLORS.surface, padding: SPACING.md, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  periodBtn:    { flex: 1, minWidth: 96, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  periodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodText:   { fontSize: FONTS.sizes.sm, color: COLORS.textSecond, fontWeight: '700' },
  periodTextActive: { color: COLORS.white },

  heroCard:     { margin: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: SPACING.xl, ...SHADOW.medium },
  heroLabel:    { color: COLORS.primarySoft, fontSize: FONTS.sizes.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroValue:    { color: COLORS.white, fontSize: FONTS.sizes.xxxl, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  heroSub:      { color: COLORS.primarySoft, fontSize: FONTS.sizes.xs, fontWeight: '600', marginTop: 4 },

  statsRow:     { flexDirection: 'row', paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md },
  statBox: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderTopWidth: 3, alignItems: 'center', ...SHADOW.small,
  },
  statValue:    { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  statLabel:    { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2, textAlign: 'center', fontWeight: '600' },

  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, paddingHorizontal: SPACING.xl, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  productRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.small,
  },
  rankBadge:    { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  rankText:     { color: COLORS.white, fontWeight: '800', fontSize: FONTS.sizes.xs },
  productName:  { flex: 1, fontWeight: '700', color: COLORS.text, fontSize: FONTS.sizes.sm },
  productStats: { alignItems: 'flex-end' },
  productQty:   { fontSize: FONTS.sizes.xs, color: COLORS.textSecond },
  productRevenue:{ fontWeight: '800', color: COLORS.primary, fontSize: FONTS.sizes.sm },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.small,
  },
  txId:         { fontWeight: '800', color: COLORS.text },
  txDate:       { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2 },
  txCashier:    { fontSize: FONTS.sizes.xs, color: COLORS.textLight },
  txTotal:      { fontWeight: '800', color: COLORS.primary },
  badge:        { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, marginTop: 4 },
  badgeText:    { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  empty:        { textAlign: 'center', color: COLORS.textLight, padding: SPACING.xl },
});
