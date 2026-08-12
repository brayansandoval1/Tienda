'use client';

import { useState, useEffect } from 'react';
import type { TextOptions } from '@/types/product';
import { Search, Square, Circle, Triangle, Star, Heart, Loader2 } from 'lucide-react';

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
    <aside className="w-full max-w-[280px] space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
        <Search size={18} />
        <input
          type="search"
          placeholder="Ej: star, heart, coffee, car..."
          value={iconQuery}
          onChange={(e) => setIconQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      <p className="mt-1.5 px-1 text-xs text-slate-500">
        💡 <strong>Tip:</strong> Busca conceptos en inglés para obtener miles de iconos (ej: <i>shirt, leaf, fire, smile</i>).
      </p>

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
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Texto</p>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('editor:add-text', {
                  detail: { text: 'Título de Ejemplo', fontSize: 32, fontWeight: 'bold' },
                }),
              )
            }
            className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-lg font-semibold text-slate-700 transition hover:bg-slate-100"
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
            className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Agregar Párrafo
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Archivos subidos</p>
        <label htmlFor="upload-image" className="flex cursor-pointer items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
          <span>Subir imagen</span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700">+</span>
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
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Formas</p>
        <div className="grid gap-3">
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
                className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon size={18} />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

    </aside>
  );
}
