export type AddonCategory = 'finishes' | 'packaging' | 'accessories' | 'certifications';
export interface AddonInput {
  name: string;
  badge?: string;
  category: AddonCategory;
  price: number;
  description: string;
  requiresInput: boolean;
  inputConfig?: { label: string; placeholder: string; maxLength: number };
  applicableProducts: string[];
  isActive: boolean;
}
export interface Addon extends AddonInput { id: string; createdAt: string }
