'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Product, ProductOption, ProductOptionValue } from '@/src/store/useProductStore';

interface OptionsPanelProps {
  product: Product;
  onClose: () => void;
}

const formatModifier = (value: number) => value === 0 ? 'Incluido' : `${value > 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}`;

export default function OptionsPanel({ product, onClose }: OptionsPanelProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelections(Object.fromEntries(product.options?.map((option) => [option.id, option.values[0]?.id]) ?? []));
  }, [product]);

  const selectedValues = useMemo(() => product.options?.flatMap((option) =>
    option.values.filter((value) => selections[option.id] === value.id),
  ) ?? [], [product.options, selections]);
  const totalPrice = product.price + selectedValues.reduce((sum, value) => sum + value.priceModifier, 0);

  const choose = (option: ProductOption, value: ProductOptionValue) => {
    const next = { ...selections, [option.id]: value.id };
    setSelections(next);
    window.dispatchEvent(new CustomEvent('editor:options-changed', {
      detail: { productId: product.id, selections: next, totalPrice: product.price + product.options!.flatMap((item) => item.values.filter((itemValue) => (item.id === option.id ? value.id : next[item.id]) === itemValue.id)).reduce((sum, itemValue) => sum + itemValue.priceModifier, 0) },
    }));
    if (value.mockupUrl) window.dispatchEvent(new CustomEvent('editor:option-mockup', { detail: { mockupUrl: value.mockupUrl } }));
  };

  return (
    <aside className="w-full max-w-[288px] space-y-6 rounded-2xl border bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-bold text-gray-800">Opciones</h3>
        <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-800">Cerrar</button>
      </div>
      {!product.options?.length ? <p className="text-sm text-gray-500">Este producto no tiene opciones configuradas.</p> : product.options.map((option) => (
        <section key={option.id}>
          <label className="mb-2 block text-xs font-bold text-gray-600">{option.name}</label>
          {(option.displayType ?? option.type) === 'thumbnails' ? <div className="grid grid-cols-3 gap-2">{option.values.map((value) => {
            const selected = selections[option.id] === value.id;
            return <button key={value.id} type="button" onClick={() => choose(option, value)} className={`flex flex-col items-center rounded-xl border-2 p-1.5 transition-all ${selected ? 'border-orange-500 bg-orange-50/20' : 'border-gray-200 hover:border-gray-300'}`}>
              <img src={value.thumbnailUrl || value.mockupUrl || product.views[0]?.mockupUrl} alt={value.label} className="mb-1 h-12 w-12 object-contain" />
              <span className="text-center text-[10px] font-semibold leading-tight text-gray-700">{value.label}</span>
              <span className="mt-0.5 text-[9px] text-gray-500">{formatModifier(value.priceModifier)}</span>
            </button>;
          })}</div> : (option.displayType ?? option.type) === 'select' ? <select value={selections[option.id] ?? ''} onChange={(event) => choose(option, option.values.find((value) => value.id === event.target.value)!)} className="w-full rounded-lg border border-gray-200 p-2 text-sm">{option.values.map((value) => <option key={value.id} value={value.id}>{value.label} · {formatModifier(value.priceModifier)}</option>)}</select> : <div className="space-y-2">{option.values.map((value) => <label key={value.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-2 hover:bg-gray-50"><span className="flex items-center gap-2"><input type="radio" name={option.id} checked={selections[option.id] === value.id} onChange={() => choose(option, value)} className="text-blue-600 focus:ring-blue-500" /><span className="text-xs font-medium text-gray-700">{value.label}</span></span>{value.priceModifier !== 0 && <span className="text-xs font-semibold text-gray-500">{formatModifier(value.priceModifier)}</span>}</label>)}</div>}
        </section>
      ))}
      <div className="border-t pt-3 text-sm font-bold text-gray-800">Precio total: ${totalPrice.toFixed(2)}</div>
    </aside>
  );
}
