'use client';

import { useState, useEffect } from 'react';
import type { TextOptions } from '@/types/product';
import { Search, Square, Circle, Triangle, Star, Heart, Loader2, LayoutTemplate, Shapes, Save, Trash2 } from 'lucide-react';
import { MOCK_TEMPLATES, type MockTemplate } from '@/src/data/mockTemplates';
import { listSavedTemplates, deleteSavedTemplate, type SavedTemplate } from '@/src/utils/templateStorage';

const forms = [
  { label: 'Cuadrado', icon: Square, shape: 'rect' as const },
  { label: 'Círculo', icon: Circle, shape: 'circle' as const },
  { label: 'Triángulo', icon: Triangle, shape: 'triangle' as const },
  { label: 'Estrella', icon: Star, shape: 'star' as const },
  { label: 'Corazón', icon: Heart, shape: 'heart' as const }
];

export default function SidebarPanel() { // Removed onAddShape prop
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
  // Filtro de categorías del tab "Plantillas" ("Todas" muestra el catálogo completo).
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todas');
  const TEMPLATE_CATEGORIES = ['Todas', 'Cumpleaños', 'Parejas / Aniversario', 'Bodas', 'Corporativo'];

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
      emoji: '⭐',
      accent: 'from-slate-100 to-slate-200',
      templateJSON: saved.templateJSON,
      saved,
    })),
  ];

  // Carga inicial + refresco cuando el editor guarda una plantilla nueva.
  useEffect(() => {
    setSavedTemplates(listSavedTemplates());
    const handleSaved = (event: Event) => {
      const ok = (event as CustomEvent<{ ok?: boolean; name?: string }>).detail?.ok;
      setSavedTemplates(listSavedTemplates());
      if (ok) {
        setTemplateFeedback(`✅ Plantilla "${(event as CustomEvent<{ name?: string }>).detail?.name}" guardada`);
        setTemplateName('');
      } else {
        setTemplateFeedback('⚠️ No se pudo guardar (¿canvas vacío o cuota agotada?)');
      }
      setTimeout(() => setTemplateFeedback(null), 4000);
    };
    window.addEventListener('editor:template-saved', handleSaved);
    return () => window.removeEventListener('editor:template-saved', handleSaved);
  }, []);

  // Activa el "modo guardar" en el canvas: el editor serializa el diseño
  // actual (sin mockup) y lo persiste vía handleSaveAsTemplate.
  const handleSaveAsTemplateRequest = (name: string, category: string) => {
    window.dispatchEvent(new CustomEvent('editor:save-as-template', { detail: { name, category } }));
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

          {/* Modo Administrador: guardar el diseño actual como plantilla.
              TODO: cuando exista BD, este dispatch pasa a POST /api/templates. */}
          <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Guardar diseño actual</p>
            <input
              type="text"
              placeholder="Nombre de la plantilla..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
            />
            <select
              value={templateCategory}
              onChange={(e) => setTemplateCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black"
            >
              <option value="Cumpleaños">Cumpleaños</option>
              <option value="Parejas">Parejas</option>
              <option value="General">General</option>
              <option value="Corporativo">Corporativo</option>
            </select>
            <button
              type="button"
              onClick={() => handleSaveAsTemplateRequest(templateName, templateCategory)}
              disabled={!templateName.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={13} />
              Guardar como Plantilla
            </button>
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
                  {category}
                </button>
              ))}
            </div>

            {/* Sólo se renderizan las tarjetas cuya categoría coincide con el
                filtro; "Todas" muestra el catálogo completo. */}
            {allTemplates
              .filter((template) =>
                selectedCategoryFilter === 'Todas' ? true : template.category === selectedCategoryFilter,
              )
              .map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelectTemplate(template)}
                className="group relative w-full overflow-hidden rounded-xl border border-slate-200 text-left transition hover:border-slate-400 hover:shadow-sm"
              >
                {/* Miniatura: dataURL real para plantillas guardadas; gradiente
                    simulado para los mocks de prueba. */}
                {template.saved?.thumbnail ? (
                  <img src={template.saved.thumbnail} alt={template.name} className="h-24 w-full object-cover" />
                ) : (
                  <div className={`flex h-20 items-center justify-center bg-gradient-to-br text-3xl ${template.accent}`}>
                    <span>{template.emoji}</span>
                  </div>
                )}
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{template.name}</p>
                  <p className="text-[11px] text-slate-500">{template.description}</p>
                </div>
              </button>
            ))}
          </div>

          {savedTemplates.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Mis plantillas guardadas</p>
              {savedTemplates.map((saved) => (
                <div key={saved.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-1.5">
                  <span className="truncate text-xs text-slate-700">{saved.name} · {saved.category}</span>
                  <button
                    type="button"
                    title="Eliminar plantilla"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSavedTemplates(deleteSavedTemplate(saved.id));
                    }}
                    className="text-slate-400 transition hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
