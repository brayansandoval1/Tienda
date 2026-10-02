import type { Addon, AddonInput } from '@/types/addon';
export const USE_MOCK_DATA: boolean;
export function getAddons(): Promise<Addon[]>;
export function getAddonsByProduct(productId: string, availableAddonIds?: string[]): Promise<Addon[]>;
export function calculateTotalPrice(
  product: Pick<import('@/src/config/products').Product, 'price' | 'basePrice' | 'pricingSchema' | 'pricingRules'>,
  selectedVariant: { id?: string; variantId?: string; variantIds?: string[]; priceDelta?: number; priceModifier?: number } | null,
  canvasState: { usedViewIds?: string[]; designedSideCount?: number; isDoubleSidedUsed?: boolean; hasDesign?: boolean; coveragePercentage?: number; backgroundCoversArea?: boolean; isFullWrap?: boolean },
  selectedAddons: Array<Pick<Addon, 'price' | 'perSide'> | { price: number; perSide?: boolean }>,
  quantity: number,
): import('@/src/types/pricing').PriceCalculation;
export function createAddon(input: AddonInput): Promise<Addon>;
export function updateAddon(id: string, input: AddonInput): Promise<Addon>;
export function deleteAddon(id: string): Promise<boolean>;
export function toggleAddonStatus(id: string): Promise<Addon>;
