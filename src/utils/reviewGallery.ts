import type {
  PrintAreaPercent,
  Product,
  ProductView,
  ReviewGalleryImage,
} from '@/src/config/products';

/**
 * Utilidades de la "Zona Segura Maestra" para la pestaña Revisar.
 *
 * EL PROBLEMA: el editor y el admin guardan la zona de estampado de dos formas
 * distintas según el origen del producto:
 *   1. Productos creados en el Admin  -> `printAreaUnit: 'percent'`, valores 0-100.
 *   2. Productos del catálogo base    -> píxeles sobre el plano lógico de 800 px.
 * Además, versiones antiguas del admin guardaron fracciones (0-1).
 *
 * ESTE MÓDULO unifica todo a porcentaje (0-100) respecto a la IMAGEN BASE, que
 * es el marco de referencia que usa el editor al dibujar la guía: ver
 * `drawSafeArea` en EditorCanvas, que multiplica el porcentaje por
 * `activeMockupBounds` (el rectángulo realmente renderizado del mockup) y no
 * por el lienzo completo. Por eso el porcentaje es portable a fotos lifestyle
 * de cualquier proporción.
 */

/** Plano lógico de referencia usado por Admin y Editor. */
export const REFERENCE_PLANE_SIZE = 800;

/** Zona por defecto (centrada) cuando el producto no define ninguna. */
export const DEFAULT_MASTER_PRINT_AREA: PrintAreaPercent = {
  xPercent: 30,
  yPercent: 25,
  widthPercent: 40,
  heightPercent: 45,
};

const toFiniteNumber = (value: unknown, fallback: number): number =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const roundPercent = (value: number): number => Number(value.toFixed(2));

/** Limita un porcentaje al rango 0-100 con dos decimales. */
const clampPercent = (value: unknown, fallback: number): number =>
  roundPercent(Math.min(100, Math.max(0, toFiniteNumber(value, fallback))));

/**
 * Normaliza una caja en porcentaje: ancho/alto nunca menores a 1 % y la caja
 * nunca sale del lienzo (x + width <= 100). Igual de estricto que
 * `normalizePrintArea` de MockupAreaPicker para que Admin y Revisar coincidan.
 */
export function normalizePrintAreaPercent(area: Partial<PrintAreaPercent> | null | undefined): PrintAreaPercent {
  const widthPercent = Math.min(100, Math.max(1, toFiniteNumber(area?.widthPercent, DEFAULT_MASTER_PRINT_AREA.widthPercent)));
  const heightPercent = Math.min(100, Math.max(1, toFiniteNumber(area?.heightPercent, DEFAULT_MASTER_PRINT_AREA.heightPercent)));

  return {
    xPercent: clampPercent(area?.xPercent, Math.max(0, 100 - widthPercent) / 2),
    yPercent: clampPercent(area?.yPercent, Math.max(0, 100 - heightPercent) / 2),
    widthPercent: roundPercent(widthPercent),
    heightPercent: roundPercent(heightPercent),
  };
}

/** true cuando el valor ya viene en porcentaje (0-100) y no en píxeles. */
const isPercentUnit = (view: ProductView): boolean => view.printAreaUnit === 'percent';

/**
 * Compatibilidad histórica: el admin antiguo persistió porcentajes como
 * fracciones 0-1. Mismo criterio que `normalizePercentage` en AdminProductEditor.
 */
const legacyPercentFix = (value: number): number => (value > 0 && value <= 1 ? value * 100 : value);

/**
 * REQUISITO 1: convierte la Zona Segura de una vista del editor a porcentaje
 * relativo a la imagen base (`masterPrintArea`).
 */
