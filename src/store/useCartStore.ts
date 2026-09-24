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
  clear: () => void;
};

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addDesignItem: (item) => set((state) => ({ items: [...state.items, item] })),
  clear: () => set({ items: [] }),
}));
