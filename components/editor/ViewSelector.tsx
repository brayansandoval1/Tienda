'use client';

import { useEffect, useState } from 'react';
import { type Product } from '@/src/store/useProductStore';
import ProductSelector from '@/components/editor/ProductSelector';

export default function ViewSelector({ product }: { product: Product }) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    const defaults = Object.fromEntries(product.options?.map((option) => [option.id, option.values[0]?.id]) ?? []);
    setSelectedOptions(defaults);
  }, [product]);

  const handleOptionChange = (optionId: string, valueId: string) => {
    const next = { ...selectedOptions, [optionId]: valueId };
    setSelectedOptions(next);
    window.dispatchEvent(new CustomEvent('editor:options-changed', { detail: { productId: product.id, selections: next } }));
  };

  const selectedValues = product.options?.flatMap((option) => option.values.filter((value) => selectedOptions[option.id] === value.id)) ?? [];
  const finalPrice = product.price + selectedValues.reduce((total, value) => total + value.priceModifier, 0);
  const priceLabel = (modifier: number) => modifier === 0 ? 'Incluido' : `${modifier > 0 ? '+' : '-'}$${Math.abs(modifier).toFixed(2)}`;

  const previewImage = product.views[0]?.mockupUrl ?? '';

  return (
    <aside className="w-full max-w-[320px] space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Vista Rápida</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-slate-100">
            <img src={previewImage} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-slate-900">{product.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Total <span className="font-medium text-slate-700">${finalPrice.toFixed(2)}</span>
            </p>
          </div>
        </div>
      </div>

      {!!product.options?.length && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Opciones del producto</p>
          {product.options.map((option) => (
            <div key={option.id} className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">{option.name}</p>
              {option.type === 'select' ? (
                <select value={selectedOptions[option.id] ?? ''} onChange={(event) => handleOptionChange(option.id, event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {option.values.map((value) => <option key={value.id} value={value.id}>{value.label} ({priceLabel(value.priceModifier)})</option>)}
                </select>
              ) : (
                <div className={option.type === 'thumbnails' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
                  {option.values.map((value) => {
                    const selected = selectedOptions[option.id] === value.id;
                    return <button key={value.id} type="button" onClick={() => handleOptionChange(option.id, value.id)} className={option.type === 'thumbnails' ? `rounded-xl border p-2 text-left text-sm ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'}` : `flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <span className="flex items-center gap-2">{value.thumbnailUrl && <img src={value.thumbnailUrl} alt="" className="h-7 w-7 rounded object-cover" />}{value.label}</span><span className="text-xs text-slate-500">{priceLabel(value.priceModifier)}</span>
                    </button>;
                  })}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Productos</p>
        <ProductSelector selectedId={product.id} />
      </div>
    </aside>
  );
}
