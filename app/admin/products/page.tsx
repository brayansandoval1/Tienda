'use client';

import { FormEvent, type InputHTMLAttributes, type PointerEvent, useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useProductStore, type Product } from '@/src/store/useProductStore';
import type { ProductOption } from '@/src/store/useProductStore';
import AdminProductOptionsForm from '@/components/admin/AdminProductOptionsForm';

type ProductViewForm = {
  id: string;
  name: string;
  mockupUrl: string;
  x: string; y: string; width: string; height: string;
};

type ProductForm = {
  name: string;
  price: string;
  category: string;
  printWidthCm: string;
  printHeightCm: string;
  options: ProductOption[];
  views: ProductViewForm[];
};

const REFERENCE_WIDTH = 800;
const REFERENCE_HEIGHT = 800;
const normalizePercentage = (value: number | undefined | null, fallback = 0) => {
  if (value === undefined || value === null || !Number.isFinite(value)) return fallback;
  return value > 0 && value <= 1 ? value * 100 : value;
};
const cleanPercentage = (value: number) => Number(Math.min(100, Math.max(0, value)).toFixed(2));

const createViewForm = (index: number): ProductViewForm => ({
  id: index === 0 ? 'front' : `view-${crypto.randomUUID()}`,
  name: index === 0 ? 'Frente' : 'Espalda',
  mockupUrl: '',
  x: '25', y: '25', width: '50', height: '50',
});

const emptyForm = (): ProductForm => ({
  name: '',
  price: '',
  category: '',
  printWidthCm: '',
  printHeightCm: '',
  options: [],
  views: [createViewForm(0)],
});

const toForm = (product: Product): ProductForm => ({
  name: product.name,
  price: String(product.price),
  category: product.category,
  printWidthCm: product.printWidthCm ? String(product.printWidthCm) : '',
  printHeightCm: product.printHeightCm ? String(product.printHeightCm) : '',
  options: product.options?.map((option) => ({ ...option, displayType: option.displayType ?? option.type, values: option.values.map((value) => ({ ...value })) })) ?? [],
  views: product.views.map((view, index) => {
    const isPercent = view.printAreaUnit === 'percent';
    const safeZone = {
      x: normalizePercentage(isPercent ? view.printArea.x : (view.printArea.x * 100) / REFERENCE_WIDTH, 25),
      y: normalizePercentage(isPercent ? view.printArea.y : (view.printArea.y * 100) / REFERENCE_HEIGHT, 25),
      width: normalizePercentage(isPercent ? view.printArea.width : (view.printArea.width * 100) / REFERENCE_WIDTH, 50),
      height: normalizePercentage(isPercent ? view.printArea.height : (view.printArea.height * 100) / REFERENCE_HEIGHT, 50),
    };
    return {
      id: view.id,
      name: view.name || view.label || `Vista ${index + 1}`,
      mockupUrl: view.mockupUrl,
      x: String(cleanPercentage(safeZone.x)),
      y: String(cleanPercentage(safeZone.y)),
      width: String(cleanPercentage(safeZone.width)),
      height: String(cleanPercentage(safeZone.height)),
    };
  }),
});

