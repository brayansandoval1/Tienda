'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Addon, AddonAppliesTo, AddonCategory, AddonInput } from '@/types/addon';
import type { Product } from '@/src/store/useProductStore';

const categories: { value: AddonCategory; label: string }[] = [
  { value: 'finishes', label: 'Acabado físico' }, { value: 'packaging', label: 'Empaque de regalo' },
  { value: 'certifications', label: 'Certificación' }, { value: 'accessories', label: 'Accesorios' },
];
const applicationScopes: { value: AddonAppliesTo; label: string }[] = [
  { value: 'product', label: 'Producto completo' },
  { value: 'side', label: 'Por cara de impresión' },
  { value: 'canvas', label: 'Área de diseño / canvas' },
];
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export default function AddonFormModal({ addon, products, onClose, onSave }: {
  addon: Addon | null; products: Product[]; onClose: () => void; onSave: (input: AddonInput) => Promise<void>;
}) {
  const [name, setName] = useState(''); const [badge, setBadge] = useState('');
  const [category, setCategory] = useState<AddonCategory>('finishes'); const [price, setPrice] = useState('');
  const [appliesTo, setAppliesTo] = useState<AddonAppliesTo>('product');
  const [perSide, setPerSide] = useState(false);
  const [description, setDescription] = useState(''); const [requiresInput, setRequiresInput] = useState(false);
  const [label, setLabel] = useState(''); const [placeholder, setPlaceholder] = useState('');
  const [maxLength, setMaxLength] = useState('30'); const [applicableProducts, setApplicableProducts] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!addon) return;
    setName(addon.name); setBadge(addon.badge ?? ''); setCategory(addon.category); setPrice(String(addon.price)); setAppliesTo(addon.appliesTo ?? 'product'); setPerSide(Boolean(addon.perSide));
    setDescription(addon.description); setRequiresInput(addon.requiresInput); setLabel(addon.inputConfig?.label ?? '');
    setPlaceholder(addon.inputConfig?.placeholder ?? ''); setMaxLength(String(addon.inputConfig?.maxLength ?? 30));
    setApplicableProducts([...new Set([...(addon.applicableProducts ?? []), ...products.filter((product) => product.availableAddonIds?.includes(addon.id)).map((product) => product.id)])]); setIsActive(addon.isActive);
  }, [addon, products]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError('Escribe el nombre comercial del extra.'); return; }
    if (price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) { setError('Ingresa un precio válido, igual o mayor a cero.'); return; }
    if (requiresInput && (!label.trim() || !placeholder.trim())) { setError('Completa la etiqueta y el placeholder del campo.'); return; }
    setError(''); setSaving(true);
    try {
      await onSave({ name: name.trim(), badge: badge.trim() || undefined, category, price: Number(price), appliesTo, perSide, description: description.trim(), requiresInput,
        ...(requiresInput ? { inputConfig: { label: label.trim(), placeholder: placeholder.trim(), maxLength: Math.max(1, Number(maxLength) || 30) } } : {}),
        applicableProducts, isActive });
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el extra.'); }
    finally { setSaving(false); }
  };
  const toggleProduct = (id: string) => setApplicableProducts((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="addon-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Catálogo de extras</p><h2 id="addon-form-title" className="mt-1 text-xl font-semibold text-slate-900">{addon ? 'Editar extra' : 'Crear nuevo extra'}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button></header>
      <form onSubmit={submit} className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Nombre comercial *<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Grabado láser en tapa" className={fieldClass} /></label>
          <label className="text-sm font-medium text-slate-700">Etiqueta / badge<input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Láser HD" className={fieldClass} /></label>
          <label className="text-sm font-medium text-slate-700">Categoría<select value={category} onChange={(e) => setCategory(e.target.value as AddonCategory)} className={fieldClass}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Se cobra por<select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as AddonAppliesTo)} className={fieldClass}>{applicationScopes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Precio adicional ($) *<input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2.50" className={fieldClass} /></label>
          <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-emerald-600" />Extra activo</label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Descripción para el cliente<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explica brevemente este acabado o extra..." className={fieldClass} /></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-sm text-slate-700"><input type="checkbox" checked={perSide} onChange={(event) => setPerSide(event.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" /><span><span className="font-semibold">Cobrar por cada cara con diseño</span><span className="mt-0.5 block text-xs text-slate-500">El precio de este acabado se multiplicará por el número de caras utilizadas.</span></span></label>
        <section className="rounded-xl border border-slate-200 p-4"><label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-800"><input type="checkbox" checked={requiresInput} onChange={(e) => setRequiresInput(e.target.checked)} className="h-4 w-4 accent-emerald-600" />Solicitar texto o dedicatoria al cliente</label>
          {requiresInput && <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700 sm:col-span-3">Etiqueta del campo *<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Texto a grabar en la tapa:" className={fieldClass} /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Placeholder *<input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} placeholder="Ej. Nombre o iniciales" className={fieldClass} /></label><label className="text-sm font-medium text-slate-700">Máximo de caracteres<input type="number" min="1" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} className={fieldClass} /></label></div>}
        </section>
        <fieldset><legend className="text-sm font-semibold text-slate-800">Productos que pueden usar este extra</legend><p className="mb-3 mt-1 text-xs text-slate-500">Puedes seleccionar uno o varios productos.</p>{products.length ? <div className="grid gap-2 sm:grid-cols-2">{products.map((product) => <label key={product.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={applicableProducts.includes(product.id)} onChange={() => toggleProduct(product.id)} className="h-4 w-4 accent-emerald-600" /><span>{product.name}</span></label>)}</div> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Aún no hay productos configurados.</p>}</fieldset>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <footer className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? 'Guardando…' : addon ? 'Guardar cambios' : 'Crear extra'}</button></footer>
      </form>
    </section>
  </div>;
}
