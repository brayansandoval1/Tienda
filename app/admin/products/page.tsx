'use client';

import { FormEvent, type InputHTMLAttributes, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useProductStore, type Product } from '@/src/store/useProductStore';

type ProductForm = {
  name: string;
  price: string;
  category: string;
  mockupUrl: string;
  x: string;
  y: string;
  width: string;
  height: string;
};

const emptyForm: ProductForm = {
  name: '', price: '', category: '', mockupUrl: '', x: '200', y: '200', width: '400', height: '400',
};
const REFERENCE_SIZE = 800;

const toForm = (product: Product): ProductForm => {
  const view = product.views[0];
  const scale = view?.printAreaUnit === 'percent' ? REFERENCE_SIZE / 100 : 1;
  return {
    name: product.name,
    price: String(product.price),
    category: product.category,
    mockupUrl: view?.mockupUrl ?? '',
    x: String((view?.printArea.x ?? 0) * scale),
    y: String((view?.printArea.y ?? 0) * scale),
    width: String((view?.printArea.width ?? 0) * scale),
    height: String((view?.printArea.height ?? 0) * scale),
  };
};

export default function AdminProductsPage() {
  const products = useProductStore((state) => state.products);
  const addProduct = useProductStore((state) => state.addProduct);
  const updateProduct = useProductStore((state) => state.updateProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const area = useMemo(() => ({
    x: Math.max(0, Number(form.x) || 0), y: Math.max(0, Number(form.y) || 0),
    width: Math.max(0, Number(form.width) || 0), height: Math.max(0, Number(form.height) || 0),
  }), [form.x, form.y, form.width, form.height]);

  const setField = (field: keyof ProductForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    const mockupUrl = form.mockupUrl.trim();
    if (!mockupUrl) {
      setImageDimensions(null);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      if (!cancelled) setImageDimensions(null);
    };
    image.src = mockupUrl;
    return () => { cancelled = true; };
  }, [form.mockupUrl]);

  const handleSelect = (product: Product) => {
    setSelectedId(product.id);
    setForm(toForm(product));
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.mockupUrl.trim()) {
      alert('Por favor ingresa la ruta o URL del mockup.');
      return;
    }
    const product: Product = {
      id: selectedId ?? crypto.randomUUID(),
      name: form.name.trim(),
      price: Number(form.price),
      category: form.category.trim(),
      canvasWidth: 800,
      canvasHeight: 800,
      views: [{
        id: 'front',
        label: 'Frente',
        mockupUrl: form.mockupUrl.trim(),
        // El formulario opera sobre una cuadrícula de referencia de 800 px;
        // el producto guarda coordenadas relativas reutilizables para cualquier mockup.
        printArea: {
          x: (area.x * 100) / REFERENCE_SIZE,
          y: (area.y * 100) / REFERENCE_SIZE,
          width: (area.width * 100) / REFERENCE_SIZE,
          height: (area.height * 100) / REFERENCE_SIZE,
        },
        printAreaUnit: 'percent',
      }],
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
            <p className="mt-2 text-slate-600">Configura el mockup y su zona segura de impresión.</p>
          </div>
          {selectedId && <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Nuevo producto</button>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow">
            <div className="space-y-4">
              <Field label="Nombre del producto" value={form.name} onChange={(value) => setField('name', value)} required className="sm:col-span-2" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Precio" type="number" min="0" step="0.01" value={form.price} onChange={(value) => setField('price', value)} required />
                <Field label="Categoría" value={form.category} onChange={(value) => setField('category', value)} required />
              </div>
              <Field label="Vista 1 (Frente): URL o ruta del mockup" type="text" value={form.mockupUrl || ''} onChange={(value) => setField('mockupUrl', value)} placeholder="/mockups/funda-iphone14.png" required className="sm:col-span-2" />
              {imageDimensions && <p className="text-xs text-slate-500">Dimensiones originales detectadas: {imageDimensions.width} × {imageDimensions.height} px</p>}
            </div>
            <fieldset className="mt-6 rounded-lg border border-slate-200 p-4">
              <legend className="px-2 text-sm font-semibold text-slate-700">Zona segura de impresión (px sobre un canvas de 800 × 800)</legend>
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="X" type="number" min="0" value={form.x} onChange={(value) => setField('x', value)} required />
                <Field label="Y" type="number" min="0" value={form.y} onChange={(value) => setField('y', value)} required />
                <Field label="Ancho" type="number" min="1" value={form.width} onChange={(value) => setField('width', value)} required />
                <Field label="Alto" type="number" min="1" value={form.height} onChange={(value) => setField('height', value)} required />
              </div>
            </fieldset>
            <button type="submit" className="mt-6 inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"><Plus size={18} />Guardar producto</button>
          </form>

          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-slate-900">Vista previa</h2>
            <div className="relative mt-4 aspect-square overflow-hidden rounded-md bg-slate-100">
              {form.mockupUrl ? <img src={form.mockupUrl} alt="Vista previa del mockup" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">Añade la URL del mockup para visualizarlo.</div>}
              <div className="pointer-events-none absolute border-2 border-dashed border-emerald-500 bg-emerald-400/10" style={{ left: `${area.x / 8}%`, top: `${area.y / 8}%`, width: `${area.width / 8}%`, height: `${area.height / 8}%` }} />
            </div>
          </section>
        </div>

        <section className="mt-8 overflow-hidden rounded-lg bg-white shadow">
          <div className="border-b border-slate-200 p-6"><h2 className="text-xl font-semibold text-slate-900">Productos creados</h2></div>
          {products.length === 0 ? <p className="p-6 text-slate-500">Aún no hay productos.</p> : <div className="divide-y divide-slate-100">{products.map((product) => (
            <div key={product.id} className={`flex items-center gap-4 p-4 ${selectedId === product.id ? 'bg-emerald-50/60' : ''}`}>
              <img src={product.views[0]?.mockupUrl} alt="" className="h-14 w-14 rounded-xl bg-slate-100 object-cover" />
              <button type="button" onClick={() => handleSelect(product)} className="min-w-0 flex-1 text-left"><p className="truncate font-semibold text-slate-900">{product.name}</p><p className="text-sm text-slate-500">{product.category} · ${product.price.toFixed(2)}</p></button>
              <button type="button" onClick={() => handleSelect(product)} aria-label={`Editar ${product.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={18} /></button>
              <button type="button" onClick={() => { removeProduct(product.id); if (selectedId === product.id) resetForm(); }} aria-label={`Eliminar ${product.name}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={18} /></button>
            </div>
          ))}</div>}
        </section>
      </div>
    </main>
  );
}

function Field({ label, className = '', onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}><span>{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white p-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>;
}
