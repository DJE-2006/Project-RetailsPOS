// ─── Hold / Resume carts (local persistence) ────────────────
// Stores parked carts on-device with AsyncStorage so a cashier
// can suspend an order and resume it later.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'retailpos:heldCarts';

export type HeldCart = {
  id: string;
  label: string;
  items: any[];
  discount: number;
  itemCount: number;
  total: number;
  createdAt: number;
};

export const getHeldCarts = async (): Promise<HeldCart[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveHeldCart = async (cart: Omit<HeldCart, 'id' | 'createdAt'>): Promise<HeldCart> => {
  const list = await getHeldCarts();
  const entry: HeldCart = { ...cart, id: `hc_${Date.now()}`, createdAt: Date.now() };
  list.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
  return entry;
};

export const removeHeldCart = async (id: string): Promise<HeldCart[]> => {
  const list = (await getHeldCarts()).filter((c) => c.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  return list;
};
