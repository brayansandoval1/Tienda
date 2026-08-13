import type { ProductView } from '@/src/store/useProductStore';

/** Contrato JSON que puede enviarse directamente a una API o persistirse en BD. */
export interface SavedDesignView {
  id: string;
  name: string;
  printArea: ProductView['printArea'];
  printAreaUnit: 'percent';
  /** Objetos Fabric serializados, para reabrir y editar el diseño. */
  canvasJson: string;
  /** PNG del arte final, transparente y recortado al área de impresión. */
  printFile: string;
  /** PNG del producto con el diseño aplicado, útil para carrito/revisión. */
  preview: string;
}

export interface SavedDesignPayload {
  schemaVersion: 1;
  createdAt: string;
  product: {
    id: string;
    name: string;
    category: string;
    unitPrice: number;
    canvasWidth: number;
    canvasHeight: number;
    printWidthCm?: number;
    printHeightCm?: number;
  };
  quantity: number;
  currency: 'USD';
  views: SavedDesignView[];
}

export interface SaveDesignResult {
  valid: boolean;
  errors: string[];
  payload?: SavedDesignPayload;
}