export default function AdminProductsPage() {
  const products = useProductStore((state) => state.products);
  const addProduct = useProductStore((state) => state.addProduct);
  const updateProduct = useProductStore((state) => state.updateProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const setField = (field: Exclude<keyof ProductForm, 'views'>, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const setViewField = (index: number, field: keyof ProductViewForm, value: string) =>
    setForm((current) => ({
      ...current,
      views: current.views.map((view, viewIndex) =>
        viewIndex === index ? { ...view, [field]: value } : view,
      ),
    }));
  const addView = () => setForm((current) => ({ ...current, views: [...current.views, createViewForm(current.views.length)] }));
  const removeView = (index: number) => setForm((current) => ({
    ...current,
    views: current.views.filter((_, viewIndex) => viewIndex !== index),
  }));
  const setViewPrintArea = (index: number, area: { x: number; y: number; width: number; height: number }) =>
    setForm((current) => ({ ...current, views: current.views.map((view, viewIndex) => viewIndex === index ? {
      ...view, x: String(area.x), y: String(area.y), width: String(area.width), height: String(area.height),
    } : view) }));

  const handleSelect = (product: Product) => {
    setSelectedId(product.id);
    setForm(toForm(product));
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm());
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.views.some((view) => !view.mockupUrl.trim())) {
      alert('Agrega la ruta o URL del mockup para cada vista.');
      return;
    }

    const product: Product = {
      id: selectedId ?? crypto.randomUUID(),
      name: form.name.trim(),
      price: Number(form.price),
      category: form.category.trim(),
      canvasWidth: REFERENCE_WIDTH,
      canvasHeight: REFERENCE_HEIGHT,
      printWidthCm: Number(form.printWidthCm) || undefined,
      printHeightCm: Number(form.printHeightCm) || undefined,
      options: form.options.map((option) => ({
        ...option,
        name: option.name.trim() || 'Opción',
        displayType: option.displayType ?? option.type,
        values: option.values.map((value) => ({ ...value, label: value.label.trim() || 'Variante', thumbnailUrl: value.thumbnailUrl?.trim() || undefined, mockupUrl: value.mockupUrl?.trim() || undefined })),
      })),
      views: form.views.map((view) => {
        const area = {
          x: Math.max(0, Number(view.x) || 0),
          y: Math.max(0, Number(view.y) || 0),
          width: Math.max(0, Number(view.width) || 0),
          height: Math.max(0, Number(view.height) || 0),
        };
        const name = view.name.trim() || 'Vista';
        return {
          id: view.id,
          name,
          // `label` mantiene compatibilidad con productos ya guardados.
          label: name,
          mockupUrl: view.mockupUrl.trim(),
          printArea: {
            x: cleanPercentage(area.x),
            y: cleanPercentage(area.y),
            width: cleanPercentage(area.width),
            height: cleanPercentage(area.height),
          },
          printAreaUnit: 'percent' as const,
        };
      }),
    };
    if (selectedId) updateProduct(product);
    else addProduct(product);
    resetForm();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Administración</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Productos personalizables</h1>
            <p className="mt-2 text-slate-600">Configura cada mockup y su zona segura de impresión.</p>
          </div>
          {selectedId && <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Nuevo producto</button>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form onSubmit={handleSubmit} className="max-w-full overflow-hidden rounded-lg bg-white p-6 shadow">
            <div className="space-y-4">
              <Field label="Nombre del producto" value={form.name} onChange={(value) => setField('name', value)} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Precio" type="number" min="0" step="0.01" value={form.price} onChange={(value) => setField('price', value)} required />
                <Field label="Categoría" value={form.category} onChange={(value) => setField('category', value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ancho físico de impresión (cm)" type="number" min="0.1" step="0.1" value={form.printWidthCm} onChange={(value) => setField('printWidthCm', value)} placeholder="20" />
                <Field label="Alto físico de impresión (cm)" type="number" min="0.1" step="0.1" value={form.printHeightCm} onChange={(value) => setField('printHeightCm', value)} placeholder="9" />
              </div>
              <p className="text-xs text-slate-500">Estas medidas se almacenan para calcular el archivo final a 300 DPI.</p>
            </div>

            <div className="mt-6 space-y-5">
              {form.views.map((view, index) => (
                <ViewFields key={view.id} view={view} index={index} canRemove={form.views.length > 1} onChange={setViewField} onAreaChange={setViewPrintArea} onRemove={removeView} />
              ))}
            </div>
            <button type="button" onClick={addView} className="mt-5 inline-flex items-center gap-2 rounded-md border border-emerald-600 px-4 py-2 font-semibold text-emerald-700 transition hover:bg-emerald-50">
              <Plus size={18} /> Agregar otra vista (ej. Espalda)
            </button>
            <AdminProductOptionsForm options={form.options} onChange={(options) => setForm((current) => ({ ...current, options }))} />
            <button type="submit" className="ml-3 mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"><Plus size={18} />Guardar producto</button>
          </form>

          <section className="rounded-lg bg-white p-6 shadow"><h2 className="text-lg font-semibold text-slate-900">Configuración visual</h2><p className="mt-1 text-sm text-slate-500">Arrastra y redimensiona cada zona verde directamente sobre su mockup.</p></section>
        </div>

        <section className="mt-8 overflow-hidden rounded-lg bg-white shadow">
          <div className="border-b border-slate-200 p-6"><h2 className="text-xl font-semibold text-slate-900">Productos creados</h2></div>
          {products.length === 0 ? <p className="p-6 text-slate-500">Aún no hay productos.</p> : <div className="divide-y divide-slate-100">{products.map((product) => (
            <div key={product.id} className={`flex items-center gap-4 p-4 ${selectedId === product.id ? 'bg-emerald-50/60' : ''}`}>
              <img src={product.views[0]?.mockupUrl} alt="" className="h-14 w-14 rounded-xl bg-slate-100 object-cover" />
              <button type="button" onClick={() => handleSelect(product)} className="min-w-0 flex-1 text-left"><p className="truncate font-semibold text-slate-900">{product.name}</p><p className="text-sm text-slate-500">{product.category} · ${product.price.toFixed(2)} · {product.views.length} {product.views.length === 1 ? 'vista' : 'vistas'}</p></button>
              <button type="button" onClick={() => handleSelect(product)} aria-label={`Editar ${product.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={18} /></button>
              <button type="button" onClick={() => { removeProduct(product.id); if (selectedId === product.id) resetForm(); }} aria-label={`Eliminar ${product.name}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={18} /></button>
            </div>
          ))}</div>}
        </section>
      </div>
    </main>
  );
}

function ViewFields({ view, index, canRemove, onChange, onAreaChange, onRemove }: { view: ProductViewForm; index: number; canRemove: boolean; onChange: (index: number, field: keyof ProductViewForm, value: string) => void; onAreaChange: (index: number, area: PrintArea) => void; onRemove: (index: number) => void }) {
  const area = normalizeArea({ x: Number(view.x), y: Number(view.y), width: Number(view.width), height: Number(view.height) });
  return <fieldset className="rounded-lg border border-slate-200 p-4"><legend className="px-2 text-sm font-semibold text-slate-700">Vista {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre de la vista" value={view.name} onChange={(value) => onChange(index, 'name', value)} required /><Field label="URL o ruta del mockup" value={view.mockupUrl} onChange={(value) => onChange(index, 'mockupUrl', value)} placeholder="/mockups/playera-espalda.png" required /></div><div className="mt-4"><PrintAreaSelector mockupUrl={view.mockupUrl} printArea={area} onChange={(nextArea) => onAreaChange(index, nextArea)} /></div>{canRemove && <button type="button" onClick={() => onRemove(index)} className="mt-3 text-sm font-medium text-red-600 hover:text-red-700">Eliminar esta vista</button>}</fieldset>;
}

type PrintArea = { x: number; y: number; width: number; height: number };
const roundPercent = (value: number) => Math.round(value * 10) / 10;
const normalizeArea = (area: PrintArea): PrintArea => {
  const width = Math.min(100, Math.max(1, Number.isFinite(area.width) ? area.width : 50));
  const height = Math.min(100, Math.max(1, Number.isFinite(area.height) ? area.height : 50));
  return { x: Math.min(100 - width, Math.max(0, Number.isFinite(area.x) ? area.x : 25)), y: Math.min(100 - height, Math.max(0, Number.isFinite(area.y) ? area.y : 25)), width, height };
};

function PrintAreaSelector({ mockupUrl, printArea, onChange }: { mockupUrl: string; printArea: PrintArea; onChange: (newArea: PrintArea) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; area: PrintArea } | null>(null);
  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const rect = container.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    const next = drag.mode === 'move'
      ? normalizeArea({ ...drag.area, x: drag.area.x + dx, y: drag.area.y + dy })
      : normalizeArea({ ...drag.area, width: drag.area.width + dx, height: drag.area.height + dy });
    onChange({ ...next, x: roundPercent(next.x), y: roundPercent(next.y), width: roundPercent(next.width), height: roundPercent(next.height) });
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>, mode: 'move' | 'resize') => {
    event.preventDefault(); event.stopPropagation();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, area: printArea };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const stopDrag = () => { dragRef.current = null; };
  return <div className="space-y-3"><p className="text-sm font-medium text-slate-600">🎯 Arrastra la zona verde y usa el tirador inferior derecho para redimensionarla.</p><div ref={containerRef} onPointerMove={updateFromPointer} onPointerUp={stopDrag} onPointerCancel={stopDrag} className="relative overflow-hidden rounded-lg border bg-slate-100 touch-none select-none">{mockupUrl ? <img src={mockupUrl} alt="Vista previa del mockup" className="block max-h-[360px] w-full object-contain pointer-events-none" /> : <div className="flex aspect-square items-center justify-center p-8 text-center text-sm text-slate-400">Añade la URL del mockup para ajustar la zona.</div>}{mockupUrl && <div onPointerDown={(event) => startDrag(event, 'move')} style={{ left: `${printArea.x}%`, top: `${printArea.y}%`, width: `${printArea.width}%`, height: `${printArea.height}%` }} className="absolute cursor-move border-2 border-dashed border-emerald-500 bg-emerald-500/20"><span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 font-mono text-xs text-white shadow">{printArea.width}% × {printArea.height}%</span><div onPointerDown={(event) => startDrag(event, 'resize')} className="absolute bottom-[-7px] right-[-7px] h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-emerald-600 shadow" /></div>}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['x', 'y', 'width', 'height'] as const).map((field) => <Field key={field} label={`${field === 'x' ? 'Posición X' : field === 'y' ? 'Posición Y' : field === 'width' ? 'Ancho' : 'Alto'} (%)`} type="number" min="0" max="100" step="0.01" value={String(printArea[field])} onChange={(value) => onChange(normalizeArea({ ...printArea, [field]: cleanPercentage(normalizePercentage(Number(value))) }))} />)}</div></div>;
}

function Field({ label, className = '', onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}><span>{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white p-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>;
}
