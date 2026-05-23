import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import RootNavigator from './src/navigation/RootNavigator';
import ConfirmHost from './src/components/ConfirmModal';

const RootView: any = GestureHandlerRootView;

export default function App() {
  return (
    <RootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <StatusBar style="dark" />
            <RootNavigator />
            <ConfirmHost />
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </RootView>
  );
}
