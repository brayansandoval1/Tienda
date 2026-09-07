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
  createdAt: number;
  /** Documento compatible con Fabric.js: { version, objects } sin mockup. */
  templateJSON: {
    version: string;
    objects: Record<string, unknown>[];
  };
}

const STORAGE_KEY = 'editor_templates';

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

// TODO: Reemplazar localStorage por POST /api/templates (y GET /api/templates
// en listSavedTemplates, DELETE /api/templates/:id en deleteSavedTemplate).
// El shape de SavedTemplate ya es compatible con un documento MongoDB/SQL.
