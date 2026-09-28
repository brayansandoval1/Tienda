'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Images, Info, Link2, Link2Off, Save, Trash2, Upload } from 'lucide-react';
import { useProductStore } from '@/src/store/useProductStore';
import { compressImageFileToDataUrl } from '@/src/utils/imageCompression';
import MockupAreaPicker from '@/components/admin/MockupAreaPicker';
import type { PrintAreaPercent, ReviewGalleryImage } from '@/src/config/products';
import {
  percentToPickableArea,
  pickableAreaToPercent,
  resolveMasterPrintArea,
  resolveReviewImagePrintArea,
  titleFromFileName,
  viewPrintAreaToPercent,
} from '@/src/utils/reviewGallery';

/** Fotos lifestyle grandes: se comprimen para no agotar la cuota de localStorage. */
const REVIEW_IMAGE_MAX_DIM = 1000;
const REVIEW_IMAGE_QUALITY = 0.82;

const areasAreEqual = (a: PrintAreaPercent, b: PrintAreaPercent) =>
  Math.abs(a.xPercent - b.xPercent) < 0.5 &&
  Math.abs(a.yPercent - b.yPercent) < 0.5 &&
  Math.abs(a.widthPercent - b.widthPercent) < 0.5 &&
  Math.abs(a.heightPercent - b.heightPercent) < 0.5;

