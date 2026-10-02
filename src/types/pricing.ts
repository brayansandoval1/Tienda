export type PriceCalculation = {
  quantity: number;
  unitBasePrice: number;
  variantDelta: number;
  designedSideCount: number;
  coveragePercentage: number;
  fullWrapUsed: boolean;
  printingRule: 'single-sided' | 'double-sided' | 'full-wrap';
  sidesCost: number;
  addonsCost: number;
  unitSubtotal: number;
  discountPercentage: number;
  discountPerUnit: number;
  discountedUnitPrice: number;
  setupFee: number;
  grandTotal: number;
};
