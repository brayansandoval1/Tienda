'use client';

import { useState, useEffect } from 'react';
import type { TextOptions } from '@/types/product';
import { Search, Square, Circle, Triangle, Star, Heart, Loader2, LayoutTemplate, Shapes, Save, Trash2, Pencil } from 'lucide-react';
import { MOCK_TEMPLATES, type MockTemplate } from '@/src/data/mockTemplates';
import { listSavedTemplates, deleteSavedTemplate, getCategoryIcon, listTemplateCategories, saveTemplateCategories, saveTemplateIcon, DEFAULT_TEMPLATE_CATEGORIES, type SavedTemplate } from '@/src/utils/templateStorage';
import type { Product } from '@/src/store/useProductStore';

const forms = [
  { label: 'Cuadrado', icon: Square, shape: 'rect' as const },
  { label: 'Círculo', icon: Circle, shape: 'circle' as const },
  { label: 'Triángulo', icon: Triangle, shape: 'triangle' as const },
  { label: 'Estrella', icon: Star, shape: 'star' as const },
  { label: 'Corazón', icon: Heart, shape: 'heart' as const }
];

export default function SidebarPanel({ product }: { product?: Product }) { // Removed onAddShape prop
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [iconQuery, setIconQuery] = useState('');
  const [iconResults, setIconResults] = useState<string[]>([]);
  const [iconLoading, setIconLoading] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recursos' | 'plantillas'>('recursos');
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Cumpleaños');
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);
  // Plantilla en modo edición (sólo las guardadas en localStorage son editables).
  // Cuando no es null, el botón "Guardar" se convierte en "Actualizar".
  const [editingTemplate, setEditingTemplate] = useState<SavedTemplate | null>(null);
  // Filtro de categorías del tab "Plantillas" ("Todas" muestra el catálogo completo).
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todas');

  // Categorías de plantillas creadas por el administrador (persistidas en
  // localStorage): alimentan tanto el select del formulario como los chips
  // de filtro superiores.
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  // Cuando el admin elige "Nueva categoría...", se muestra este input y la
  // categoría escrita pasa a ser la seleccionada del formulario.
  const [isNewCategoryMode, setIsNewCategoryMode] = useState(false);
  const [newCategoryValue, setNewCategoryValue] = useState('');
  // Textos del diseño actual (panel de reemplazo rápido tipo template).
  // La fuente es el evento 'editor:text-list' que emite el canvas.
  const [canvasTexts, setCanvasTexts] = useState<Array<{ id: string; value: string }>>([]);

  // Escucha la lista de textos del canvas y sincroniza los inputs,
  // preservando lo que el usuario está escribiendo en cada campo.
  useEffect(() => {
    const handleTextList = (event: Event) => {
      const texts = (event as CustomEvent<{ texts?: Array<{ id: string; text: string }> }>).detail?.texts ?? [];
      setCanvasTexts((prev) =>
        texts.map((item) => {
          const existing = prev.find((entry) => entry.id === item.id);
          // El texto editado en el lienzo gana; si no cambió, conserva el input.
          return existing
            ? { id: item.id, value: existing.value === item.text ? existing.value : item.text }
            : { id: item.id, value: item.text };
        }),
      );
    };
    window.addEventListener('editor:text-list', handleTextList);
    return () => window.removeEventListener('editor:text-list', handleTextList);
  }, []);
  // Emoji que se asignará a la categoría que se está creando (opcional).
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  // Modo "cambiar ícono" de la categoría seleccionada en el formulario.
  const [isIconEditMode, setIsIconEditMode] = useState(false);
  const [iconValue, setIconValue] = useState('');

  // Lista dinámica de categorías: base por defecto + creadas por el admin +
  // cualquier categoría usada por plantillas guardadas (aunque no esté
  // registrada en el catálogo del admin). "Todas" es pseudo-filtro, no categoría.
  const TEMPLATE_CATEGORIES = [
    'Todas',
    ...Array.from(new Set([
      ...DEFAULT_TEMPLATE_CATEGORIES,
      ...customCategories,
      ...savedTemplates.map((saved) => saved.category),
      'General',
    ])),
  ];

  // Lista combinada: mocks de prueba + plantillas guardadas en localStorage
  // (TODO: cuando exista BD, MOCK_TEMPLATES se sustituye por GET /api/templates
  // y savedTemplates se refresca desde la misma fuente).
  const allTemplates: Array<MockTemplate & { saved?: SavedTemplate }> = [
    ...MOCK_TEMPLATES,
    ...savedTemplates.map((saved) => ({
      id: saved.id,
      name: saved.name,
      description: new Date(saved.createdAt).toLocaleDateString(),
      category: saved.category,
      productType: saved.productType,
      emoji: '⭐',
      accent: 'from-slate-100 to-slate-200',
      templateJSON: saved.templateJSON,
      saved,
    })),
  ];

  // Las plantillas sólo son visibles/aplicables en el producto para el que
  // fueron diseñadas (misma categoría de producto). Las plantillas sin
  // `productType` (mocks por defecto) se consideran universales.
  const currentProductType = product?.category ?? '';
  const templatesForProduct = allTemplates.filter(
    (template) => !template.productType || template.productType === currentProductType,
  );

  // Carga inicial + refresco cuando el editor guarda una plantilla nueva.
  useEffect(() => {
    setSavedTemplates(listSavedTemplates());
    setCustomCategories(listTemplateCategories()); // Categorías creadas por el admin.
    const handleSaved = (event: Event) => {
      const ok = (event as CustomEvent<{ ok?: boolean; name?: string }>).detail?.ok;
      setSavedTemplates(listSavedTemplates());
      if (ok) {
        setTemplateFeedback(`✅ Plantilla "${(event as CustomEvent<{ name?: string }>).detail?.name}" guardada`);
        setTemplateName('');
        setEditingTemplate(null); // Fin del modo edición (crear o actualizar).
      } else {
        setTemplateFeedback('⚠️ No se pudo guardar (¿canvas vacío o cuota agotada?)');
      }
      setTimeout(() => setTemplateFeedback(null), 4000);
    };
    window.addEventListener('editor:template-saved', handleSaved);
    return () => window.removeEventListener('editor:template-saved', handleSaved);
  }, []);

  // Activa el "modo guardar" en el canvas: el editor serializa el diseño
  // actual (sin mockup) y lo persiste vía handleSaveAsTemplate. Si hay una
  // plantilla en edición, el evento lleva updateId para ACTUALIZAR en vez de
  // crear una nueva.
  // Confirma la categoría nueva que se está escribiendo: la selecciona en el
  // formulario, la persiste (chips de filtro) y le asigna su ícono.
  const confirmNewCategory = () => {
    const category = newCategoryValue.trim();
    if (!category) return;
    setTemplateCategory(category);
    setIsNewCategoryMode(false);
    setCustomCategories(saveTemplateCategories([category]));
    saveTemplateIcon(category, newCategoryIcon.trim() || '⭐');
  };

  const handleSaveAsTemplateRequest = (name: string, categoryArg?: string) => {
    // Categoría final: si se está escribiendo una nueva, se usa esa (aunque no
    // se haya pulsado OK); si no, la del select. Evita que al guardar directo
    // se use una categoría vieja como 'Cumpleaños'.
    const category = (isNewCategoryMode ? newCategoryValue : categoryArg ?? templateCategory).trim() || 'Cumpleaños';
    if (category !== '__new__') {
      // Registra la categoría en localStorage para que aparezca en los chips
      // de filtro y en futuros selects (merge, sin duplicados).
      if (!DEFAULT_TEMPLATE_CATEGORIES.includes(category) && category !== 'General') {
        setCustomCategories(saveTemplateCategories([category]));
      }
    }
    window.dispatchEvent(
      new CustomEvent('editor:save-as-template', {
        detail: { name, category, updateId: editingTemplate?.id },
      }),
    );
  };

  // Entra en modo edición: carga el diseño en el canvas, precarga nombre y
  // categoría en el formulario y hace scroll visual al panel de guardado.
  const handleEditTemplate = (template: MockTemplate & { saved?: SavedTemplate }) => {
    if (!template.saved) return; // Las plantillas mock (código) no son editables.
    // Flujo de EDICIÓN (distinto al de aplicación): carga el JSON directamente
    // en el canvas SIN pedir confirmación de reemplazo al cliente (force:true)
    // y activa el modo edición del formulario.
    window.dispatchEvent(
      new CustomEvent('editor:apply-template', {
        detail: {
          templateId: template.id,
          objects: template.templateJSON.objects,
          force: true,
        },
      }),
    );
    setTemplateName(template.saved.name);
    setTemplateCategory(template.saved.category);
    setIsNewCategoryMode(false);
    setNewCategoryValue('');
    setEditingTemplate(template.saved);
    setTemplateFeedback('✏️ Editando: ' + template.saved.name + ' — modifica el diseño y pulsa Actualizar');
    setTimeout(() => setTemplateFeedback(null), 4000);
  };

  // Elimina una plantilla guardada con confirmación previa.
  const handleDeleteTemplate = (saved: SavedTemplate) => {
    if (!window.confirm(`¿Eliminar la plantilla "${saved.name}"? Esta acción no se puede deshacer.`)) return;
    setSavedTemplates(deleteSavedTemplate(saved.id));
    if (editingTemplate?.id === saved.id) {
      setEditingTemplate(null);
      setTemplateName('');
    }
  };

  /**
   * Aplica una plantilla al lienzo. Modular a propósito: hoy usa los datos
   * simulados de mockTemplates.ts; cuando exista base de datos basta reemplazar
   * el dispatch por un fetch(`${api}/templates/${template.id}`) que entregue el
   * mismo `templateJSON` al evento 'editor:apply-template'.
   */
  const handleSelectTemplate = (template: MockTemplate) => {
    console.log('📐 [PLANTILLA] Aplicando:', template.name);
    window.dispatchEvent(
      new CustomEvent('editor:apply-template', {
        detail: { templateId: template.id, objects: template.templateJSON.objects },
      }),
    );
  };

  // ✅ Búsqueda de recursos con debounce (300ms) en la API gratuita de Iconify
  useEffect(() => {
    const trimmed = iconQuery.trim();
    if (trimmed.length <= 2) {
      setIconResults([]);
      setIconLoading(false);
      setIconError(null);
      return;
    }

    setIconLoading(true);
    setIconError(null);

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.iconify.design/search?query=${encodeURIComponent(trimmed)}&limit=24`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Error al buscar recursos');
        const data = await res.json();
        // Iconify devuelve { icons: ["mdi:home", "mdi:account"] }
        setIconResults(data && Array.isArray(data.icons) ? data.icons : []);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setIconError('Error al buscar recursos');
          setIconResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIconLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [iconQuery]);

  // ✅ SOLO se agrega al estado cuando el usuario SUBE un archivo NUEVO
  // El evento 'editor:add-image' solo se usa para AGREGAR AL CANVAS, NO para actualizar la lista

  return (
    <aside className="min-h-0 w-full max-w-[292px] space-y-5 overflow-y-auto rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      {/* Pestañas: Recursos (diseño libre) / Plantillas prediseñadas */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('recursos')}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
            activeTab === 'recursos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shapes size={14} />
          Recursos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('plantillas')}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
            activeTab === 'plantillas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LayoutTemplate size={14} />
          Plantillas
        </button>
      </div>

      {activeTab === 'plantillas' && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Plantillas prediseñadas</p>

          {/* Textos del diseño: reemplazo rápido sin doble clic en el lienzo.
              Se alimenta del evento 'editor:text-list' (un item por IText). */}
          {canvasTexts.length > 0 && (
            <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Textos del diseño
              </p>
              {canvasTexts.map((item) => (
                <div key={item.id} className="flex gap-1.5">
                  <input
                    type="text"
                    value={item.value}
                    placeholder="Nuevo texto..."
                    onChange={(e) =>
                      setCanvasTexts((prev) =>
                        prev.map((entry) => (entry.id === item.id ? { ...entry, value: e.target.value } : entry)),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        window.dispatchEvent(
                          new CustomEvent('editor:replace-text', { detail: { id: item.id, text: item.value } }),
                        );
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
                  />
                  <button
                    type="button"
                    title="Reemplazar texto en el lienzo"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('editor:replace-text', { detail: { id: item.id, text: item.value } }),
                      )
                    }
                    className="shrink-0 rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-semibold text-white transition hover:bg-slate-800"
                  >
                    Reemplazar
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-slate-400">Cambia los textos sin tocar el lienzo (Enter o Reemplazar).</p>
            </div>
          )}

          {/* Modo Administrador: guardar/actualizar el diseño actual como plantilla.
              TODO: cuando exista BD, este dispatch pasa a POST (o PUT si es edición). */}
          <div className={`space-y-2 rounded-xl border border-dashed p-2.5 ${editingTemplate ? 'border-slate-900 bg-slate-100' : 'border-slate-300 bg-slate-50'}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {editingTemplate ? `✏️ Editando: ${editingTemplate.name}` : 'Guardar diseño actual'}
            </p>
            <input
              type="text"
              placeholder="Nombre de la plantilla..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
            />
            {isNewCategoryMode ? (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nombre de la nueva categoría..."
                    value={newCategoryValue}
                    onChange={(e) => setNewCategoryValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCategoryValue.trim()) confirmNewCategory();
                    }}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
                  />
                  <button
                    type="button"
                    title="Confirmar categoría"
                    onClick={confirmNewCategory}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    OK
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Ícono (emoji), ej: 🎉"
                    value={newCategoryIcon}
                    onChange={(e) => setNewCategoryIcon(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
                  />
                  <span className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-base">
                    {newCategoryIcon.trim() || '⭐'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Enter u OK confirma. El ícono es opcional (default ⭐).</p>
              </div>
            ) : isIconEditMode ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  autoFocus
                  placeholder="Nuevo ícono (emoji)..."
                  value={iconValue}
                  onChange={(e) => setIconValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && templateCategory) {
                      saveTemplateIcon(templateCategory, iconValue);
                      setIsIconEditMode(false);
                      setTemplateFeedback(`🎨 Ícono de "${templateCategory}" actualizado`);
                      setTimeout(() => setTemplateFeedback(null), 3000);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
                />
                <button
                  type="button"
                  title="Guardar ícono"
                  onClick={() => {
                    if (!templateCategory) return;
                    saveTemplateIcon(templateCategory, iconValue);
                    setIsIconEditMode(false);
                    setTemplateFeedback(`🎨 Ícono de "${templateCategory}" actualizado`);
                    setTimeout(() => setTemplateFeedback(null), 3000);
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  OK
                </button>
                <button
                  type="button"
                  title="Cancelar"
                  onClick={() => setIsIconEditMode(false)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <select
                  value={templateCategory}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsNewCategoryMode(true);
                      setNewCategoryValue('');
                      setNewCategoryIcon('');
                    } else {
                      setTemplateCategory(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
                >
                  {TEMPLATE_CATEGORIES.filter((category) => category !== 'Todas').map((category) => (
                    <option key={category} value={category}>
                      {getCategoryIcon(category)} {category}
                    </option>
                  ))}
                  <option value="__new__">✏️ Nueva categoría…</option>
                </select>
                <button
                  type="button"
                  title={`Cambiar ícono de "${templateCategory}"`}
                  onClick={() => {
                    setIconValue(getCategoryIcon(templateCategory) === '⭐' ? '' : getCategoryIcon(templateCategory));
                    setIsIconEditMode(true);
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm transition hover:border-slate-300"
                >
                  🎨
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => handleSaveAsTemplateRequest(templateName, templateCategory)}
              disabled={!templateName.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={13} />
              {editingTemplate ? 'Actualizar Plantilla' : 'Guardar como Plantilla'}
            </button>
            {editingTemplate && (
              <button
                type="button"
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateName('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Cancelar edición
              </button>
            )}
            {templateFeedback && <p className="text-[11px] text-slate-600">{templateFeedback}</p>}
          </div>

          <div className="space-y-2">
            {/* Barra de filtros por categoría: chips compactos arriba de la lista.
                TODO: cuando exista BD, las categorías pueden venir de GET /api/templates/categories. */}
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(category)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    selectedCategoryFilter === category
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {category !== 'Todas' && <span className="mr-1">{getCategoryIcon(category)}</span>}
                  {category}
                </button>
              ))}
            </div>

            {/* Sólo se renderizan las plantillas del producto actual y cuya
                categoría coincide con el filtro; "Todas" muestra todas las
                categorías disponibles para este producto. */}
            {templatesForProduct.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
                No hay plantillas disponibles para este producto aún.
              </div>
            ) : (
            allTemplates
              .filter((template) =>
                selectedCategoryFilter === 'Todas' ? true : template.category === selectedCategoryFilter,
              )
              .filter((template) => templatesForProduct.includes(template))
              .map((template) => (
              <div
                key={template.id}
                className={`group relative overflow-hidden rounded-xl border text-left transition hover:shadow-sm ${
                  editingTemplate?.id === template.saved?.id
                    ? 'border-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {/* Acciones de gestión (sólo plantillas guardadas): Editar
                    carga el diseño en el canvas y precarga el formulario;
                    Eliminar pide confirmación antes de borrar de localStorage. */}
                {template.saved && (
                  <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
                    <button
                      type="button"
                      title="Editar plantilla"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTemplate(template);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-700 backdrop-blur transition hover:bg-slate-900 hover:text-white"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      title="Eliminar plantilla"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(template.saved!);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-700 backdrop-blur transition hover:bg-red-600 hover:text-white"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className="block w-full text-left"
                >
                {/* Vista previa: ícono representativo grande de la categoría
                    (ej. 🎂, ❤️) en lugar del screenshot miniaturizado del
                    canvas; se usa el `icon` guardado, con fallback al mapa
                    CATEGORY_ICONS para plantillas guardadas antes del cambio.
                    El clic sigue cargando el JSON completo en el canvas. */}
                {(() => {
                  // Prioridad: ícono actual de la categoría (respeta cambios
                  // del admin en tiempo real) → ícono guardado → emoji mock.
                  const categoryIcon = template.saved ? getCategoryIcon(template.saved.category) : template.emoji;
                  const previewIcon =
                    categoryIcon !== '⭐' ? categoryIcon : template.saved?.icon ?? template.emoji;
                  // Fallback: si ni la categoría ni la plantilla tienen ícono,
                  // muestra su miniatura dataURL.
                  if (previewIcon === '⭐' && template.saved?.thumbnail) {
                    return (
                      <img
                        src={template.saved.thumbnail}
                        alt={template.name}
                        className="h-24 w-full bg-slate-50 object-cover"
                      />
                    );
                  }
                  return (
                    <div className={`flex h-24 items-center justify-center bg-gradient-to-br text-5xl ${template.accent}`}>
                      <span className="drop-shadow-sm">{previewIcon}</span>
                    </div>
                  );
                })()}
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{template.name}</p>
                  <p className="text-[11px] text-slate-500">{template.description}</p>
                </div>
                </button>
              </div>
            ))
            )}
          </div>

          {/* Las plantillas guardadas ya viven en la lista principal de tarjetas
              (allTemplates = mocks + localStorage), así que no hay sección
              redundante de texto plano abajo. La eliminación se hace desde los
              botones 🗑️ de cada tarjeta. */}
          <p className="text-[11px] italic text-slate-400">
            Las plantillas reemplazan el diseño actual; el producto y la zona segura se conservan.
          </p>
        </div>
      )}

      {activeTab === 'recursos' && (<>
      {/* Buscador de Iconos / Vectores Compacto */}
      <div className="space-y-1.5 mb-4">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar iconos o formas (ej: star, leaf)..."
            value={iconQuery}
            onChange={(e) => setIconQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-black"
          />
        </div>
        <p className="px-1 text-[10px] italic text-slate-400">
          💡 Tip: Busca en inglés para más resultados.
        </p>
      </div>

      {iconQuery.trim().length <= 2 && (
        <div className="py-6 text-center text-xs text-slate-400">
          <p>Escribe una palabra clave arriba para explorar recursos vectoriales.</p>
        </div>
      )}

      {iconQuery.trim().length > 2 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Recursos</p>

          {iconLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Buscando recursos...
            </div>
          )}

          {!iconLoading && iconError && (
            <p className="text-sm text-red-500">{iconError}</p>
          )}

          {!iconLoading && !iconError && iconResults.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {iconResults.map((iconName, index) => {
                // iconName es una string tipo "mdi:home"; clave única explícita combinando índice/valor
                const keyId = typeof iconName === 'string' ? iconName : `icon-${index}`;
                const iconUrl = `https://api.iconify.design/${
                  typeof iconName === 'string' ? iconName.replace(':', '/') : `icon-${index}`
                }.svg`;

                return (
                  <button
                    key={`${keyId}-${index}`}
                    type="button"
                    title={typeof iconName === 'string' ? iconName : `Recurso ${index + 1}`}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('editor:add-svg', { detail: { svgUrl: iconUrl } }),
                      )
                    }
                    className="flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 transition hover:bg-slate-100"
                  >
                    <img
                      src={iconUrl}
                      alt={typeof iconName === 'string' ? iconName : `Recurso ${index + 1}`}
                      width={32}
                      height={32}
                      className="h-8 w-8"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {!iconLoading && !iconError && iconResults.length === 0 && (
            <p className="text-sm text-slate-500">No se encontraron recursos</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Texto</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('editor:add-text', {
                  detail: { text: 'Título de Ejemplo', fontSize: 32, fontWeight: 'bold' },
                }),
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
          >
            Agregar Título
          </button>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('editor:add-text', { detail: { text: 'Escribe tu párrafo aquí...', fontSize: 16 } }),
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
          >
            Agregar Párrafo
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Archivos subidos</p>
        <label htmlFor="upload-image" className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white">
          <span>Subir imagen</span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-lg text-slate-700 shadow-sm">+</span>
        </label>
        <input
          id="upload-image"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (fEvent) => {
                const dataUrl = fEvent.target?.result as string;
                if (dataUrl) {
                  // ✅ 1. PRIMERO agregar a la lista de subidos (CON VERIFICACIÓN DE DUPLICADOS)
                  setUploadedImages((prev) => {
                    const exists = prev.some((existingUrl) => existingUrl === dataUrl);
                    if (exists) return prev;
                    return [...prev, dataUrl];
                  });
                  
                  // ✅ 2. LUEGO agregar al canvas
                  window.dispatchEvent(new CustomEvent('editor:add-image', { detail: { dataUrl } }));
                }
              };
              reader.readAsDataURL(file);
              // Limpiar input para permitir subir el mismo archivo nuevamente
              e.target.value = '';
            }
          }}
        />
        {uploadedImages.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {uploadedImages.map((url, index) => (
              <img key={index} src={url} alt={`Uploaded ${index + 1}`} className="h-24 w-full cursor-pointer rounded-xl object-cover transition hover:opacity-80" onClick={() => window.dispatchEvent(new CustomEvent('editor:add-image', { detail: { dataUrl: url } }))} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Formas</p>
        <div className="grid grid-cols-2 gap-2">
          {forms.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  console.log("Disparando forma:", item.shape);
                  window.dispatchEvent(new CustomEvent('editor:add-shape', { 
                    detail: { type: item.shape } 
                  }));
                }}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm">
                  <Icon size={18} />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      </>)}

    </aside>
  );
}
