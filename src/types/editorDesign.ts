import type { ProductView } from '@/src/store/useProductStore';

/** Archivos finales de una vista, listos para carrito, checkout o taller. */
export interface ExportedDesignFiles {
  /** Mockup compuesto en PNG HD para el carrito y la orden. */
  previewImage: string;
  /** SVG sin mockup, guías ni capas técnicas. */
  printSVG: string;
  /** PNG transparente, recortado al área imprimible y calculado a 300 DPI. */
  printPNG: string;
  /** Estado Fabric sin capas de sistema, para reedición en taller. */
  designJSON: Record<string, unknown>;
}

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
  /** Salidas finales estructuradas de esta cara. */
  files: ExportedDesignFiles;
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
