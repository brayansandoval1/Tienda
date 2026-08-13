'use client';

import { FormEvent, type InputHTMLAttributes, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useProductStore, type Product } from '@/src/store/useProductStore';

type ProductViewForm = {
  id: string;
  name: string;
  mockupUrl: string;
  x: string;
  y: string;
  width: string;
  height: string;
};

type ProductForm = {
  name: string;
  price: string;
  category: string;
  views: ProductViewForm[];
};

const REFERENCE_WIDTH = 800;
const REFERENCE_HEIGHT = 800;

const createViewForm = (index: number): ProductViewForm => ({
  id: index === 0 ? 'front' : `view-${crypto.randomUUID()}`,
  name: index === 0 ? 'Frente' : 'Espalda',
  mockupUrl: '',
  x: '200',
  y: '200',
  width: '400',
  height: '400',
});

const emptyForm = (): ProductForm => ({
  name: '',
  price: '',
  category: '',
  views: [createViewForm(0)],
});

const referencePixelsToPercent = (value: number, referenceDimension: number) =>
  (value * 100) / referenceDimension;

const toForm = (product: Product): ProductForm => ({
  name: product.name,
  price: String(product.price),
  category: product.category,
  views: product.views.map((view, index) => {
    const xScale = view.printAreaUnit === 'percent' ? REFERENCE_WIDTH / 100 : 1;
    const yScale = view.printAreaUnit === 'percent' ? REFERENCE_HEIGHT / 100 : 1;
    return {
      id: view.id,
      name: view.name || view.label || `Vista ${index + 1}`,
      mockupUrl: view.mockupUrl,
      x: String(view.printArea.x * xScale),
      y: String(view.printArea.y * yScale),
      width: String(view.printArea.width * xScale),
      height: String(view.printArea.height * yScale),
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
            x: referencePixelsToPercent(area.x, REFERENCE_WIDTH),
            y: referencePixelsToPercent(area.y, REFERENCE_HEIGHT),
            width: referencePixelsToPercent(area.width, REFERENCE_WIDTH),
            height: referencePixelsToPercent(area.height, REFERENCE_HEIGHT),
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
          <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow">
            <div className="space-y-4">
              <Field label="Nombre del producto" value={form.name} onChange={(value) => setField('name', value)} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Precio" type="number" min="0" step="0.01" value={form.price} onChange={(value) => setField('price', value)} required />
                <Field label="Categoría" value={form.category} onChange={(value) => setField('category', value)} required />
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {form.views.map((view, index) => (
                <ViewFields key={view.id} view={view} index={index} canRemove={form.views.length > 1} onChange={setViewField} onRemove={removeView} />
              ))}
            </div>
            <button type="button" onClick={addView} className="mt-5 inline-flex items-center gap-2 rounded-md border border-emerald-600 px-4 py-2 font-semibold text-emerald-700 transition hover:bg-emerald-50">
              <Plus size={18} /> Agregar otra vista (ej. Espalda)
            </button>
            <button type="submit" className="ml-3 mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"><Plus size={18} />Guardar producto</button>
          </form>

          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Vistas previas</h2>
            <div className="mt-4 space-y-4">
              {form.views.map((view) => <ViewPreview key={view.id} view={view} />)}
            </div>
          </section>
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

function ViewFields({ view, index, canRemove, onChange, onRemove }: { view: ProductViewForm; index: number; canRemove: boolean; onChange: (index: number, field: keyof ProductViewForm, value: string) => void; onRemove: (index: number) => void }) {
  return <fieldset className="rounded-lg border border-slate-200 p-4"><legend className="px-2 text-sm font-semibold text-slate-700">Vista {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre de la vista" value={view.name} onChange={(value) => onChange(index, 'name', value)} required /><Field label="URL o ruta del mockup" value={view.mockupUrl} onChange={(value) => onChange(index, 'mockupUrl', value)} placeholder="/mockups/playera-espalda.png" required /></div><div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><Field label="X" type="number" min="0" value={view.x} onChange={(value) => onChange(index, 'x', value)} required /><Field label="Y" type="number" min="0" value={view.y} onChange={(value) => onChange(index, 'y', value)} required /><Field label="Ancho" type="number" min="1" value={view.width} onChange={(value) => onChange(index, 'width', value)} required /><Field label="Alto" type="number" min="1" value={view.height} onChange={(value) => onChange(index, 'height', value)} required /></div><p className="mt-3 text-xs text-slate-500">Zona segura en px sobre una cuadrícula de {REFERENCE_WIDTH} × {REFERENCE_HEIGHT}; se guarda como porcentaje.</p>{canRemove && <button type="button" onClick={() => onRemove(index)} className="mt-3 text-sm font-medium text-red-600 hover:text-red-700">Eliminar esta vista</button>}</fieldset>;
}

function ViewPreview({ view }: { view: ProductViewForm }) {
  const area = useMemo(() => ({ x: Math.max(0, Number(view.x) || 0), y: Math.max(0, Number(view.y) || 0), width: Math.max(0, Number(view.width) || 0), height: Math.max(0, Number(view.height) || 0) }), [view]);
  return <div><p className="mb-2 text-sm font-medium text-slate-700">{view.name || 'Vista'}</p><div className="relative aspect-square overflow-hidden rounded-md bg-slate-100">{view.mockupUrl ? <img src={view.mockupUrl} alt={`Vista previa ${view.name}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">Añade la URL del mockup.</div>}<div className="pointer-events-none absolute border-2 border-dashed border-emerald-500 bg-emerald-400/10" style={{ left: `${referencePixelsToPercent(area.x, REFERENCE_WIDTH)}%`, top: `${referencePixelsToPercent(area.y, REFERENCE_HEIGHT)}%`, width: `${referencePixelsToPercent(area.width, REFERENCE_WIDTH)}%`, height: `${referencePixelsToPercent(area.height, REFERENCE_HEIGHT)}%` }} /></div></div>;
}

function Field({ label, className = '', onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}><span>{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white p-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>;
}
