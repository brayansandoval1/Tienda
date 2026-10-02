export type AddonCategory = 'finishes' | 'packaging' | 'accessories' | 'certifications';
export type AddonAppliesTo = 'product' | 'side' | 'canvas';
export interface AddonInput {
  name: string;
  badge?: string;
  category: AddonCategory;
  price: number;
  appliesTo: AddonAppliesTo;
  /** Cobra este acabado una vez por cada cara que tenga diseño. */
  perSide: boolean;
  description: string;
  requiresInput: boolean;
  inputConfig?: { label: string; placeholder: string; maxLength: number };
  applicableProducts: string[];
  isActive: boolean;
}
export interface Addon extends AddonInput { id: string; createdAt: string }
