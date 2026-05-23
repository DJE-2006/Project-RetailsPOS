import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Alert,
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
import { seedSampleData } from '../../utils/seedData';
import Button from '../../components/Button';

const QUICK_ACTIONS = [
  { label: 'Add Product', icon: 'add-circle-outline', color: COLORS.primary,    nav: { screen: 'Products ', sub: 'AddEditProduct' } },
  { label: 'Categories',  icon: 'pricetag-outline',   color: COLORS.roleManager, nav: { screen: 'Products ', sub: 'Categories' } },
  { label: 'Sales',       icon: 'receipt-outline',    color: COLORS.roleCashier, nav: { screen: 'Sales' } },
  { label: 'Users',       icon: 'people-outline',     color: COLORS.success,    nav: { screen: 'Users' } },
  { label: 'Reports',     icon: 'bar-chart-outline',  color: COLORS.accent,     nav: { screen: 'Reports' } },
];

export default function AdminDashboard({ navigation }) {
  const { profile, logout } = useAuth();
  const { width } = useResponsive();
  // Dashboard body is capped + centered on wide desktop windows.
  const bodyMaxWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const [stats, setStats]     = useState({ todaySales: 0, totalTransactions: 0, lowStock: 0, totalProducts: 0 });
  const [recentTx, setRecentTx] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded]         = useState(false);
  const [seeding, setSeeding]       = useState(false);

  const loadData = useCallback(async () => {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const [txSnap, prodSnap, recentSnap] = await Promise.all([
        // Single inequality filter — status is filtered client-side to
        // avoid requiring a composite Firestore index.
        getDocs(query(
          collection(db, 'transactions'),
          where('createdAt', '>=', Timestamp.fromDate(todayStart)),
        )),
        getDocs(collection(db, 'products')),
        getDocs(query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(5))),
      ]);

      let todaySales = 0, completedToday = 0;
      txSnap.forEach((d) => {
        const t = d.data();
        if (t.status === 'completed') { todaySales += t.total || 0; completedToday++; }
      });
      let lowStock = 0;
      prodSnap.forEach((d) => { if ((d.data().stock || 0) <= 5) lowStock++; });

      setStats({ todaySales, totalTransactions: completedToday, lowStock, totalProducts: prodSnap.size });
      setRecentTx(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await loadData(); setRefreshing(false);
  }, [loadData]);

  const handleLogout = useCallback(() =>
    confirm({
      title: 'Logout',
      message: 'Are you sure?',
      confirmText: 'Logout',
      destructive: true,
      onConfirm: logout,
    }), [logout]);

  // Loads demo products + categories. No-op (safely) if data already exists.
  const handleSeed = useCallback(() => {
    confirm({
      title: 'Load Sample Data',
      message: 'Add example products and categories so the app demos well? This only runs while your catalog is empty.',
      confirmText: 'Load',
      onConfirm: async () => {
        setSeeding(true);
        try {
          const res = await seedSampleData();
          if (res.seeded) {
            Alert.alert('Sample Data Loaded', `Added ${res.products} products across ${res.categories} categories.`);
            await loadData();
          } else {
            Alert.alert('Already Populated', 'Your products or categories already contain data, so nothing was added.');
          }
        } catch (e: any) {
          Alert.alert('Error', e?.message ?? 'Could not load sample data.');
        } finally {
          setSeeding(false);
        }
      },
    });
  }, [loadData]);

  const handleAction = useCallback((nav) => {
    if (nav.sub) navigation.navigate(nav.screen, { screen: nav.sub, initial: false, params: {} });
    else navigation.navigate(nav.screen);
  }, [navigation]);

  const greet = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: SPACING.xxxl, alignItems: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Capped, centered body — does not stretch on wide desktop windows */}
      <View style={[styles.body, { maxWidth: bodyMaxWidth }]}>
      {/* Hero Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greet}</Text>
          <Text style={styles.name}>{profile?.name || 'Admin'}</Text>
          <View style={styles.rolePill}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.white} />
            <Text style={styles.rolePillText}>Administrator</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={8}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Today's Sales – Hero Stat */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Today's Sales</Text>
        <Text style={styles.heroValue}>{formatCurrency(stats.todaySales)}</Text>
        <View style={styles.heroFooter}>
          <Ionicons name="receipt-outline" size={14} color={COLORS.primarySoft} />
          <Text style={styles.heroFooterText}>{stats.totalTransactions} completed transactions</Text>
        </View>
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      {loaded && (
        <FadeInView style={styles.statsGrid}>
          <StatCard icon="cube-outline" label="Products" value={stats.totalProducts} color={COLORS.roleManager} />
          <StatCard
            icon="warning-outline"
            label="Low Stock"
            value={stats.lowStock}
            color={stats.lowStock > 0 ? COLORS.danger : COLORS.success}
            onPress={() => navigation.navigate('Products ')}
          />
        </FadeInView>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {QUICK_ACTIONS.map((a) => (
          <PressScale key={a.label} style={styles.actionBtn} onPress={() => handleAction(a.nav)}>
            <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
              <Ionicons name={a.icon as any} size={24} color={a.color} />
            </View>
            <Text style={styles.actionLabel}>{a.label}</Text>
          </PressScale>
        ))}
      </View>

      {/* Sample Data */}
      {loaded && stats.totalProducts === 0 && (
        <Button
          title="Load Sample Data"
          variant="accent" icon="sparkles-outline"
          loading={seeding} fullWidth
          onPress={handleSeed}
          style={styles.seedBtn}
        />
      )}

      {/* Recent Transactions */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitleInline}>Recent Transactions</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Sales')} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      {recentTx.length === 0
        ? <Text style={styles.empty}>No transactions yet.</Text>
        : recentTx.map((tx) => {
            const c = getStatusColor(tx.status);
            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.txRow}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Sales')}
              >
                <View style={styles.txLeft}>
                  <Text style={styles.txId}>#{tx.id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.txDate}>{formatDateTime(tx.createdAt)}</Text>
                  {tx.cashierName && <Text style={styles.txDate}>By: {tx.cashierName}</Text>}
                </View>
                <View style={styles.txRight}>
                  <Text style={styles.txTotal}>{formatCurrency(tx.total)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: c + '18' }]}>
                    <Text style={[styles.statusText, { color: c }]}>{tx.status}</Text>
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

const StatCard = React.memo(({ icon, label, value, color, onPress }: any) => (
  <TouchableOpacity
    style={[styles.statCard, { borderLeftColor: color }]}
    onPress={onPress}
    activeOpacity={onPress ? 0.85 : 1}
    disabled={!onPress}
  >
    <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon as any} size={22} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
));

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
    backgroundColor: COLORS.primary, alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, marginTop: 6,
  },
  rolePillText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: '700' },
  logoutBtn:    { padding: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.danger + '15' },

  heroCard: {
    margin: SPACING.lg, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl,
    padding: SPACING.xl, ...SHADOW.medium,
  },
  heroLabel:    { color: COLORS.primarySoft, fontSize: FONTS.sizes.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroValue:    { color: COLORS.white, fontSize: FONTS.sizes.xxxl, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  heroFooter:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md },
  heroFooterText:{ color: COLORS.primarySoft, fontSize: FONTS.sizes.xs, fontWeight: '600' },

  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text, paddingHorizontal: SPACING.xl, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitleInline: { fontSize: FONTS.sizes.md, fontWeight: '800', color: COLORS.text },
  seeAll:       { color: COLORS.primary, fontWeight: '700', fontSize: FONTS.sizes.sm },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: SPACING.sm },
  statCard: {
    flex: 1, minWidth: '47%', backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderLeftWidth: 4, ...SHADOW.small,
  },
  statIcon:     { width: 40, height: 40, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  statValue:    { fontSize: FONTS.sizes.xl, fontWeight: '800', color: COLORS.text },
  statLabel:    { fontSize: FONTS.sizes.xs, color: COLORS.textSecond, marginTop: 2, fontWeight: '600' },

  // Wraps to a second row on small phones instead of overflowing.
  actionsRow:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly', rowGap: SPACING.md, paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  seedBtn:      { marginHorizontal: SPACING.xl, marginTop: SPACING.md },
  actionBtn:    { alignItems: 'center', gap: SPACING.xs, minWidth: 76 },
  actionIcon:   { width: 60, height: 60, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  actionLabel:  { fontSize: FONTS.sizes.xs, color: COLORS.text, fontWeight: '700' },

  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, marginHorizontal: SPACING.xl,
    marginBottom: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.small,
  },
  txLeft:       { gap: 2 },
  txRight:      { alignItems: 'flex-end', gap: 4 },
  txId:         { fontWeight: '800', color: COLORS.text, fontSize: FONTS.sizes.md },
  txDate:       { fontSize: FONTS.sizes.xs, color: COLORS.textSecond },
  txTotal:      { fontWeight: '800', color: COLORS.primary, fontSize: FONTS.sizes.md },
  statusBadge:  { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  statusText:   { fontSize: FONTS.sizes.xs, fontWeight: '700' },
  empty:        { textAlign: 'center', color: COLORS.textLight, padding: SPACING.xl },
});
