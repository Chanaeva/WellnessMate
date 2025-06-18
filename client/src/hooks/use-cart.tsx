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

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (newItem: CartItem) => {
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
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => {
      return total + (item.price * (item.quantity || 1));
    }, 0);
  };

  const getItemCount = () => {
    return items.reduce((count, item) => count + (item.quantity || 1), 0);
  };

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getItemCount
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