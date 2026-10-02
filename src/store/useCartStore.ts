'use client';

import { create } from 'zustand';
import type { SavedDesignPayload } from '@/src/types/editorDesign';
import type { PriceCalculation } from '@/src/types/pricing';
import { calculateTotalPrice } from '@/services/addonsService.js';

type CartPricingContext = {
  product: Pick<import('@/src/config/products').Product, 'price' | 'basePrice' | 'pricingSchema' | 'pricingRules'>;
  selectedVariant: { id?: string; variantId?: string; variantIds?: string[]; priceDelta?: number; priceModifier?: number } | null;
  canvasState: { usedViewIds?: string[]; designedSideCount?: number; isDoubleSidedUsed?: boolean; hasDesign?: boolean; coveragePercentage?: number; backgroundCoversArea?: boolean };
  addons: Array<{ price: number; perSide?: boolean }>;
};

export type CartDesignItem = {
  id: string;
  productId: string;
  price: number;
  basePrice?: number;
  totalPrice?: number;
  minimumQuantity?: number;
  pricingContext?: CartPricingContext;
  pricingBreakdown?: PriceCalculation;
  addons?: Array<{ id: string; name: string; price: number; perSide?: boolean; userText?: string }>;
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
    items: state.items.map((item) => {
      if (item.id !== itemId) return item;
      const nextQuantity = Math.max(item.minimumQuantity ?? 1, Math.floor(Number(quantity) || 1));
      if (!item.pricingContext) return { ...item, totalPrice: item.price * nextQuantity, design: { ...item.design, quantity: nextQuantity, totalPrice: item.price * nextQuantity } };
      const breakdown = calculateTotalPrice(
        item.pricingContext.product,
        item.pricingContext.selectedVariant,
        item.pricingContext.canvasState,
        item.pricingContext.addons,
        nextQuantity,
      );
      return {
        ...item,
        price: breakdown.discountedUnitPrice,
        totalPrice: breakdown.grandTotal,
        pricingBreakdown: breakdown,
        design: { ...item.design, quantity: nextQuantity, totalPrice: breakdown.grandTotal, pricingBreakdown: breakdown },
      };
    }),
  })),
  removeItem: (itemId) => set((state) => ({ items: state.items.filter((item) => item.id !== itemId) })),
  clear: () => set({ items: [] }),
}));
