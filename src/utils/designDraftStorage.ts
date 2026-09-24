'use client';

/**
 * Contrato local del borrador. Mantenerlo aislado facilita sustituir estas
 * funciones por un endpoint (GET/PUT/DELETE) cuando exista la base de datos.
 */
export type DesignDraft = {
  schemaVersion: 1;
  productId: string;
  updatedAt: number;
  currentViewId: string;
  /** Objetos serializados por vista; Fabric los reconstruye al cambiar de cara. */
  views: Record<string, string>;
  /** JSON completo de la vista actualmente abierta. */
  canvasJSON: Record<string, unknown>;
};

export const getDesignDraftKey = (productId: string) => `design_draft_${productId}`;

export const getDraft = (productId: string): DesignDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getDesignDraftKey(productId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<DesignDraft>;
    if (
      draft.schemaVersion !== 1 ||
      draft.productId !== productId ||
      !draft.currentViewId ||
      !draft.views ||
      !draft.canvasJSON
    ) return null;
    return draft as DesignDraft;
  } catch {
    // Un JSON corrupto nunca debe impedir abrir el editor.
    return null;
  }
};

export const saveDraft = (draft: DesignDraft) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(getDesignDraftKey(draft.productId), JSON.stringify(draft));
    return true;
  } catch (error) {
    console.warn('No se pudo guardar el borrador del diseño en localStorage.', error);
    return false;
  }
};

/** Eliminar al añadir al carrito, completar la compra o descartar el diseño. */
export const clearDraft = (productId: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getDesignDraftKey(productId));
  } catch (error) {
    console.warn('No se pudo eliminar el borrador del diseño.', error);
  }
};
