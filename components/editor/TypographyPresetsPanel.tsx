'use client';

// ── Galería flotante de combinaciones tipográficas (estilo Canva) ───────────
// Se abre al pulsar "Agregar Título" o "Agregar Párrafo" en la sidebar. Incluye
// buscador ("Busca fuentes y combinaciones..."), acciones rápidas (caja de
// texto simple / Texto Mágico) y una cuadrícula de 2 columnas con tarjetas que
// renderizan una vista previa CSS real (Google Fonts + sombras/trazos/rotación
// del preset). El sidebar tiene overflow-hidden y ancho fijo w-80, así que el
// popover usa position: fixed anclado al rect del botón: ningún ancestro lo
// recorta. Al elegir un preset se emite 'editor:add-text-preset' y EditorCanvas
// crea el fabric.IText (preset simple) o el fabric.Group (combo multicapa).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Search, Sparkles, Type, X } from 'lucide-react';
import { loadGoogleFonts } from '@/lib/googleFonts';
import {
  ALL_PRESET_FONTS,
  PREVIEW_SCALE,
  TEXT_PRESET_CATEGORIES,
  searchTypographyPresets,
  type PresetTextLayer,
  type TypographyPreset,
  type TypographyPresetCategory,
} from './typographyPresets';
import {
  FONT_STYLE_LABELS,
  LIBRARY_PREVIEW_FONTS,
  searchFontLibrary,
} from '@/lib/googleFontLibrary';

const PANEL_WIDTH = 380;
const VIEWPORT_MARGIN = 12;
/** Sugerencias del buscador cuando la consulta no arroja resultados. */
const SEARCH_SUGGESTIONS = ['neon', 'retro', 'oferta', 'parrilla', 'elegante', 'moderno'];

interface TypographyPresetsPanelProps {
  open: boolean;
  /** Rect del botón que lo abrió (para anclarlo con position: fixed). */
  anchorRect: DOMRect | null;
  /** Categoría que recibe el scroll inicial: Títulos o Combinaciones. */
  focusCategory?: TypographyPresetCategory;
  onClose: () => void;
}

/** Sólo las dos primeras líneas del texto: la miniatura no muestra párrafos. */
const previewText = (text: string): string => text.split('\n').slice(0, 2).join('\n');

/** Traduce una capa del preset (unidades Fabric) a estilos CSS de la miniatura. */
const layerToCss = (layer: PresetTextLayer): CSSProperties => {
  const transforms: string[] = [];
  if (layer.rotation) transforms.push(`rotate(${layer.rotation}deg)`);
  if (layer.skewX) transforms.push(`skewX(${layer.skewX}deg)`);
  return {
    fontFamily: `"${layer.fontFamily}", ${layer.fontStyle === 'italic' ? 'serif' : 'sans-serif'}`,
    fontSize: Math.max(8, Math.round(layer.fontSize * PREVIEW_SCALE)),
    fontWeight: layer.fontWeight ?? 400,
    fontStyle: layer.fontStyle ?? 'normal',
    color: layer.fill,
    lineHeight: layer.lineHeight ?? 1.2,
    // Fabric mide charSpacing en milésimas de em; en CSS es literal.
    letterSpacing: `${(layer.charSpacing ?? 0) / 1000}em`,
    textShadow: layer.shadow,
    WebkitTextStroke:
      layer.stroke && layer.strokeWidth
        ? `${Math.max(0.5, layer.strokeWidth * PREVIEW_SCALE)}px ${layer.stroke}`
        : undefined,
    background: layer.textBackgroundColor || undefined,
    padding: layer.textBackgroundColor ? '0 3px' : undefined,
    transform: transforms.length ? transforms.join(' ') : undefined,
    whiteSpace: 'pre-line',
    textAlign: layer.textAlign ?? 'center',
  };
};

