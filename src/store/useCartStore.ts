'use client';

import { create } from 'zustand';
import type { SavedDesignPayload } from '@/src/types/editorDesign';

export type CartDesignItem = {
  id: string;
  productId: string;
  price: number;
  selections: Record<string, unknown>;
  design: SavedDesignPayload;
  addedAt: number;
};

/**
 * Carrito en memoria. El checkout puede consumir `items` o enviarlos a su API;
 * no se persiste en localStorage porque PNG/SVG de alta resolución pueden ser
 * demasiado pesados para la cuota del navegador.
 */
type CartState = {
  items: CartDesignItem[];
  addDesignItem: (item: CartDesignItem) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addDesignItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateQuantity: (itemId, quantity) => set((state) => ({
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, design: { ...item.design, quantity: Math.max(1, quantity) } } : item,
    ),
  })),
  removeItem: (itemId) => set((state) => ({ items: state.items.filter((item) => item.id !== itemId) })),
  clear: () => set({ items: [] }),
}));
