'use client';

import { useMemo } from 'react';
import { calculateTotalPrice } from '@/services/addonsService.js';

export function usePriceCalculator({
  product,
  selectedVariant,
  canvasState,
  addons,
  quantity,
}: {
  product: import('@/src/config/products').Product;
  selectedVariant: { id?: string; variantId?: string; variantIds?: string[]; priceDelta?: number; priceModifier?: number } | null;
  canvasState: { usedViewIds: string[]; coveragePercentage: number; backgroundCoversArea?: boolean; isFullWrap?: boolean };
  addons: Array<{ id?: string; name?: string; price: number; perSide?: boolean; userText?: string }>;
  quantity: number;
}) {
  return useMemo(() => calculateTotalPrice(product, selectedVariant, canvasState, addons, quantity), [product, selectedVariant, canvasState, addons, quantity]);
}
