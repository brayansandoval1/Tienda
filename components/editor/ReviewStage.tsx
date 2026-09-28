'use client';

// =============================================================================
// Pestaña "Revisar" del editor del cliente (estilo Zazzle).
//
// MOTOR DE PROYECCIÓN:
// 1. Pide a EditorCanvas el diseño actual como PNG transparente recortado a la
//    zona segura ('editor:design-render-request' → 'editor:design-render').
// 2. Para cada foto de `reviewGallery`, un canvas fuera de pantalla dibuja la
//    foto base del producto/modelo y encima el diseño escalado a la caja de
//    estampado guardada (xPercent, yPercent, widthPercent, heightPercent).
// 3. Izquierda: tira vertical de miniaturas. Centro: visor ampliado. La
//    columna de confirmación (precio/cantidad/comprar) vive en ViewSelector,
//    el panel derecho de EditorShell.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ImageOff, RefreshCw, Settings2 } from 'lucide-react';
import { type Product } from '@/src/store/useProductStore';
import type { PrintAreaPercent } from '@/src/config/products';
import { resolveMasterPrintArea, resolveReviewImagePrintArea, viewPrintAreaToPercent } from '@/src/utils/reviewGallery';

/** Una vista a componer: foto de reseña de Admin o mockup base del producto. */
interface RenderTarget {
  id: string;
  label: string;
  /** Foto base sobre la que se proyecta el diseño. */
  photoUrl: string;
  /** Cara del lienzo cuyo diseño se exporta para esta foto. */
  viewId: string;
  /** Caja de estampado en % relativo a la foto completa. */
  area: PrintAreaPercent;
  /** true = la "foto" es el mockup base (el lienzo manda sobre su caja). */
  isMockupFallback: boolean;
}

interface RenderSlot {
  status: 'loading' | 'done' | 'error';
  url?: string;
  /** Motivo legible cuando status === 'error'. */
  error?: string;
}

