'use client';

import { FormEvent, type InputHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Eye, Info, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useProductStore, type Product, type ProductOption } from '@/src/store/useProductStore';
import { compressImageFileToDataUrl } from '@/src/utils/imageCompression';
import AdminProductOptionsForm from '@/components/admin/AdminProductOptionsForm';
import MockupAreaPicker, { normalizePrintArea, type PrintArea } from '@/components/admin/MockupAreaPicker';

type ProductViewForm = { id: string; name: string; mockupUrl: string; x: string; y: string; width: string; height: string };
type ProductForm = { name: string; price: string; category: string; printWidthCm: string; printHeightCm: string; options: ProductOption[]; views: ProductViewForm[] };

const REFERENCE_WIDTH = 800;
const REFERENCE_HEIGHT = 800;
const normalizePercentage = (value: number | undefined | null, fallback = 0) => !Number.isFinite(value) ? fallback : value && value > 0 && value <= 1 ? value * 100 : value ?? fallback;
const cleanPercentage = (value: number) => Number(Math.min(100, Math.max(0, value)).toFixed(2));
const createViewForm = (index: number): ProductViewForm => ({ id: index === 0 ? 'front' : `view-${crypto.randomUUID()}`, name: index === 0 ? 'Frente' : 'Espalda', mockupUrl: '', x: '25', y: '25', width: '50', height: '50' });
const emptyForm = (): ProductForm => ({ name: '', price: '', category: '', printWidthCm: '', printHeightCm: '', options: [], views: [createViewForm(0)] });

const normalizeViewIds = (views: ProductViewForm[]): ProductViewForm[] => {
  const usedIds = new Set<string>();
  return views.map((view, index) => {
    const originalId = view.id.trim();
    let id = originalId || (index === 0 ? 'front' : `view-${crypto.randomUUID()}`);
    if (usedIds.has(id)) id = `view-${crypto.randomUUID()}`;
    usedIds.add(id);
    return { ...view, id };
  });
};

const toForm = (product: Product): ProductForm => ({
  name: product.name,
  price: String(product.price),
  category: product.category,
  printWidthCm: product.printWidthCm ? String(product.printWidthCm) : '',
  printHeightCm: product.printHeightCm ? String(product.printHeightCm) : '',
  options: product.options?.map((option) => ({ ...option, displayType: option.displayType ?? option.type, values: option.values.map((value) => ({ ...value })) })) ?? [],
  views: normalizeViewIds(product.views.map((view, index) => {
    const percent = view.printAreaUnit === 'percent';
    return {
      id: view.id, name: view.name || view.label || `Vista ${index + 1}`, mockupUrl: view.mockupUrl,
      x: String(cleanPercentage(normalizePercentage(percent ? view.printArea.x : (view.printArea.x * 100) / REFERENCE_WIDTH, 25))),
      y: String(cleanPercentage(normalizePercentage(percent ? view.printArea.y : (view.printArea.y * 100) / REFERENCE_HEIGHT, 25))),
      width: String(cleanPercentage(normalizePercentage(percent ? view.printArea.width : (view.printArea.width * 100) / REFERENCE_WIDTH, 50))),
      height: String(cleanPercentage(normalizePercentage(percent ? view.printArea.height : (view.printArea.height * 100) / REFERENCE_HEIGHT, 50))),
    };
  })),
});

