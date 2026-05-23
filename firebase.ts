// ─────────────────────────────────────────────
//  firebase.ts  –  RetailPOS Firebase setup
// ─────────────────────────────────────────────
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 🔑 Firebase project config
const firebaseConfig = {
  apiKey: 'AIzaSyBPWUMnT4Bl7zGr_tmvu3C9jdxy53H0DkE',
  authDomain: 'retailpos-a264c.firebaseapp.com',
  projectId: 'retailpos-a264c',
  storageBucket: 'retailpos-a264c.firebasestorage.app',
  messagingSenderId: '435354086370',
  appId: '1:435354086370:web:cd2f5d8b88da0a93e067bb',
};

const isNew = getApps().length === 0;
const app = isNew ? initializeApp(firebaseConfig) : getApp();

// Auth:
//   Web    → getAuth(app)  (uses default IndexedDB persistence, auto-initializes)
//   Native → initializeAuth(app, { persistence: RN AsyncStorage })
function initAuth() {
  if (Platform.OS === 'web') return getAuth(app);
  try {
    // @ts-ignore — getReactNativePersistence is a runtime export not in public types.
    const { getReactNativePersistence } = require('firebase/auth');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Auth already initialized (Fast Refresh / re-import) — reuse the same instance.
    return getAuth(app);
  }
}

export const auth = initAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
