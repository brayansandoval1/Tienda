'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Product, ProductOption, ProductOptionValue } from '@/src/store/useProductStore';
import { getEffectiveMockup } from '@/src/utils/getEffectiveMockup';

interface OptionsPanelProps {
  product: Product;
  onClose: () => void;
}

const formatModifier = (value: number) => value === 0 ? 'Incluido' : `${value > 0 ? '+' : '-'}$${Math.abs(value).toFixed(2)}`;
const optionGroupName = (option: ProductOption) => /(?:termo|taza|\d+\s*oz|estándar)/i.test(option.name) ? 'Modelo' : option.name || 'Opción';

export default function OptionsPanel({ product, onClose }: OptionsPanelProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [activeViewId, setActiveViewId] = useState(product.views[0]?.id ?? 'front');

  useEffect(() => {
    const initialViewId = product.views[0]?.id ?? 'front';
    const initialSelections: Record<string, string> = {};

    setActiveViewId(initialViewId);
    setSelections(initialSelections);

    const selectedOptionsMap = Object.fromEntries(
      (product.options ?? []).flatMap((option) => {
        const selectedId = initialSelections[option.id];
        const selectedValue = option.values.find((value) => value.id === selectedId);
        return selectedValue ? [[option.id, selectedValue]] : [];
      }),
    );
    const resolved = getEffectiveMockup(
      product,
      initialViewId,
      selectedOptionsMap,
      product.colors?.[0]?.id ?? product.views[0]?.colorVariants?.[0]?.id,
    );

    window.dispatchEvent(new CustomEvent('editor:options-changed', {
      detail: { productId: product.id, selections: initialSelections },
    }));
    window.dispatchEvent(new CustomEvent('editor:option-mockup', {
      detail: {
        optionId: 'initial',
        selections: selectedOptionsMap,
        mockupUrl: resolved.mockupUrl,
        printArea: resolved.printArea,
        viewId: resolved.viewId,
      },
    }));
  }, [product]);

  useEffect(() => {
    console.log('📌 [UI OPTIONS] Opciones seleccionadas actuales:', selections);
  }, [selections]);

  useEffect(() => {
    const handleViewChanged = (event: Event) => {
      const viewId = (event as CustomEvent<{ viewId?: string }>).detail?.viewId;
      if (viewId) setActiveViewId(viewId);
    };
    window.addEventListener('editor:view-changed', handleViewChanged);
    return () => window.removeEventListener('editor:view-changed', handleViewChanged);
  }, []);

  const selectedValues = useMemo(() => product.options?.flatMap((option) =>
    option.values.filter((value) => selections[option.id] === value.id),
  ) ?? [], [product.options, selections]);
  const totalPrice = product.price + selectedValues.reduce((sum, value) => sum + value.priceModifier, 0);

  const choose = (option: ProductOption, value: ProductOptionValue) => {
    console.log('👇 [UI OPTIONS] Clic detectado en:', {
      groupName: option.id,
      groupLabel: optionGroupName(option),
      value,
    });
    const next: Record<string, string> = { [option.id]: value.id };
    console.log('🔄 [UI OPTIONS] Nuevas opciones que se enviarán al estado:', next);
    const selectedOptionsMap = Object.fromEntries(
      (product.options ?? []).flatMap((item) => {
        const selectedValue = item.values.find((candidate) => candidate.id === next[item.id]);
        return selectedValue ? [[item.id, selectedValue]] : [];
      }),
    );
    const resolved = getEffectiveMockup(product, activeViewId, selectedOptionsMap, product.colors?.[0]?.id ?? product.views[0]?.colorVariants?.[0]?.id);

    setSelections(next);
    window.dispatchEvent(new CustomEvent('editor:options-changed', {
      detail: { productId: product.id, selections: next, totalPrice: product.price + product.options!.flatMap((item) => item.values.filter((itemValue) => (item.id === option.id ? value.id : next[item.id]) === itemValue.id)).reduce((sum, itemValue) => sum + itemValue.priceModifier, 0) },
    }));
    window.dispatchEvent(new CustomEvent('editor:option-mockup', {
      detail: {
        optionId: option.id,
        optionValue: value,
        selections: selectedOptionsMap,
        mockupUrl: resolved.mockupUrl,
        printArea: resolved.printArea,
        viewId: resolved.viewId,
      },
    }));
  };

  const chooseStandard = () => {
    const next: Record<string, string> = {};
    const selectedOptionsMap = Object.fromEntries(
      (product.options ?? []).flatMap((item) => {
        const selectedValue = item.values.find((value) => value.id === next[item.id]);
        return selectedValue ? [[item.id, selectedValue]] : [];
      }),
    );
    const resolved = getEffectiveMockup(
      product,
      activeViewId,
      selectedOptionsMap,
      product.colors?.[0]?.id ?? product.views[0]?.colorVariants?.[0]?.id,
    );
    setSelections(next);
    window.dispatchEvent(new CustomEvent('editor:options-changed', {
      detail: { productId: product.id, selections: next },
    }));
    window.dispatchEvent(new CustomEvent('editor:option-mockup', {
      detail: {
        optionId: 'standard',
        selections: selectedOptionsMap,
        mockupUrl: resolved.mockupUrl,
        printArea: resolved.printArea,
        viewId: resolved.viewId,
      },
    }));
  };

  return (
    <aside className="w-full max-w-[308px] space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-bold text-gray-800">Opciones</h3>
        <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-800">Cerrar</button>
      </div>
      {!product.options?.length ? <p className="text-sm text-gray-500">Este producto no tiene opciones configuradas.</p> : <>
        <button
          type="button"
          onClick={chooseStandard}
          className={`mb-4 w-full rounded-xl border px-3 py-2 text-left text-sm transition ${Object.keys(selections).length === 0 ? 'border-orange-500 bg-orange-50/30 shadow-md' : 'border-gray-200 bg-white'}`}
        >
          <span className="font-medium">Estándar</span>
          <span className="ml-2 text-xs text-gray-500">Producto base</span>
        </button>
        {product.options.map((option) => (
        <section key={option.id}>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-gray-600">{optionGroupName(option)}</label>
          {(option.displayType ?? option.type) === 'thumbnails' ? (
            <div className="grid grid-cols-3 gap-2">
              {option.values.map((value) => {
                const selected = selections[option.id] === value.id;
                return (
                  <button
                    key={value.id}
                    type="button"
                    onClick={() => choose(option, value)}
                    className={`overflow-hidden rounded-2xl border-2 p-2 text-left transition-all ${selected ? 'border-orange-500 bg-orange-50/30 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <div className="overflow-hidden rounded-xl bg-gray-50">
                      <img src={value.thumbnailUrl || value.mockupUrl || product.views[0]?.mockupUrl} alt={value.label} className="h-16 w-full object-contain p-1.5" />
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <span className="text-[10px] font-semibold leading-tight text-gray-700">{value.label}</span>
                      <span className="text-[10px] font-semibold text-gray-500">{formatModifier(value.priceModifier)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (option.displayType ?? option.type) === 'select' ? (
            <select value={selections[option.id] ?? ''} onChange={(event) => {
              const found = option.values.find((value) => value.id === event.target.value);
              if (found) choose(option, found);
            }} className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm">
              <option value="" disabled>Selecciona una opción</option>
              {option.values.map((value) => <option key={value.id} value={value.id}>{value.label} · {formatModifier(value.priceModifier)}</option>)}
            </select>
          ) : (
            <div className="space-y-2">
              {option.values.map((value) => (
                <label key={value.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition ${selections[option.id] === value.id ? 'border-orange-500 bg-orange-50/30' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name={option.id} checked={selections[option.id] === value.id} onChange={() => choose(option, value)} className="text-blue-600 focus:ring-blue-500" />
                    <span className="text-xs font-medium text-gray-700">{value.label}</span>
                  </span>
                  <span className="text-xs font-semibold text-gray-500">{formatModifier(value.priceModifier)}</span>
                </label>
              ))}
            </div>
          )}
        </section>
        ))}
      </>}
      <div className="border-t pt-3 text-sm font-bold text-gray-800">Precio total: ${totalPrice.toFixed(2)}</div>
    </aside>
  );
}
