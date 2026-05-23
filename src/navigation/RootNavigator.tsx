import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { COLORS } from '../utils/theme';

// ── Auth Screens ────────────────────────────────────────────
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// ── Admin Screens ───────────────────────────────────────────
import AdminDashboard from '../screens/admin/AdminDashboard';
import ProductsScreen from '../screens/admin/ProductsScreen';
import AddEditProductScreen from '../screens/admin/AddEditProductScreen';
import CategoriesScreen from '../screens/admin/CategoriesScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';

// ── Manager Screens ─────────────────────────────────────────
import ManagerDashboard from '../screens/manager/ManagerDashboard';
import ManagerReports from '../screens/manager/ManagerReports';

// ── Cashier Screens ─────────────────────────────────────────
import POSScreen from '../screens/cashier/POSScreen';
import PaymentScreen from '../screens/cashier/PaymentScreen';
import TransactionsScreen from '../screens/cashier/TransactionsScreen';
import ShiftSummaryScreen from '../screens/cashier/ShiftSummaryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Auth Stack ──────────────────────────────────────────────
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

// ── Admin Tab Navigator ─────────────────────────────────────
const AdminStack = createNativeStackNavigator();
const AdminProductsStack = () => (
  <AdminStack.Navigator
    screenOptions={{ headerStyle: { backgroundColor: COLORS.white }, headerTintColor: COLORS.primary }}
  >
    <AdminStack.Screen name="Products" component={ProductsScreen} />
    <AdminStack.Screen name="AddEditProduct" component={AddEditProductScreen} options={{ title: 'Product' }} />
    <AdminStack.Screen name="Categories" component={CategoriesScreen} />
  </AdminStack.Navigator>
);

const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Dashboard: 'grid-outline',
          'Products ': 'cube-outline',
          Sales: 'receipt-outline',
          Users: 'people-outline',
          Reports: 'bar-chart-outline',
        };
        return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textLight,
      tabBarStyle: { backgroundColor: COLORS.white, borderTopColor: COLORS.border },
      headerStyle: { backgroundColor: COLORS.white },
      headerTintColor: COLORS.primary,
    })}
  >
    <Tab.Screen name="Dashboard" component={AdminDashboard} />
    <Tab.Screen name="Products " component={AdminProductsStack} options={{ headerShown: false }} />
    <Tab.Screen name="Sales" component={TransactionsScreen} options={{ title: 'Transactions' }} />
    <Tab.Screen name="Users" component={UsersScreen} />
    <Tab.Screen name="Reports" component={ReportsScreen} />
  </Tab.Navigator>
);

// ── Manager Tab Navigator ───────────────────────────────────
const ManagerTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Dashboard: 'speedometer-outline',
          Sales: 'receipt-outline',
          Reports: 'analytics-outline',
        };
        return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textLight,
      tabBarStyle: { backgroundColor: COLORS.white, borderTopColor: COLORS.border },
      headerStyle: { backgroundColor: COLORS.white },
      headerTintColor: COLORS.primary,
    })}
  >
    <Tab.Screen name="Dashboard" component={ManagerDashboard} />
    <Tab.Screen name="Sales" component={TransactionsScreen} options={{ title: 'Transactions' }} />
    <Tab.Screen name="Reports" component={ManagerReports} />
  </Tab.Navigator>
);

// ── Cashier Stack ───────────────────────────────────────────
const CashierStack = () => (
  <Stack.Navigator
    screenOptions={{ headerStyle: { backgroundColor: COLORS.white }, headerTintColor: COLORS.primary }}
  >
    <Stack.Screen name="POS" component={POSScreen} options={{ title: 'RetailPOS — Cashier' }} />
    <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Checkout' }} />
    <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transaction History' }} />
    <Stack.Screen name="ShiftSummary" component={ShiftSummaryScreen} options={{ title: 'My Shift Summary' }} />
  </Stack.Navigator>
);

// ── Root Navigator ──────────────────────────────────────────
const RootNavigator = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderApp = () => {
    if (!user || !profile) return <AuthStack />;
    switch (profile.role) {
      case 'admin':    return <AdminTabs />;
      case 'manager':  return <ManagerTabs />;
      case 'cashier':
      default:         return <CashierStack />;
    }
  };

  return (
    <NavigationContainer>
      {renderApp()}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});

export default RootNavigator;