export default function AdminReviewGallery({ productId }: { productId: string }) {
  const products = useProductStore((state) => state.products);
  const updateProduct = useProductStore((state) => state.updateProduct);

  const product = useMemo(() => products.find((item) => item.id === productId), [products, productId]);

  // El catálogo vive en localStorage: sin hidratar, el SSR pintaría los mocks
  // y provocaría un mismatch de hidratación con las fotos reales.
  const [hydrated, setHydrated] = useState(false);
  const [masterViewId, setMasterViewId] = useState('');
  const [masterArea, setMasterArea] = useState<PrintAreaPercent | null>(null);
  const [items, setItems] = useState<ReviewGalleryImage[]>([]);
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHydrated(true), []);

  // Avvisa si localStorage quedó sin cuota al guardar base64 de las fotos.
  useEffect(() => {
    const onQuotaError = () => setStorageBlocked(true);
    window.addEventListener('editor:storage-quota-error', onQuotaError);
    return () => window.removeEventListener('editor:storage-quota-error', onQuotaError);
  }, []);

  // Carga inicial: una sola vez, cuando el producto ya está disponible.
  useEffect(() => {
    if (!hydrated || !product || masterArea) return;
    const viewId = product.masterPrintArea?.viewId ?? product.views[0]?.id ?? '';
    setMasterViewId(viewId);
    setMasterArea(resolveMasterPrintArea(product, viewId));
    setItems(product.reviewGallery ?? []);
  }, [hydrated, product, masterArea]);

  const activeMasterView = useMemo(
    () => product?.views.find((view) => view.id === masterViewId) ?? product?.views[0],
    [product, masterViewId],
  );

  // Zona que el editor tiene AHORA para esa vista: si difiere de la guardada,
  // la referencia quedó desactualizada y se ofrece resincronizarla.
  const editorAreaNow = useMemo(
    () => viewPrintAreaToPercent(activeMasterView, product?.canvasWidth, product?.canvasHeight),
    [activeMasterView, product?.canvasWidth, product?.canvasHeight],
  );

  const isMasterDrifted = Boolean(masterArea && !areasAreEqual(masterArea, editorAreaNow));

  const handleMasterChange = (area: { x: number; y: number; width: number; height: number }) => {
    setMasterArea(pickableAreaToPercent(area));
    setIsDirty(true);
  };

  const handleResyncMaster = () => {
    setMasterArea(editorAreaNow);
    setIsDirty(true);
  };


  // REQUISITO 2: carga múltiple de fotos secundarias.
  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    event.currentTarget.value = '';
    if (!files.length) return;

    setIsUploading(true);
    setFeedback(null);
    const added: ReviewGalleryImage[] = [];

    for (const file of files) {
      try {
        const imageUrl = await compressImageFileToDataUrl(file, REVIEW_IMAGE_MAX_DIM, REVIEW_IMAGE_QUALITY);
        added.push({
          id: crypto.randomUUID(),
          title: titleFromFileName(file.name),
          imageUrl,
          // Nace heredando la referencia maestra; se puede desactivar por foto.
          useMasterArea: true,
          customPrintArea: null,
        });
      } catch (error) {
        console.error('❌ [ADMIN][REVIEW GALLERY] No se pudo procesar la imagen:', error);
        setFeedback(`No se pudo procesar "${file.name}".`);
      }
    }

    if (added.length) {
      setItems((current) => [...current, ...added]);
      setIsDirty(true);
    }
    setIsUploading(false);
  };

  const updateItem = (id: string, patch: Partial<ReviewGalleryImage>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setIsDirty(true);
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setIsDirty(true);
  };

  // Al desactivar el heredado se parte de la propia zona maestra, de modo que
  // el ajuste manual sea un "retoque" y no una caja en blanco.
  const toggleInherit = (item: ReviewGalleryImage, shouldInherit: boolean) => {
    if (shouldInherit) {
      updateItem(item.id, { useMasterArea: true, customPrintArea: null });
      return;
    }
    updateItem(item.id, { useMasterArea: false, customPrintArea: masterArea ?? editorAreaNow });
  };

  const handleImageRatio = (id: string, width: number, height: number) => {
    if (!width || !height) return;
    setAspectRatios((current) => (current[id] ? current : { ...current, [id]: width / height }));
  };

  // REQUISITO 3: persiste masterPrintArea + reviewGallery en el producto.
  const handleSave = () => {
    if (!product || !masterArea) return;
    updateProduct({
      ...product,
      masterPrintArea: { ...masterArea, viewId: masterViewId },
      reviewGallery: items,
    });
    setIsDirty(false);
    setStorageBlocked(false);
    setFeedback(`Guardado: ${items.length} ${items.length === 1 ? 'foto' : 'fotos'} en la pestaña Revisar.`);
  };

  // Vista del JSON exacto que se persiste (útil para validar la integración).
  const payload = useMemo(() => ({
    productId,
    masterPrintArea: masterArea ? { ...masterArea, viewId: masterViewId } : null,
    reviewGallery: items.map((item) => ({
      id: item.id,
      title: item.title,
      // El base64 no se muestra completo para no llenar la pantalla.
      imageUrl: item.imageUrl.startsWith('data:') ? `${item.imageUrl.slice(0, 24)}… (base64)` : item.imageUrl,
      useMasterArea: item.useMasterArea,
      ...(item.useMasterArea ? {} : { customPrintArea: item.customPrintArea ?? null }),
    })),
  }), [productId, masterArea, masterViewId, items]);

  // --- Render ----------------------------------------------------------------

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-[1400px] animate-pulse space-y-4 p-4 lg:p-6">
        <div className="h-12 rounded-xl bg-slate-200" />
        <div className="h-72 rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-sm font-medium text-slate-700">No encontramos el producto «{productId}».</p>
        <Link href="/admin" className="mt-3 inline-flex text-sm font-semibold text-indigo-600">Volver al panel</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28">
      {/* Encabezado, igual que el resto de pantallas de administración. */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/admin/products" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Volver al panel
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900">{product.name}</h1>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pestaña Revisar · Fotos lifestyle</p>
          </div>
          {isDirty && <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700 sm:inline">Cambios sin guardar</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={storageBlocked}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Check className="h-4 w-4" /> {isDirty ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 lg:px-6">
        {storageBlocked && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h2 className="text-sm font-semibold text-red-800">No se pudo guardar en este navegador</h2>
            <p className="mt-1 text-xs leading-relaxed text-red-700">
              El almacenamiento local se llenó (las fotos pesan demasiado en base64). Elimina alguna foto o usa
              imágenes de menor resolución y vuelve a intentar el guardado.
            </p>
          </div>
        )}
        {feedback && !storageBlocked && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">{feedback}</p>
        )}

        {/* ── 1 · Zona Segura Maestra de referencia ─────────────────────────── */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">1 · Zona Segura Maestra de referencia</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                La zona del editor principal convertida a porcentajes relativos a la imagen base
                (<code className="font-mono text-[11px]">xPercent / yPercent / widthPercent / heightPercent</code>).
                Las fotos que heredan la posición se leen siempre de aquí.
              </p>
            </div>
            <label className="text-xs font-semibold text-slate-500">
              Vista de referencia
              <select
                value={masterViewId}
                onChange={(event) => {
                  const nextViewId = event.target.value;
                  setMasterViewId(nextViewId);
                  if (!product.masterPrintArea) {
                    setMasterArea(viewPrintAreaToPercent(product.views.find((view) => view.id === nextViewId), product.canvasWidth, product.canvasHeight));
                    setIsDirty(true);
                  }
                }}
                className="mt-1 block h-9 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-indigo-400 focus:outline-none"
              >
                {product.views.map((view) => <option key={view.id} value={view.id}>{view.name ?? view.label ?? view.id}</option>)}
              </select>
            </label>
          </div>


          {masterArea && (
            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
              <MockupAreaPicker
                mockupUrl={activeMasterView?.mockupUrl ?? product.views[0]?.mockupUrl}
                initialPrintArea={percentToPickableArea(masterArea)}
                onChange={handleMasterChange}
                fallbackLabel="Este producto no tiene mockup; ajusta la zona con los campos numéricos."
              />

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([
                    ['xPercent', 'X (%)'],
                    ['yPercent', 'Y (%)'],
                    ['widthPercent', 'Ancho (%)'],
                    ['heightPercent', 'Alto (%)'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="text-xs font-semibold text-slate-500">
                      {label}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={masterArea[key]}
                        onChange={(event) => handleMasterChange({
                          x: key === 'xPercent' ? Number(event.target.value) : masterArea.xPercent,
                          y: key === 'yPercent' ? Number(event.target.value) : masterArea.yPercent,
                          width: key === 'widthPercent' ? Number(event.target.value) : masterArea.widthPercent,
                          height: key === 'heightPercent' ? Number(event.target.value) : masterArea.heightPercent,
                        })}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-800 focus:border-indigo-400 focus:outline-none"
                      />
                    </label>
                  ))}
                </div>

                {isMasterDrifted && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">La zona cambió en el editor principal</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                      El editor ahora usa X {editorAreaNow.xPercent}% · Y {editorAreaNow.yPercent}% ·
                      {' '}{editorAreaNow.widthPercent}% × {editorAreaNow.heightPercent}% para «{activeMasterView?.name ?? activeMasterView?.id}».
                      Actualiza la referencia si quieres que todas las fotos heredadas la sigan.
                    </p>
                    <button type="button" onClick={handleResyncMaster} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
                      Sincronizar con la zona del editor
                    </button>
                  </div>
                )}
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    La referencia queda congelada al primer guardado para que las fotos ya revisadas no se muevan
                    si alguien edita la zona del editor después. Usa «Sincronizar» solo cuando quieras propagar el cambio.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 2 · Fotos lifestyle / ángulos adicionales ─────────────────────── */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">2 · Fotos lifestyle y ángulos adicionales</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                Sube varias fotos a la vez (modelo masculino, femenino, plano general...). Cada una hereda la
                posición automática de la referencia maestra; desactívala solo si esa foto necesita un reajuste fino.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              {items.length} {items.length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 disabled:cursor-wait"
          >
            <Upload className={`h-6 w-6 ${isUploading ? 'animate-spin text-indigo-500' : 'text-slate-400'}`} />
            <span className="text-sm font-semibold text-slate-700">{isUploading ? 'Procesando imágenes…' : 'Arrastra o selecciona fotos (varias a la vez)'}</span>
            <span className="text-[11px] text-slate-400">JPG o PNG · se optimizan automáticamente para el navegador</span>
          </button>

          {items.length > 0 && (
            <ul className="mt-5 grid gap-5 xl:grid-cols-2">
              {items.map((item) => {
                const effectiveArea = resolveReviewImagePrintArea(item, masterArea ?? editorAreaNow);
                return (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Images className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        value={item.title}
                        onChange={(event) => updateItem(item.id, { title: event.target.value })}
                        placeholder="Título de la foto (p. ej. Modelo Frente)"
                        className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:border-indigo-400 focus:outline-none"
                      />
                      <button type="button" onClick={() => removeItem(item.id)} aria-label={`Eliminar ${item.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 grid gap-4 lg:grid-cols-2">
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          onLoad={(event) => handleImageRatio(item.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
                          className="h-full max-h-[320px] w-full object-contain"
                        />
                      </div>

                      <MockupAreaPicker
                        mockupUrl={item.imageUrl}
                        initialPrintArea={percentToPickableArea(effectiveArea)}
                        onChange={(area) => updateItem(item.id, { customPrintArea: pickableAreaToPercent(area) })}
                        readOnly={item.useMasterArea}
                        aspectRatio={aspectRatios[item.id]}
                        fallbackLabel="La foto no se pudo cargar."
                      />
                    </div>

                    {/* Switch de heredado por foto (REQUISITO 2). */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.useMasterArea}
                          onChange={(event) => toggleInherit(item, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Heredar posición automática (Recomendado)
                      </label>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.useMasterArea ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                        {item.useMasterArea ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
                        {item.useMasterArea ? 'Usa la referencia maestra' : 'Ajuste manual de esta foto'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── 3 · Configuración JSON resultante ─────────────────────────────── */}
        <details className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">3 · Configuración JSON guardada</h2>
              <p className="mt-1 text-xs text-slate-500">Estructura exactamente persistente en `product.reviewGallery` + `product.masterPrintArea`.</p>
            </div>
            <span className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 group-open:hidden">Ver JSON</span>
          </summary>
          <pre className="mt-4 max-h-[420px] overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-100">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      </main>

      {/* Barra fija inferior: atajo de guardado, mismo patrón que el editor. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <p className="text-xs text-slate-500">
            {isDirty
              ? 'Tienes cambios sin guardar en la pestaña Revisar.'
              : 'Todo guardado. La configuración ya vive en el producto (masterPrintArea + reviewGallery).'}
          </p>
          <div className="flex items-center gap-2">
            <Link href={`/editor/${product.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Ver en el editor
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={storageBlocked}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Save className="h-4 w-4" /> Guardar configuración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


