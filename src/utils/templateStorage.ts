import type { Draft3DViewPose } from '@/src/utils/designDraftStorage';

/**
 * Persistencia de plantillas del editor en IndexedDB. Las imágenes y diseños
 * Fabric pueden superar la cuota pequeña disponible en localStorage.
 */

export interface SavedTemplate {
  id: string;
  name: string;
  category: string;
  /** Miniatura dataURL (Base64) generada desde el canvas. */
  thumbnail: string;
  /** Mockup del producto con el diseño compuesto; se usa en la galería. */
  previewUrl?: string;
  /** Permite invalidar previews antiguas generadas con transparencia. */
  previewVersion?: 2 | 3;
  /** Tipo/categoría del producto para el que fue diseñada (ej. 'Funda'). */
  productType?: string;
  /** Categorías de producto compatibles; vacío junto con IDs significa universal. */
  targetProductCategories?: string[];
  /** Productos concretos compatibles (permite excepciones a la categoría). */
  targetProductIds?: string[];
  /** Ícono/emoji representativo según la categoría (ej. '🎂' para Cumpleaños). */
  icon?: string;
  createdAt: number;
  /** Documento compatible con Fabric.js: { version, objects } sin mockup. */
  templateJSON: {
    version: string;
    objects: Record<string, unknown>[];
  };
}

const STORAGE_KEY = 'editor_templates';
const DB_NAME = 'tienda_editor';
const DB_VERSION = 2;
const STORE_NAME = 'templates';
const PRODUCT_DESIGN_STORE = 'product_design_templates';

export interface ProductDesignTemplate { schemaVersion: 1; productId: string; updatedAt: number; views: Record<string, string>; modelPoses?: Record<string, Draft3DViewPose> }

function openTemplateDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PRODUCT_DESIGN_STORE)) db.createObjectStore(PRODUCT_DESIGN_STORE, { keyPath: 'productId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function migrateLegacyTemplates(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    let legacy: SavedTemplate[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) legacy = parsed;
    } catch { /* Una entrada antigua dañada no debe bloquear el editor. */ }
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    legacy.forEach((item) => store.put(item));
    tx.oncomplete = () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* Migración completada en IndexedDB. */ }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function withTemplateStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB no está disponible en este navegador.');
  const db = await openTemplateDatabase();
  await migrateLegacyTemplates(db);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = action(tx.objectStore(STORE_NAME));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

async function withProductDesignStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB no está disponible en este navegador.');
  const db = await openTemplateDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCT_DESIGN_STORE, mode);
    const request = action(tx.objectStore(PRODUCT_DESIGN_STORE));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function saveProductDesignTemplate(template: ProductDesignTemplate): Promise<boolean> {
  try { await withProductDesignStore('readwrite', (store) => store.put(template)); return true; }
  catch (error) { console.error('No se pudo guardar el diseño base del producto:', error); return false; }
}

export async function getProductDesignTemplate(productId: string): Promise<ProductDesignTemplate | null> {
  try { return (await withProductDesignStore('readonly', (store) => store.get(productId))) ?? null; }
  catch (error) { console.error('No se pudo leer el diseño base del producto:', error); return null; }
}

export async function deleteProductDesignTemplate(productId: string): Promise<void> {
  try { await withProductDesignStore('readwrite', (store) => store.delete(productId)); }
  catch (error) { console.error('No se pudo quitar el diseño base del producto:', error); }
}

export async function listSavedTemplates(): Promise<SavedTemplate[]> {
  try {
    const items = await withTemplateStore('readonly', (store) => store.getAll());
    return (items as SavedTemplate[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('❌ [TEMPLATES] No se pudieron leer las plantillas:', error);
    return [];
  }
}

export async function saveTemplateToStorage(template: SavedTemplate): Promise<boolean> {
  try {
    await withTemplateStore('readwrite', (store) => store.put(template));
    return true;
  } catch (error) {
    console.error('❌ [TEMPLATES] No se pudo guardar en IndexedDB:', error);
    return false;
  }
}

export async function updateTemplateInStorage(template: SavedTemplate): Promise<boolean> {
  try {
    const existing = (await withTemplateStore('readonly', (store) => store.get(template.id))) as SavedTemplate | undefined;
    if (!existing) return false;
    await withTemplateStore('readwrite', (store) => store.put(template));
    return true;
  } catch (error) {
    console.error('❌ [TEMPLATES] No se pudo actualizar en IndexedDB:', error);
    return false;
  }
}

export async function deleteSavedTemplate(templateId: string): Promise<SavedTemplate[]> {
  try {
    await withTemplateStore('readwrite', (store) => store.delete(templateId));
    return await listSavedTemplates();
  } catch (error) {
    console.error('❌ [TEMPLATES] No se pudo eliminar la plantilla:', error);
    return await listSavedTemplates();
  }
}

/**
 * Mapa de íconos representativos por categoría de plantilla.
 * Se usan como vista previa grande en las tarjetas (en lugar del screenshot
 * miniaturizado del canvas). Cualquier categoría desconocida cae en '⭐'.
 * TODO: si luego se usan URLs de imagen, basta cambiar el valor por la URL
 * (el renderizado ya soporta emoji/texto; para URLs se usaría <img src>).
 */
export const CATEGORY_ICONS: Record<string, string> = {
  'Cumpleaños': '🎂',
  'Parejas / Aniversario': '❤️',
  'Bodas': '💍',
  'Corporativo': '🏢',
  'General': '⭐',
};

/** Ícono representativo para una categoría, con fallback universal.
 *  Consulta primero los íconos personalizados guardados por el admin. */
export function getCategoryIcon(category?: string): string {
  if (!category) return '⭐';
  return listTemplateIcons()[category] ?? CATEGORY_ICONS[category] ?? '⭐';
}

const ICONS_KEY = 'editor_template_icons';

/** Mapa de íconos personalizados (categoría → emoji) creados por el admin. */
export function listTemplateIcons(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ICONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Guarda/cambia el ícono de una categoría y devuelve el mapa actualizado. */
export function saveTemplateIcon(category: string, icon: string): Record<string, string> {
  const icons = listTemplateIcons();
  icons[category] = icon.trim() || '⭐';
  try {
    localStorage.setItem(ICONS_KEY, JSON.stringify(icons));
  } catch (error) {
    console.warn('⚠️ No se pudo guardar el ícono de la categoría:', error);
  }
  return icons;
}

/** Categorías base por defecto (más 'General' para plantillas sin categoría). */
export const DEFAULT_TEMPLATE_CATEGORIES = ['Cumpleaños', 'Parejas / Aniversario', 'Bodas', 'Corporativo'];

const CATEGORIES_KEY = 'editor_template_categories';

/**
 * Categorías de plantillas creadas por el administrador (persistidas aparte
 * para que sigan existiendo aunque no haya plantillas que las usen aún).
 */
export function listTemplateCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Persiste las categorías del administrador (merge con las existentes). */
export function saveTemplateCategories(categories: string[]): string[] {
  const merged = Array.from(new Set([...listTemplateCategories(), ...categories]))
    .filter((category) => category.trim())
    .sort((a, b) => a.localeCompare(b, 'es'));
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn('⚠️ No se pudieron guardar las categorías de plantillas:', error);
  }
  return merged;
}