export default function AdminProductEditor() {
  const products = useProductStore((state) => state.products);
  const addProduct = useProductStore((state) => state.addProduct);
  const updateProduct = useProductStore((state) => state.updateProduct);
  const removeProduct = useProductStore((state) => state.removeProduct);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeView = form.views[Math.min(activeTab, form.views.length - 1)];
  const activeIndex = Math.min(activeTab, form.views.length - 1);
  const printWidth = Number(form.printWidthCm) || 0;
  const printHeight = Number(form.printHeightCm) || 0;
  const pixelsWidth = Math.round((printWidth / 2.54) * 300);
  const pixelsHeight = Math.round((printHeight / 2.54) * 300);
  const baseViews = useMemo(() => form.views.map((view) => ({ id: view.id, name: view.name || 'Vista', mockupUrl: view.mockupUrl, printArea: normalizePrintArea({ x: Number(view.x), y: Number(view.y), width: Number(view.width), height: Number(view.height) }) })), [form.views]);

  useEffect(() => { if (activeTab >= form.views.length) setActiveTab(Math.max(0, form.views.length - 1)); }, [activeTab, form.views.length]);
  const setField = (field: Exclude<keyof ProductForm, 'views'>, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const setViewField = (index: number, field: keyof ProductViewForm, value: string) => setForm((current) => ({ ...current, views: current.views.map((view, viewIndex) => viewIndex === index ? { ...view, [field]: value } : view) }));
  const setViewPrintArea = (index: number, area: PrintArea) => setForm((current) => ({ ...current, views: current.views.map((view, viewIndex) => viewIndex === index ? { ...view, x: String(area.x), y: String(area.y), width: String(area.width), height: String(area.height) } : view) }));
  const handleAddView = () => setForm((current) => { const next = [...current.views, createViewForm(current.views.length)]; setActiveTab(next.length - 1); return { ...current, views: next }; });
  const removeView = (index: number) => setForm((current) => ({ ...current, views: current.views.filter((_, viewIndex) => viewIndex !== index) }));
  const resetForm = () => { setSelectedId(null); setForm(emptyForm()); setActiveTab(0); };
  const handleSelect = (product: Product) => { setSelectedId(product.id); setForm(toForm(product)); setActiveTab(0); };
  const handleDeleteProduct = (productId: string) => {
    removeProduct(productId);
    if (selectedId === productId) resetForm();
  };
  const handleMockupFile = (file?: File) => {
    if (!file || !activeView || !file.type.startsWith('image/')) return;
    // Se comprime antes de guardar: los mockups en Base64 sin comprimir
    // agotan la cuota de localStorage y rompen la persistencia.
    compressImageFileToDataUrl(file)
      .then((dataUrl) => setViewField(activeIndex, 'mockupUrl', dataUrl))
      .catch((error) => console.error('❌ [ADMIN] Error al procesar el mockup:', error));
  };
  const handleReplaceMockup = () => fileInputRef.current?.click();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.views.some((view) => !view.mockupUrl.trim())) { alert('Agrega un mockup para cada vista.'); return; }
    const options = form.options.map((option) => ({ ...option, name: option.name.trim() || 'Opción', displayType: option.displayType ?? option.type, values: option.values.map((value, valueIndex) => ({ ...value, label: value.label.trim() || 'Variante', thumbnailUrl: value.thumbnailUrl?.trim() || undefined, mockupUrl: undefined, printArea: null, views: form.views.map((baseView) => { const configured = value.views?.find((view) => view.viewId === baseView.id); const baseArea = normalizePrintArea({ x: Number(baseView.x), y: Number(baseView.y), width: Number(baseView.width), height: Number(baseView.height) }); return { viewId: baseView.id, name: baseView.name.trim() || 'Vista', mockupUrl: configured?.mockupUrl?.trim() || null, printArea: configured?.printArea ? normalizePrintArea(configured.printArea) : valueIndex === 0 ? baseArea : null }; }) })) }));
    const product: Product = { id: selectedId ?? crypto.randomUUID(), name: form.name.trim(), price: Number(form.price), category: form.category.trim(), canvasWidth: REFERENCE_WIDTH, canvasHeight: REFERENCE_HEIGHT, printWidthCm: printWidth || undefined, printHeightCm: printHeight || undefined, options, views: form.views.map((view) => { const name = view.name.trim() || 'Vista'; return { id: view.id, name, label: name, mockupUrl: view.mockupUrl.trim(), printArea: { x: cleanPercentage(Number(view.x) || 0), y: cleanPercentage(Number(view.y) || 0), width: cleanPercentage(Number(view.width) || 0), height: cleanPercentage(Number(view.height) || 0) }, printAreaUnit: 'percent' as const }; }) };
    selectedId ? updateProduct(product) : addProduct(product);
    resetForm();
  };

  const activeArea = activeView ? normalizePrintArea({ x: Number(activeView.x), y: Number(activeView.y), width: Number(activeView.width), height: Number(activeView.height) }) : null;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-600">Administración</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Productos personalizables</h1><p className="mt-2 text-slate-600">Configura mockups, variantes y zonas seguras de impresión.</p></div>
        {selectedId && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">Nuevo producto</button>}
      </header>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Datos básicos</h2><p className="mt-1 text-sm text-slate-500">Información que verán tus clientes al elegir el producto.</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field className="sm:col-span-2" label="Nombre del producto" value={form.name} onChange={(value) => setField('name', value)} required /><Field label="Precio" type="number" min="0" step="0.01" value={form.price} onChange={(value) => setField('price', value)} required /><Field label="Categoría" value={form.category} onChange={(value) => setField('category', value)} required /><Field label="Ancho físico de impresión (cm)" type="number" min="0.1" step="0.1" value={form.printWidthCm} onChange={(value) => setField('printWidthCm', value)} placeholder="20" /><Field label="Alto físico de impresión (cm)" type="number" min="0.1" step="0.1" value={form.printHeightCm} onChange={(value) => setField('printHeightCm', value)} placeholder="9" /></div>
            <div className="mt-4 flex gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-800"><Info className="mt-0.5 shrink-0" size={15} /><span>Salida estimada a 300 DPI: <strong>{printWidth && printHeight ? `${pixelsWidth.toLocaleString()} × ${pixelsHeight.toLocaleString()} px` : 'indica ancho y alto'}</strong>.</span></div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-semibold text-slate-900">Vistas del producto</h2><p className="mt-1 text-sm text-slate-500">Carga un mockup y define una zona segura para cada cara.</p></div>
            <div className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-2">{form.views.map((view, index) => <button key={view.id} type="button" onClick={() => { setActiveTab(index); console.log('🔍 [EDITOR - VISTA ACTIVA]:', { id: view.id, name: view.name }); }} className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeIndex === index ? 'border-emerald-600 font-semibold text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{view.name || `Vista ${index + 1}`}</button>)}<button type="button" onClick={handleAddView} className="flex items-center gap-1 px-2 text-xs font-medium text-emerald-600 hover:underline"><Plus size={14} /> Agregar vista</button></div></div>
            {activeView && <div className="space-y-5"><Field label="Nombre de la vista" value={activeView.name} onChange={(value) => setViewField(activeIndex, 'name', value)} required />
              <div><span className="mb-1.5 block text-sm font-medium text-slate-700">Mockup de la vista</span><input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { handleMockupFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                {activeView.mockupUrl ? <div className="group relative overflow-hidden rounded-lg border border-slate-200"><img src={activeView.mockupUrl} alt="Mockup" className="h-32 w-full bg-slate-50 object-contain" /><div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 opacity-0 transition-opacity group-hover:opacity-100"><button type="button" onClick={handleReplaceMockup} className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow">Cambiar imagen</button></div></div> : <button type="button" onClick={handleReplaceMockup} className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40"><span className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm"><Camera size={23} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-700">Subir mockup</span><span className="mt-1 block text-xs text-slate-500">PNG, JPG o WebP · se mostrará en la vista previa</span></span><Upload size={18} className="text-emerald-600" /></button>}</div>
              <Field label="O pega una URL o ruta del mockup" value={activeView.mockupUrl.startsWith('data:') ? '' : activeView.mockupUrl} onChange={(value) => setViewField(activeIndex, 'mockupUrl', value)} placeholder="/mockups/playera-frente.png" />
              {form.views.length > 1 && <button type="button" onClick={() => removeView(activeIndex)} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"><Trash2 size={16} /> Eliminar esta vista</button>}</div>}
          </section>
          <AdminProductOptionsForm options={form.options} baseViews={baseViews} onChange={(options) => setForm((current) => ({ ...current, options }))} />
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white px-6 pt-1 shadow-sm"><div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md"><span className="text-xs text-slate-500">Última modificación realizada recientemente</span><div className="flex gap-3"><button type="button" onClick={resetForm} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button><button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700">Guardar producto</button></div></div></section>
        </div>
        <aside className="lg:col-span-5"><section className="sticky top-6 h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Eye size={17} className="text-emerald-600" />Configuración visual</div><p className="mt-1 text-xs text-slate-500">{activeView?.name || 'Vista activa'}</p></div><span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">300 DPI | {printWidth || '—'} × {printHeight || '—'} cm</span></div>
          <div className="rounded-xl border border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-3">{activeView && activeArea ? <MockupAreaPicker mockupUrl={activeView.mockupUrl} initialPrintArea={activeArea} onChange={(area) => setViewPrintArea(activeIndex, area)} /> : null}</div>
          {activeArea && <p className="mt-4 text-center text-xs text-slate-500">Zona segura: <span className="font-semibold text-slate-700">{activeArea.width}% × {activeArea.height}%</span> del mockup.</p>}
        </section></aside>
      </form>
      <section className="mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-5"><h2 className="text-lg font-semibold text-slate-900">Productos creados</h2></div>{products.length === 0 ? <p className="p-6 text-sm text-slate-500">Aún no hay productos.</p> : <div className="divide-y divide-slate-100">{products.map((product) => <div key={product.id} className={`flex items-center gap-4 p-4 ${selectedId === product.id ? 'bg-emerald-50/60' : ''}`}><img src={product.views[0]?.mockupUrl} alt="" className="h-14 w-14 rounded-xl bg-slate-100 object-contain" /><button type="button" onClick={() => handleSelect(product)} className="min-w-0 flex-1 text-left"><p className="truncate font-semibold text-slate-900">{product.name}</p><p className="text-sm text-slate-500">{product.category} · ${product.price.toFixed(2)} · {product.views.length} {product.views.length === 1 ? 'vista' : 'vistas'}</p></button><button type="button" onClick={() => handleSelect(product)} aria-label={`Editar ${product.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={18} /></button><button type="button" onClick={() => handleDeleteProduct(product.id)} aria-label={`Eliminar ${product.name}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={18} /></button></div>)}</div>}</section>
    </div>
  </main>;
}

function Field({ label, className = '', onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}><span>{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>;
}
