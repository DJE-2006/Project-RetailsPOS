import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../../firebase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, getStatusColor } from '../../utils/formatters';
import { COLORS, FONTS, SPACING, RADIUS, SHADOW } from '../../utils/theme';
import { useResponsive, CONTENT_MAX_WIDTH } from '../../utils/responsive';
import { FadeInView, PressScale } from '../../utils/motion';
import { confirm } from '../../utils/confirm';

export default function ManagerDashboard({ navigation }) {
  const { profile, logout } = useAuth();
  const { width } = useResponsive();
  const bodyMaxWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const [stats, setStats]     = useState({ todaySales: 0, weekSales: 0, txToday: 0, lowStock: 0 });
  const [recentTx, setRecentTx] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded]         = useState(false);

  const loadData = useCallback(async () => {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);

      // Single inequality filter — status filtered client-side to
      // avoid requiring composite Firestore indexes.
      const [weekSnap, prodSnap, recentSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'transactions'),
          where('createdAt', '>=', Timestamp.fromDate(weekStart)),
        )),
        getDocs(collection(db, 'products')),
        getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(8))),
      ]);

      const todayMs = todayStart.getTime();
      let todaySales = 0, weekSales = 0, lowStock = 0, txToday = 0;
      weekSnap.forEach((d) => {
        const t = d.data();
        if (t.status !== 'completed') return;
        weekSales += t.total || 0;
        const ms = t.createdAt?.toMillis?.() || 0;
        if (ms >= todayMs) { todaySales += t.total || 0; txToday++; }
      });
      prodSnap.forEach((d)  => { if ((d.data().stock || 0) <= 5) lowStock++; });

      setStats({ todaySales, weekSales, txToday, lowStock });
      setRecentTx(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadData(); setRefreshing(false);
  }, [loadData]);

  const handleLogout = useCallback(() =>
    confirm({
      title: 'Logout',
      message: 'Sign out?',
      confirmText: 'Logout',
      destructive: true,
      onConfirm: logout,
    }), [logout]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: SPACING.xxxl, alignItems: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Capped, centered body — does not stretch on wide desktop windows */}
      <View style={[styles.body, { maxWidth: bodyMaxWidth }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Manager View</Text>
          <Text style={styles.name}>{profile?.name || 'Manager'}</Text>
          <View style={styles.rolePill}>
            <Ionicons name="briefcase" size={12} color={COLORS.white} />
            <Text style={styles.rolePillText}>Manager</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Today's Sales</Text>
        <Text style={styles.heroValue}>{formatCurrency(stats.todaySales)}</Text>
        <Text style={styles.heroSub}>{stats.txToday} orders today</Text>
      </View>

      {/* Summary Cards */}
      <Text style={styles.sectionTitle}>Sales Summary</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
        {[
          { label: "Week's Sales",    value: formatCurrency(stats.weekSales),  icon: 'trending-up-outline', color: COLORS.primary },
          { label: "Today's Orders",  value: stats.txToday,                    icon: 'receipt-outline',     color: COLORS.roleManager },
          { label: 'Low Stock Items', value: stats.lowStock,                   icon: 'warning-outline',     color: stats.lowStock > 0 ? COLORS.danger : COLORS.success },
        ].map((c, i) => (
          loaded ? (
            <FadeInView key={c.label} style={styles.summaryCard} delay={i * 80}>
              <View style={[styles.summaryIcon, { backgroundColor: c.color + '18' }]}>
                <Ionicons name={c.icon as any} size={22} color={c.color} />
              </View>
              <Text style={[styles.summaryValue, { color: c.color }]}>{c.value}</Text>
              <Text style={styles.summaryLabel}>{c.label}</Text>
            </FadeInView>
          ) : (
            <View key={c.label} style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: c.color + '18' }]}>
                <Ionicons name={c.icon as any} size={22} color={c.color} />
              </View>
              <Text style={[styles.summaryValue, { color: c.color }]}>{c.value}</Text>
              <Text style={styles.summaryLabel}>{c.label}</Text>
            </View>
          )
        ))}
      </ScrollView>

      {/* Quick Nav */}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.navRow}>
        <PressScale style={styles.navBtn} onPress={() => navigation.navigate('Sales')}>
          <View style={styles.navIcon}>
            <Ionicons name="receipt-outline" size={26} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navLabel}>All Transactions</Text>
            <Text style={styles.navSub}>Browse and review every sale</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </PressScale>
        <PressScale style={styles.navBtn} onPress={() => navigation.navigate('Reports')}>
          <View style={styles.navIcon}>
            <Ionicons name="analytics-outline" size={26} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navLabel}>Full Reports</Text>
            <Text style={styles.navSub}>Sales analytics & breakdowns</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </PressScale>
      </View>

      {/* Recent Transactions */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitleInline}>Recent Transactions</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Sales')} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      {recentTx.length === 0
        ? <Text style={styles.empty}>No transactions found.</Text>
        : recentTx.map((tx) => {
            const c = getStatusColor(tx.status);
            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.txRow}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Sales')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.txId}>#{tx.id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.txDate}>{formatDateTime(tx.createdAt)}</Text>
                  {tx.cashierName && <Text style={styles.txCashier}>Cashier: {tx.cashierName}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.txTotal}>{formatCurrency(tx.total)}</Text>
                  <View style={[styles.badge, { backgroundColor: c + '18' }]}>
                    <Text style={[styles.badgeText, { color: c }]}>{tx.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
      }
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  body:         { width: '100%', alignSelf: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: SPACING.xl, backgroundColor: COLORS.surface, ...SHADOW.small,
  },
  greeting:     { fontSize: FONTS.sizes.sm, color: COLORS.textSecond },
  name:         { fontSize: FONTS.sizes.xxl, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.roleManager, alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, marginTop: 6,
  },
  rolePillText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: '700' },
  logoutBtn:    { padding: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.danger + '15' },

  heroCard:     { margin: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: SPACING.xl, ...SHADOW.medium },
  heroLabel:    { color: COLORS.primarySoft, fontSize: FONTS.sizes.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroValue:    { color: COLORS.white, fontSize: FONTS.sizes.xxxl, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  heroSub:      { color: COLORS.primarySoft, fontSize: FONTS.sizes.xs, fontWeight: '600', marginTop: 4 },

  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, paddingHorizontal: SPACING.xl, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitleInline: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text },
  seeAll:       { color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sizes.sm },
  summaryRow:   { paddingHorizontal: SPACING.lg, gap: SPACING.md, paddingRight: SPACING.xl },
  summaryCard: {
    width: 150, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.small,
  },
  summaryIcon:  { width: 44, height: 44, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  summaryValue: { fontSize: FONTS.sizes.lg, fontWeight: '800' },
  summaryLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2, fontWeight: '600' },

  navRow:       { paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  navBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.md, ...SHADOW.small },
  navIcon:      { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  navLabel:     { fontWeight: '800', color: COLORS.text, fontSize: FONTS.sizes.md },
  navSub:       { color: COLORS.textSecond, fontSize: FONTS.sizes.xs, marginTop: 2 },

  txRow: {
    flexDirection: 'row', backgroundColor: COLORS.surface, marginHorizontal: SPACING.xl,
    marginBottom: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.small,
  },
  txId:         { fontWeight: '800', color: COLORS.text },
  txDate:       { fontSize: FONTS.sizes.xs, color: COLORS.textSecond },
  txCashier:    { fontSize: FONTS.sizes.xs, color: COLORS.textLight },
  txTotal:      { fontWeight: '800', color: COLORS.primary },
  badge:        { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full, marginTop: 4 },
  badgeText:    { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  empty:        { textAlign: 'center', color: COLORS.textLight, padding: SPACING.xl },
});