export function viewPrintAreaToPercent(
  view: ProductView | undefined,
  canvasWidth?: number,
  canvasHeight?: number,
): PrintAreaPercent {
  if (!view?.printArea) return { ...DEFAULT_MASTER_PRINT_AREA };

  const planeWidth = toFiniteNumber(canvasWidth, REFERENCE_PLANE_SIZE) || REFERENCE_PLANE_SIZE;
  const planeHeight = toFiniteNumber(canvasHeight, REFERENCE_PLANE_SIZE) || REFERENCE_PLANE_SIZE;

  if (isPercentUnit(view)) {
    return normalizePrintAreaPercent({
      xPercent: legacyPercentFix(toFiniteNumber(view.printArea.x, 25)),
      yPercent: legacyPercentFix(toFiniteNumber(view.printArea.y, 25)),
      widthPercent: legacyPercentFix(toFiniteNumber(view.printArea.width, 50)),
      heightPercent: legacyPercentFix(toFiniteNumber(view.printArea.height, 50)),
    });
  }

  // Píxeles sobre el plano lógico -> porcentaje de la imagen base.
  return normalizePrintAreaPercent({
    xPercent: (toFiniteNumber(view.printArea.x, 200) * 100) / planeWidth,
    yPercent: (toFiniteNumber(view.printArea.y, 200) * 100) / planeHeight,
    widthPercent: (toFiniteNumber(view.printArea.width, 400) * 100) / planeWidth,
    heightPercent: (toFiniteNumber(view.printArea.height, 400) * 100) / planeHeight,
  });
}

/**
 * Devuelve la zona maestra del producto.
 *
 * Prioridad: la zona ya persistida en `product.masterPrintArea` (queda congelada
 * como referencia, que es la intención de una "referencia maestra"), y si no
 * existe, se deriva de la vista activa.
 */
export function resolveMasterPrintArea(product: Product | undefined, viewId?: string): PrintAreaPercent {
  if (!product) return { ...DEFAULT_MASTER_PRINT_AREA };

  const persisted = product.masterPrintArea;
  if (persisted && Number.isFinite(persisted.xPercent)) return normalizePrintAreaPercent(persisted);

  const view = product.views.find((candidate) => candidate.id === viewId) ?? product.views[0];
  return viewPrintAreaToPercent(view, product.canvasWidth, product.canvasHeight);
}

/**
 * REQUISITO 2: resuelve la caja de estampado de una foto concreta.
 * Con `useMasterArea` hereda la referencia; si el admin la desactivó, usa su
 * propio ajuste (y cae a la maestra si aún no lo definió).
 */
export function resolveReviewImagePrintArea(
  image: Pick<ReviewGalleryImage, 'useMasterArea' | 'customPrintArea'>,
  masterPrintArea: PrintAreaPercent,
): PrintAreaPercent {
  if (image.useMasterArea) return masterPrintArea;
  if (image.customPrintArea && Number.isFinite(image.customPrintArea.xPercent)) {
    return normalizePrintAreaPercent(image.customPrintArea);
  }
  return masterPrintArea;
}

/** Estilos CSS para pintar la caja sobre un contenedor con la imagen dentro. */
export function printAreaPercentToStyle(area: PrintAreaPercent): { left: string; top: string; width: string; height: string } {
  return {
    left: `${area.xPercent}%`,
    top: `${area.yPercent}%`,
    width: `${area.widthPercent}%`,
    height: `${area.heightPercent}%`,
  };
}

/** Adaptación al tipo `{ x, y, width, height }` que consume MockupAreaPicker. */
export function percentToPickableArea(area: PrintAreaPercent): { x: number; y: number; width: number; height: number } {
  return { x: area.xPercent, y: area.yPercent, width: area.widthPercent, height: area.heightPercent };
}

/** Adaptación inversa: del selector de Admin al formato persistido. */
export function pickableAreaToPercent(area: { x: number; y: number; width: number; height: number }): PrintAreaPercent {
  return normalizePrintAreaPercent({
    xPercent: area.x,
    yPercent: area.y,
    widthPercent: area.width,
    heightPercent: area.height,
  });
}

/** Título legible a partir del nombre del archivo subido. */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (!base) return 'Nueva foto';
  return base.charAt(0).toUpperCase() + base.slice(1);
}


