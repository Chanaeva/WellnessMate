import { createContext, useContext, useState, ReactNode } from "react";
import { MembershipPlan } from "@shared/schema";

export interface CartItem {
  id: string;
  type: 'membership' | 'punch_card';
  name: string;
  price: number; // in cents
  description?: string;
  quantity?: number;
  data?: any; // Store full plan/package data
}

export interface PromoCode {
  id: number;
  title: string;
  description: string;
  code: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number; // Percentage (0-100) or amount in cents
  validUntil: string;
}

interface CartContextType {
  items: CartItem[];
  promoCode: PromoCode | null;
  addItem: (item: CartItem, options?: { skipAutoOpen?: boolean }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getSubtotal: () => number;
  getDiscount: () => number;
  getItemCount: () => number;
  applyPromoCode: (promo: PromoCode) => void;
  removePromoCode: () => void;
  openCart: () => void;
  closeCart: () => void;
  setCartOpenCallback: (callback: (() => void) | null) => void;
  setCartCloseCallback: (callback: (() => void) | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [promoCode, setPromoCode] = useState<PromoCode | null>(null);
  const [cartOpenCallback, setCartOpenCallback] = useState<(() => void) | null>(null);
  const [cartCloseCallback, setCartCloseCallback] = useState<(() => void) | null>(null);

  const addItem = (newItem: CartItem, options?: { skipAutoOpen?: boolean }) => {
    setItems(prevItems => {
      // For memberships, replace any existing membership
      if (newItem.type === 'membership') {
        const filteredItems = prevItems.filter(item => item.type !== 'membership');
        return [...filteredItems, { ...newItem, quantity: 1 }];
      }
      
      // For punch cards, check if item already exists
      const existingItem = prevItems.find(item => item.id === newItem.id);
      if (existingItem) {
        return prevItems.map(item =>
          item.id === newItem.id 
            ? { ...item, quantity: (item.quantity || 1) + (newItem.quantity || 1) }
            : item
        );
      }
      
      return [...prevItems, { ...newItem, quantity: newItem.quantity || 1 }];
    });
    
    // Auto-open cart when item is added (unless skipAutoOpen is true)
    if (cartOpenCallback && !options?.skipAutoOpen) {
      cartOpenCallback();
    }
  };

  const openCart = () => {
    if (cartOpenCallback) {
      cartOpenCallback();
    }
  };

  const closeCart = () => {
    if (cartCloseCallback) {
      cartCloseCallback();
    }
  };

  const removeItem = (id: string) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setPromoCode(null);
  };

  const getSubtotal = () => {
    return items.reduce((total, item) => {
      return total + (item.price * (item.quantity || 1));
    }, 0);
  };

  const getDiscount = () => {
    if (!promoCode) return 0;

    const subtotal = getSubtotal();
    
    if (promoCode.discountType === 'percentage') {
      // Calculate percentage discount (discountValue is 0-100)
      return Math.round((subtotal * promoCode.discountValue) / 100);
    } else {
      // Fixed amount discount (discountValue is in cents)
      // Don't allow discount to exceed subtotal
      return Math.min(promoCode.discountValue, subtotal);
    }
  };

  const getTotalPrice = () => {
    const subtotal = getSubtotal();
    const discount = getDiscount();
    return Math.max(0, subtotal - discount);
  };

  const getItemCount = () => {
    return items.reduce((count, item) => count + (item.quantity || 1), 0);
  };

  const applyPromoCode = (promo: PromoCode) => {
    setPromoCode(promo);
  };

  const removePromoCode = () => {
    setPromoCode(null);
  };

  return (
    <CartContext.Provider value={{
      items,
      promoCode,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getSubtotal,
      getDiscount,
      getItemCount,
      applyPromoCode,
      removePromoCode,
      openCart,
      closeCart,
      setCartOpenCallback,
      setCartCloseCallback
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}