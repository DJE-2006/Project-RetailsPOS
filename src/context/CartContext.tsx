import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

const CartContext = createContext<any>({});
export const useCart = () => useContext(CartContext);

export const TAX_RATE = 0.12;

// ── Reducer ────────────────────────────────────────────────
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find((i) => i.id === action.item.id);
      const maxStock = action.item.stock;
      if (existing) {
        // Respect available stock when known.
        if (typeof maxStock === 'number' && existing.quantity + 1 > maxStock) {
          return state;
        }
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.item.id
              ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          { ...action.item, quantity: 1, subtotal: action.item.price },
        ],
      };
    }

    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };

    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.id !== action.id) };
      }
      return {
        ...state,
        items: state.items.map((i) => {
          if (i.id !== action.id) return i;
          const qty = typeof i.stock === 'number'
            ? Math.min(action.quantity, i.stock)
            : action.quantity;
          return { ...i, quantity: qty, subtotal: qty * i.price };
        }),
      };
    }

    case 'SET_DISCOUNT':
      return { ...state, discount: Math.max(0, action.discount) };

    case 'LOAD_CART':
      return { items: action.items || [], discount: action.discount || 0 };

    case 'CLEAR_CART':
      return initialState;

    default:
      return state;
  }
};

const initialState = { items: [], discount: 0 };

// ── Provider ───────────────────────────────────────────────
export const CartProvider = ({ children }: { children?: React.ReactNode }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = useCallback((item) => dispatch({ type: 'ADD_ITEM', item }), []);
  const removeItem = useCallback((id) => dispatch({ type: 'REMOVE_ITEM', id }), []);
  const updateQuantity = useCallback(
    (id, quantity) => dispatch({ type: 'UPDATE_QUANTITY', id, quantity }),
    []
  );
  const setDiscount = useCallback(
    (discount) => dispatch({ type: 'SET_DISCOUNT', discount }),
    []
  );
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  // Restore a held cart (items + discount).
  const loadCart = useCallback(
    (items, discount = 0) => dispatch({ type: 'LOAD_CART', items, discount }),
    []
  );

  const value = useMemo(() => {
    let subtotal = 0;
    let itemCount = 0;
    for (const i of state.items) {
      subtotal  += i.subtotal;
      itemCount += i.quantity;
    }
    const tax = subtotal * TAX_RATE;
    // Discount can never exceed subtotal+tax, and total can never go negative.
    const grossTotal = subtotal + tax;
    const discountAmount = Math.min(Math.max(0, state.discount), grossTotal);
    const total = Math.max(0, grossTotal - discountAmount);
    return {
      items: state.items,
      discount: discountAmount,
      subtotal, tax,
      discountAmount,
      total, itemCount,
      addItem, removeItem, updateQuantity, setDiscount, clearCart, loadCart,
    };
  }, [state, addItem, removeItem, updateQuantity, setDiscount, clearCart, loadCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
