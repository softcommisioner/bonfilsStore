import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product, CartItem } from '../types';

const MAX_PER_ITEM = 20;
// Must stay in sync with FREE_SHIPPING_THRESHOLD in server/routes/orders.ts
const FREE_SHIPPING_THRESHOLD = 200;
const SHIPPING_FEE = 5;

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, selectedColor?: string, selectedSize?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  total: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  groupedBySeller: Array<{ sellerName: string; businessId: string; items: CartItem[]; sellerSubtotal: number }>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function sanitize(saved: CartItem[]): CartItem[] {
  return (Array.isArray(saved) ? saved : [])
    .filter(item => item && item.product && typeof item.product.id === 'string')
    // Drop anything that is no longer purchasable so checkout never fails on stale data.
    .filter(item => item.product.isActive !== false && item.product.stock > 0)
    .map(item => ({
      ...item,
      quantity: Math.max(1, Math.min(item.product.stock, Math.min(MAX_PER_ITEM, item.quantity || 1))),
    }));
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('bonfils_cart');
      return saved ? sanitize(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('bonfils_cart', JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items]);

  const addItem = (product: Product, quantity: number = 1, selectedColor?: string, selectedSize?: string) => {
    if (product.stock <= 0) {
      return;
    }
    const requested = Math.max(1, Math.floor(quantity) || 1);
    const cap = Math.max(1, Math.min(MAX_PER_ITEM, product.stock));

    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          product,
          quantity: Math.min(cap, next[existingIndex].quantity + requested),
          selectedColor: selectedColor || next[existingIndex].selectedColor,
          selectedSize: selectedSize || next[existingIndex].selectedSize,
        };
        return next;
      }
      return [...prev, { product, quantity: Math.min(cap, requested), selectedColor, selectedSize }];
    });
    setIsCartOpen(true);
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems(prev =>
      prev.map(item => {
        if (item.product.id !== productId) return item;
        const cap = Math.max(1, Math.min(MAX_PER_ITEM, item.product.stock));
        return { ...item, quantity: Math.min(cap, Math.max(1, Math.floor(quantity))) };
      }),
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD || items.length === 0 ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingFee;

  // Group items by seller for multi-vendor checkout visibility
  const sellerMap = new Map<string, { sellerName: string; businessId: string; items: CartItem[]; sellerSubtotal: number }>();
  for (const item of items) {
    const bizId = item.product.businessId;
    if (!sellerMap.has(bizId)) {
      sellerMap.set(bizId, {
        sellerName: item.product.sellerName,
        businessId: bizId,
        items: [],
        sellerSubtotal: 0,
      });
    }
    const group = sellerMap.get(bizId)!;
    group.items.push(item);
    group.sellerSubtotal += item.product.price * item.quantity;
  }
  const groupedBySeller = Array.from(sellerMap.values());

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        shippingFee,
        total,
        isCartOpen,
        setIsCartOpen,
        groupedBySeller,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