const COMPOSITE_MAX_DIM = 1600;
const COMPOSITE_JPEG_QUALITY = 0.85;
// Renderizar otra cara (multi-vista) implica recargar su mockup por red y
// revivir el diseño guardado: 4 s se quedaba corto y declaraba error una
// cara perfectamente válida.
const DESIGN_RESPONSE_TIMEOUT_MS = 8000;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // CORS anónimo en URLs remotas: sin él, una imagen externa contamina
    // (taints) el canvas de composición y toDataURL lanza SecurityError. Las
    // data URLs no lo soportan ni lo necesitan (se sirven safe-origin).
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen base (${src.slice(0, 48)}…). Si la URL es externa, puede no permitir CORS.`));
    img.src = src;
  });

export default function ReviewStage({ product }: { product: Product }) {
  const gallery = useMemo(() => product.reviewGallery ?? [], [product.reviewGallery]);
  const masterViewId = product.masterPrintArea?.viewId ?? product.views[0]?.id ?? 'front';
  const masterArea = useMemo(() => resolveMasterPrintArea(product, masterViewId), [product, masterViewId]);

  /**
   * Vistas a componer: las fotos del Admin (con su caja maestra o propia) o,
   * si el producto aún no tiene galería, los mockups base como respaldo.
   */
  const targets = useMemo<RenderTarget[]>(() => {
    if (gallery.length > 0) {
      return gallery
        .filter((image) => Boolean(image.imageUrl))
        .map((image) => ({
          id: image.id,
          label: image.title || 'Foto de reseña',
          photoUrl: image.imageUrl,
          viewId: masterViewId,
          area: resolveReviewImagePrintArea(image, masterArea),
          isMockupFallback: false,
        }));
    }
    return (product.views ?? [])
      .filter((view) => Boolean(view.mockupUrl))
      .map((view) => ({
        id: `mockup:${view.id}`,
        label: view.label || view.name || view.id,
        photoUrl: view.mockupUrl,
        viewId: view.id,
        area: viewPrintAreaToPercent(view, product.canvasWidth, product.canvasHeight),
        isMockupFallback: true,
      }));
  }, [gallery, masterArea, masterViewId, product.canvasHeight, product.canvasWidth, product.views]);

  /** Resultado de composición por vista, indexado por RenderTarget.id. */
  const [renders, setRenders] = useState<Record<string, RenderSlot>>({});
  const [activeId, setActiveId] = useState<string>('');
  /** Forzar recomposición completa (botón "Actualizar renders"). */
  const [reloadNonce, setReloadNonce] = useState(0);

  const hasGallery = gallery.length > 0;

  // La miniatura seleccionada se pierde si la galería cambió desde Admin.
  useEffect(() => {
    setActiveId((current) => (targets.some((target) => target.id === current) ? current : targets[0]?.id ?? ''));
  }, [targets]);

  /**
   * Pide al lienzo el diseño recortado a la zona segura. `timedOut: true`
   * significa que el lienzo nunca respondió; una respuesta con `png: ''` y
   * sin `tainted` es válida: esa cara simplemente no tiene diseño todavía.
   */
  const requestDesignPNG = useCallback((viewId: string) =>
    new Promise<{ png: string; tainted: boolean; timedOut: boolean; area?: PrintAreaPercent }>((resolve) => {
      let settled = false;
      const requestId = `review-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const finish = (value: { png: string; tainted: boolean; timedOut: boolean; area?: PrintAreaPercent }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener('editor:design-render', onResponse);
        resolve(value);
      };
      const onResponse = (event: Event) => {
        const detail = (event as CustomEvent<{
          requestId?: string;
          designPNG?: string;
          tainted?: boolean;
          area?: Partial<PrintAreaPercent>;
        }>).detail;
        if (detail?.requestId !== requestId) return;
        // Caja realmente recortada por el lienzo (puede ser la zona segura de
        // una opción, distinta de la maestra). Si no llega o es inválida,
        // composeTarget usará la caja guardada del objetivo.
        const rawArea = detail.area;
        const area = rawArea
          && Number.isFinite(Number(rawArea.xPercent))
          && Number.isFinite(Number(rawArea.yPercent))
          && Number(Number(rawArea.widthPercent)) > 0
          && Number(Number(rawArea.heightPercent)) > 0
          ? {
              xPercent: Number(rawArea.xPercent),
              yPercent: Number(rawArea.yPercent),
              widthPercent: Number(rawArea.widthPercent),
              heightPercent: Number(rawArea.heightPercent),
            }
          : undefined;
        finish({ png: detail.designPNG || '', tainted: detail.tainted === true, timedOut: false, area });
      };
      const timer = window.setTimeout(() => finish({ png: '', tainted: false, timedOut: true }), DESIGN_RESPONSE_TIMEOUT_MS);
      window.addEventListener('editor:design-render', onResponse);
      window.dispatchEvent(new CustomEvent('editor:design-render-request', { detail: { requestId, viewId } }));
    }), []);

  /**
   * Composición real: la foto base del producto/modelo cubre todo el lienzo
   * y encima se dibuja el diseño escalado a la caja de estampado guardada.
   */
  const composeTarget = useCallback(async (target: RenderTarget) => {
    setRenders((current) => ({ ...current, [target.id]: { status: 'loading' } }));
    try {
      const design = await requestDesignPNG(target.viewId);
      if (design.timedOut) {
        throw new Error('El lienzo no devolvió el diseño a tiempo. Pulsa Reintentar o Actualizar renders.');
      }
      if (!design.png && design.tainted) {
        throw new Error('El mockup del producto es una imagen externa sin permisos CORS: el navegador bloquea exportar el diseño. Sube el mockup como archivo local o usa un host que envíe Access-Control-Allow-Origin.');
      }
      // design.png === '' (respuesta válida sin tainted) = cara sin diseño
      // todavía: se compone igualmente la foto limpia del producto.
      const [photo, designImage] = await Promise.all([
        loadImage(target.photoUrl),
        design.png ? loadImage(design.png) : Promise.resolve<HTMLImageElement | null>(null),
      ]);
      const naturalWidth = photo.naturalWidth || photo.width;
      const naturalHeight = photo.naturalHeight || photo.height;
      if (!naturalWidth || !naturalHeight) throw new Error('La foto base no reportó dimensiones.');
      const scale = Math.min(1, COMPOSITE_MAX_DIM / Math.max(naturalWidth, naturalHeight));
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('El navegador no expone un contexto 2D.');
      ctx.drawImage(photo, 0, 0, width, height);
      if (designImage) {
        // Caja de dibujo. En los respaldos de mockup manda la caja devuelta
        // por el lienzo (zona segura REAL de la opción activa; la foto ES el
        // mockup, así que su % es exacto). En fotos de galería se respeta la
        // caja calibrada por Admin en posición y ancho, pero se corrige el
        // alto a la proporción nativa del PNG: dibujarlo en una caja de otra
        // proporción (p. ej. la maestra mientras una opción impone su zona)
        // estiraría el diseño y "no coincidiría" con lo diseñado.
        let box = target.area;
        if (target.isMockupFallback && design.area) {
          box = design.area;
        } else {
          const pngAspect = (designImage.naturalHeight || 1) / (designImage.naturalWidth || 1);
          const heightPercent = target.area.widthPercent * (naturalWidth / naturalHeight) * pngAspect;
          box = {
            xPercent: target.area.xPercent,
            yPercent: target.area.yPercent + (target.area.heightPercent - heightPercent) / 2,
            widthPercent: target.area.widthPercent,
            heightPercent,
          };
        }
        ctx.drawImage(designImage,
          (box.xPercent / 100) * width,
          (box.yPercent / 100) * height,
          (box.widthPercent / 100) * width,
          (box.heightPercent / 100) * height,
        );
      }
      setRenders((current) => ({
        ...current,
        [target.id]: { status: 'done', url: canvas.toDataURL('image/jpeg', COMPOSITE_JPEG_QUALITY) },
      }));
    } catch (error) {
      // SecurityError: la foto base externa contaminó el canvas de composición
      // (host sin Access-Control-Allow-Origin). El resto son fallos de carga o
      // de respuesta del lienzo; ninguno debe romper la pestaña.
      const security = error instanceof DOMException && error.name === 'SecurityError';
      const reason = security
        ? 'La foto base es una imagen externa sin permisos CORS y el navegador bloquea su exportación. Sube la foto como archivo local o usa un host compatible con CORS.'
        : error instanceof Error ? error.message : 'Error desconocido al componer la vista.';
      console.error('❌ [REVIEW] No se pudo componer la vista:', target.id, error);
      setRenders((current) => ({ ...current, [target.id]: { status: 'error', error: reason } }));
    }
  }, [requestDesignPNG]);

  /**
   * Cola serial: dos peticiones superpuestas harían que cada una alterne la
   * vista del lienzo Fabric a la vez y se pisen entre sí. Encadenadas, cada
   * composición empieza con el lienzo intacto.
   */
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((target: RenderTarget) => {
    const task = queueRef.current.then(() => composeTarget(target));
    queueRef.current = task.catch(() => undefined);
    return task;
  }, [composeTarget]);

  // Recomponer todo cuando cambia la galería/zonas o al pulsar "Actualizar".
  // La vista activa se atiende primero para que el visor principal responda ya.
  useEffect(() => {
    if (targets.length === 0) return;
    let cancelled = false;
    const run = async () => {
      const ordered = [
        ...targets.filter((target) => target.id === activeId),
        ...targets.filter((target) => target.id !== activeId),
      ];
      for (const target of ordered) {
        if (cancelled) return;
        await enqueue(target);
      }
    };
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, reloadNonce, product.updatedAt]);

  const activeTarget = targets.find((target) => target.id === activeId) ?? targets[0];
  const activeSlot = activeTarget ? renders[activeTarget.id] : undefined;

  // Sin fotos de reseña ni mockups, no hay nada que componer: estado vacío.
  if (targets.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <ImageOff size={26} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-700">Sin fotos de reseña todavía</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-500">
            Sube fotos del producto en el panel de administración para previsualizar el diseño aquí.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        >
          <Settings2 size={14} /> Ir al panel de productos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full bg-slate-50">
      {/* Tira vertical de miniaturas (scroll suave, estilo galería de reseñas) */}
      <div className="flex w-24 shrink-0 flex-col gap-3 overflow-y-auto scroll-smooth border-r border-slate-200 bg-white/70 p-3 sm:w-28">
        {targets.map((target) => {
          const slot = renders[target.id];
          const isActive = target.id === activeTarget?.id;
          return (
            <button
              key={target.id}
              type="button"
              onClick={() => setActiveId(target.id)}
              aria-pressed={isActive}
              title={target.label}
              className={`group relative aspect-square w-full shrink-0 overflow-hidden rounded-xl border-2 bg-slate-100 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                isActive ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-transparent hover:border-slate-300'
              }`}
            >
              {/* Fondo: siempre la foto base; encima el render cuando existe */}
              <img src={target.photoUrl} alt="" aria-hidden crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover opacity-40" />
              {slot?.url && <img src={slot.url} alt={target.label} className="absolute inset-0 h-full w-full object-cover" />}
              {slot?.status === 'loading' && (
                <span className="absolute inset-0 grid place-items-center bg-white/60">
                  <RefreshCw size={16} className="animate-spin text-slate-600" />
                </span>
              )}
              {slot?.status === 'error' && (
                <span className="absolute inset-0 grid place-items-center bg-rose-50/70 text-rose-500">
                  <ImageOff size={16} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Visor principal ampliado */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/70 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{activeTarget.label}</p>
            <p className="text-[11px] text-slate-400">
              {hasGallery ? 'Así lucirá tu diseño en esta foto' : 'Vista base del producto · configura fotos de reseña en el Admin'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadNonce((current) => current + 1)}
            disabled={activeSlot?.status === 'loading'}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={12} className={activeSlot?.status === 'loading' ? 'animate-spin' : undefined} />
            Actualizar renders
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
          {activeSlot?.url ? (
            <img
              src={activeSlot.url}
              alt={`Vista de revisión: ${activeTarget.label}`}
              className="max-h-full max-w-full rounded-2xl object-contain shadow-xl ring-1 ring-black/5"
            />
          ) : activeSlot?.status === 'error' ? (
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center">
              <ImageOff size={22} className="text-rose-400" />
              <p className="text-sm font-medium text-rose-700">No se pudo generar esta vista</p>
              <p className="text-xs text-rose-500">{activeSlot?.error ?? 'Puede que el lienzo tardara demasiado en responder.'}</p>
              <button
                type="button"
                onClick={() => { void enqueue(activeTarget); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
              >
                <RefreshCw size={12} /> Reintentar
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw size={22} className="animate-spin" />
              <p className="text-xs font-medium">Componiendo vista en tiempo real…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
