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
  /** Imágenes compartidas una sola vez entre las vistas del borrador. */
  assets?: Record<string, string>;
};

const ASSET_REF_PREFIX = '__design_asset_ref__:';

const collectAndReplaceImageSources = (value: any, assets: Record<string, string>, refs: Map<string, string>): any => {
  if (Array.isArray(value)) return value.map((item) => collectAndReplaceImageSources(item, assets, refs));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (key === 'src' && typeof child === 'string' && child.startsWith('data:image/')) {
      let assetRef = refs.get(child);
      if (!assetRef) {
        let hash = 2166136261;
        for (let index = 0; index < child.length; index += 1) {
          hash ^= child.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        const baseKey = `image_${(hash >>> 0).toString(36)}_${child.length.toString(36)}`;
        assetRef = baseKey;
        let suffix = 1;
        while (assets[assetRef] && assets[assetRef] !== child) assetRef = `${baseKey}_${suffix++}`;
        assets[assetRef] = child;
        refs.set(child, assetRef);
      }
      return [key, `${ASSET_REF_PREFIX}${assetRef}`];
    }
    return [key, collectAndReplaceImageSources(child, assets, refs)];
  }));
};

const restoreImageSources = (value: any, assets: Record<string, string>): any => {
  if (Array.isArray(value)) return value.map((item) => restoreImageSources(item, assets));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (key === 'src' && typeof child === 'string' && child.startsWith(ASSET_REF_PREFIX)) {
      return [key, assets[child.slice(ASSET_REF_PREFIX.length)] ?? child];
    }
    return [key, restoreImageSources(child, assets)];
  }));
};

const parseViewJSON = (serialized: string, transform: (value: any) => any) => {
  try {
    return JSON.stringify(transform(JSON.parse(serialized)));
  } catch {
    return serialized;
  }
};

const packDraftAssets = (draft: DesignDraft) => {
  const assets: Record<string, string> = {};
  const refs = new Map<string, string>();
  return {
    ...draft,
    views: Object.fromEntries(Object.entries(draft.views).map(([viewId, serialized]) => [
      viewId,
      parseViewJSON(serialized, (value) => collectAndReplaceImageSources(value, assets, refs)),
    ])),
    canvasJSON: collectAndReplaceImageSources(draft.canvasJSON, assets, refs),
    assets,
  };
};

const unpackDraftAssets = (draft: DesignDraft): DesignDraft => {
  const assets = draft.assets ?? {};
  if (!Object.keys(assets).length) return draft;
  return {
    ...draft,
    views: Object.fromEntries(Object.entries(draft.views).map(([viewId, serialized]) => [
      viewId,
      parseViewJSON(serialized, (value) => restoreImageSources(value, assets)),
    ])),
    canvasJSON: restoreImageSources(draft.canvasJSON, assets),
  };
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
    return unpackDraftAssets(draft as DesignDraft);
  } catch {
    // Un JSON corrupto nunca debe impedir abrir el editor.
    return null;
  }
};

export const saveDraft = (draft: DesignDraft) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(getDesignDraftKey(draft.productId), JSON.stringify(packDraftAssets(draft)));
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
