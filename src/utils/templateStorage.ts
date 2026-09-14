/**
 * Persistencia de plantillas del editor en localStorage (simula la BD).
 *
 * Clave dedicada 'editor_templates' para no competir con el catálogo de
 * productos ('custom_products'). Las miniaturas se guardan como dataURL JPEG
 * reducido para cuidar la cuota de ~5MB del navegador.
 */

export interface SavedTemplate {
  id: string;
  name: string;
  category: string;
  /** Miniatura dataURL (Base64) generada desde el canvas. */
  thumbnail: string;
  /** Tipo/categoría del producto para el que fue diseñada (ej. 'Funda'). */
  productType?: string;
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

export function listSavedTemplates(): SavedTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedTemplate[]) : [];
  } catch (error) {
    console.error('❌ [TEMPLATES] No se pudieron leer las plantillas:', error);
    return [];
  }
}

export function saveTemplateToStorage(template: SavedTemplate): boolean {
  try {
    const templates = listSavedTemplates();
    templates.unshift(template);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    return true;
  } catch (error) {
    // Cuota agotada (normalmente por miniaturas Base64 acumuladas).
    console.error('❌ [TEMPLATES] No se pudo guardar la plantilla (cuota agotada):', error);
    return false;
  }
}

export function deleteSavedTemplate(templateId: string): SavedTemplate[] {
  const templates = listSavedTemplates().filter((template) => template.id !== templateId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('❌ [TEMPLATES] No se pudo actualizar la lista:', error);
  }
  return templates;
}

/**
 * Reemplaza una plantilla existente (por id) conservando su createdAt.
 * TODO: cuando exista BD, esto pasa a PUT /api/templates/:id.
 */
export function updateTemplateInStorage(template: SavedTemplate): boolean {
  try {
    const templates = listSavedTemplates().map((item) =>
      item.id === template.id ? template : item,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    return true;
  } catch (error) {
    console.error('❌ [TEMPLATES] No se pudo actualizar la plantilla (cuota agotada):', error);
    return false;
  }
}

// TODO: Reemplazar localStorage por POST /api/templates (y GET /api/templates
// en listSavedTemplates, DELETE /api/templates/:id en deleteSavedTemplate).
// El shape de SavedTemplate ya es compatible con un documento MongoDB/SQL.
