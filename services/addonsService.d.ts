import type { Addon, AddonInput } from '@/types/addon';
export const USE_MOCK_DATA: boolean;
export function getAddons(): Promise<Addon[]>;
export function getAddonsByProduct(productId: string): Promise<Addon[]>;
export function createAddon(input: AddonInput): Promise<Addon>;
export function updateAddon(id: string, input: AddonInput): Promise<Addon>;
export function deleteAddon(id: string): Promise<boolean>;
export function toggleAddonStatus(id: string): Promise<Addon>;