export default function TypographyPresetsPanel({
  open,
  anchorRect,
  focusCategory,
  onClose,
}: TypographyPresetsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Partial<Record<TypographyPresetCategory, HTMLDivElement | null>>>({});
  const [position, setPosition] = useState({ left: VIEWPORT_MARGIN, top: VIEWPORT_MARGIN });
  const [query, setQuery] = useState('');

  // Fuentes del catálogo (presets + biblioteca): se piden al abrir para que
  // las tarjetas luzcan la tipografía real (display=swap repinta el DOM
  // cuando llega cada face). La biblioteca se solicita sólo en peso 400.
  useEffect(() => {
    if (open) void loadGoogleFonts([...ALL_PRESET_FONTS, ...LIBRARY_PREVIEW_FONTS]);
  }, [open]);

  // Al (re)abrir la galería el buscador arranca limpio y recibe el foco: el
  // flujo Canva es "abrir → teclear" sin clics extra.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    searchRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Anclaje fijo junto al botón, con flip al lado izquierdo si no hay hueco.
  useLayoutEffect(() => {
    if (!open || !anchorRect || typeof window === 'undefined') return;
    const maxHeight = Math.min(560, window.innerHeight - VIEWPORT_MARGIN * 2);
    let left = anchorRect.right + 10;
    if (left + PANEL_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
      left = Math.max(VIEWPORT_MARGIN, anchorRect.left - PANEL_WIDTH - 10);
    }
    const top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchorRect.top - 8, window.innerHeight - maxHeight - VIEWPORT_MARGIN),
    );
    setPosition({ left, top });
  }, [open, anchorRect]);

  // Catálogo filtrado por el buscador (nombre, tags, fuentes y textos, sin
  // acentos). useMemo evita re-filtrar en cada render del popover.
  const grouped = useMemo(() => searchTypographyPresets(query), [query]);
  const totalMatches = TEXT_PRESET_CATEGORIES.reduce(
    (count, category) => count + grouped[category.id].length,
    0,
  );
  // Bibliotecas de familias también se filtran con la misma consulta: la
  // galería busca por nombre ("anton"), estilo ("serif") o ocasión ("boda").
  const fontMatches = useMemo(() => searchFontLibrary(query), [query]);
  const noResults = totalMatches === 0 && fontMatches.length === 0;

  // La categoría pedida ("Agregar Párrafo" → Combinaciones) recibe el scroll,
  // salvo mientras se busca (con consulta activa las secciones cambian solas).
  useEffect(() => {
    if (!open || !focusCategory || query) return;
    sectionRefs.current[focusCategory]?.scrollIntoView({ block: 'start' });
  }, [open, focusCategory, query]);

  // Cierre con Escape y con clic fuera (el botón disparador gestiona su toggle).
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (panelRef.current?.contains(target) || target?.closest('[data-text-presets-toggle]')) return;
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const applyPreset = (preset: TypographyPreset) => {
    window.dispatchEvent(
      new CustomEvent('editor:add-text-preset', { detail: { presetId: preset.id } }),
    );
    onClose();
  };

  const addPlainDefault = () => {
    // Opción clásica conservada: texto sin estilos preestablecidos.
    window.dispatchEvent(
      new CustomEvent('editor:add-text', {
        detail: { text: 'Escribe tu texto...', fontSize: 24 },
      }),
    );
    onClose();
  };

  // "Texto Mágico": sin generador IA de estilos conectado todavía, la galería
  // aplica un preset destacado al azar entre los visibles por el buscador.
  const applyMagicPreset = () => {
    const pool = TEXT_PRESET_CATEGORIES.flatMap((category) => grouped[category.id]);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) applyPreset(pick);
  };

  // Tarjeta de "Todas las fuentes": EditorCanvas aplica la familia al texto
  // seleccionado o, si no hay ninguno, inserta una caja nueva con esa tipografía.
  const applyLibraryFont = (family: string) => {
    window.dispatchEvent(
      new CustomEvent('editor:apply-library-font', { detail: { family } }),
    );
    onClose();
  };


  return (
    <div
      ref={panelRef}
      data-presets-panel
      style={{ left: position.left, top: position.top, width: PANEL_WIDTH }}
      className="fixed z-50 flex max-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      role="dialog"
      aria-label="Galería de combinaciones tipográficas"
    >
      {/* Cabecera + buscador + acciones rápidas (fija mientras el grid scrollea). */}
      <div className="shrink-0 space-y-2.5 border-b border-slate-100 px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Tipografías y combinaciones
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar galería de tipografías"
          >
            <X size={15} />
          </button>
        </div>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca fuentes y combinaciones..."
            aria-label="Buscar fuentes y combinaciones tipográficas"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Limpiar búsqueda"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={addPlainDefault}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
              <Type size={14} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-700">
                Agregar caja de texto
              </span>
              <span className="block truncate text-[10px] text-slate-400">Sin estilos previos</span>
            </span>
          </button>
          <button
            type="button"
            onClick={applyMagicPreset}
            className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-2 text-left transition hover:border-violet-300 hover:bg-violet-100"
            title="Inserta un estilo destacado al azar de la galería"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm">
              <Sparkles size={14} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-violet-700">
                Texto Mágico
              </span>
              <span className="block truncate text-[10px] text-violet-400">Estilo al azar</span>
            </span>
          </button>
        </div>
      </div>


      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {noResults ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Search size={20} className="text-slate-300" aria-hidden />
            <p className="text-sm font-medium text-slate-500">Sin resultados para «{query}»</p>
            <p className="text-[11px] text-slate-400">Prueba con:</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
          {TEXT_PRESET_CATEGORIES.map((category) => {
            const presets = grouped[category.id];
            // Con el buscador activo, las categorías sin coincidencias se ocultan.
            if (presets.length === 0) return null;
            return (
              <div
                key={category.id}
                ref={(node) => {
                  sectionRefs.current[category.id] = node;
                }}
                className="space-y-2"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {category.label}
                  <span className="ml-1.5 font-medium normal-case tracking-normal text-slate-300">
                    ({presets.length})
                  </span>
                </p>
                {/* Grid 2 columnas estilo Canva con la vista previa real del diseño. */}
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-violet-400 hover:shadow-md"
                      title={`${preset.name} — ${[...new Set(preset.layers.map((layer) => layer.fontFamily))].join(' + ')}`}
                    >
                      <div
                        className="flex h-[84px] flex-col items-center justify-center gap-0.5 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/70 px-2"
                        style={
                          preset.previewBackground
                            ? { background: preset.previewBackground }
                            : undefined
                        }
                      >
                        {preset.layers.map((layer, index) => (
                          <span
                            key={index}
                            style={layerToCss(layer)}
                            className="block max-w-full overflow-hidden leading-none"
                          >
                            {previewText(layer.text)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-1 border-t border-slate-100 px-2 py-1.5">
                        <span className="truncate text-[10.5px] font-semibold text-slate-600">
                          {preset.name}
                        </span>
                        <span className="shrink-0 text-[9.5px] text-slate-400">
                          {preset.layers.length > 1 ? `${preset.layers.length} capas` : '1 capa'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {/* ── Todas las fuentes: biblioteca completa de familias Google ──
              Clic en una tarjeta = aplicar al texto seleccionado (si lo hay)
              o insertar una caja nueva con esa tipografía (EditorCanvas). */}
          {fontMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Todas las fuentes
                <span className="ml-1.5 font-medium normal-case tracking-normal text-slate-300">
                  ({fontMatches.length})
                </span>
              </p>
              <p className="-mt-1 text-[10.5px] text-slate-400">
                Clic: aplica al texto seleccionado o inserta uno nuevo.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {fontMatches.map((font) => (
                  <button
                    key={font.family}
                    type="button"
                    onClick={() => applyLibraryFont(font.family)}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-violet-400 hover:shadow-md"
                    title={`Aplicar ${font.family}`}
                  >
                    <div className="flex h-[46px] items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/70 px-2">
                      <span
                        className="truncate text-[24px] leading-none text-slate-700"
                        style={{ fontFamily: `"${font.family}", sans-serif` }}
                      >
                        Aa
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 border-t border-slate-100 px-2 py-1.5">
                      <span className="truncate text-[10.5px] font-semibold text-slate-600">
                        {font.family}
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-slate-400">
                        {FONT_STYLE_LABELS[font.style]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

