'use client';

import { useEffect, useState } from 'react';
import { type Product, type ProductOptionValue } from '@/src/store/useProductStore';
import ProductSelector from '@/components/editor/ProductSelector';

export default function ViewSelector({ product }: { product: Product }) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, ProductOptionValue>>({});
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const baseView = product.views[0];

  // El primer valor representa siempre el estado original del producto. Los
  // catálogos existentes pueden omitir esos campos en `values[0]`; en ese
  // caso se completan aquí sin modificar los datos persistidos.
  const valuesForOption = (option: { values: ProductOptionValue[] }) => option.values.map((value, index) =>
    index === 0
      ? {
          ...value,
          mockupUrl: value.mockupUrl ?? baseView?.mockupUrl,
          mockupUrls: value.mockupUrls ?? Object.fromEntries(product.views.map((view) => [view.id, view.mockupUrl])),
          printArea: value.printArea ?? baseView?.printArea,
        }
      : value,
  );

  useEffect(() => {
    // Un producto nuevo nunca hereda opciones de otro. No se autoselecciona
    // `values[0]`: el primer render debe mostrar el producto base nativo.
    setSelectedOptions({});
    setActiveViewIndex(0);
  }, [product.id]);

  useEffect(() => {
    const handleViewChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ viewIndex?: number }>).detail;
      if (typeof detail?.viewIndex === 'number') {
        setActiveViewIndex(detail.viewIndex);
      }
    };
    window.addEventListener('editor:view-changed', handleViewChanged);
    return () => {
      window.removeEventListener('editor:view-changed', handleViewChanged);
    };
  }, []);

  const handleOptionSelect = (optionId: string, value: ProductOptionValue) => {
    // Una URL vacía no es un mockup válido: se elimina del valor seleccionado
    // para que el resolvedor vuelva a la vista base en lugar de reutilizar la
    // imagen de una variante previa.
    const selectedValue = value.mockupUrl?.trim()
      ? value
      : { ...value, mockupUrl: undefined };
    console.log('🔍 [OPCIÓN SELECCIONADA]:', {
      optionId,
      selectedValueName: selectedValue.label,
      hasCustomViews: Boolean(selectedValue.views?.length),
      customMockupUrl: selectedValue.mockupUrl,
      customPrintArea: selectedValue.printArea,
    });
    // Sustituye exclusivamente el valor de su categoría; nunca bloquea ni
    // alterna implícitamente el valor que ya estaba activo.
    // Reinsertar la clave al final conserva un único valor por categoría y
    // deja el orden de Object.values() como el orden real de interacción.
    const { [optionId]: _previousValue, ...otherSelections } = selectedOptions;
    const newSelections = { ...otherSelections, [optionId]: selectedValue };
    setSelectedOptions((currentSelections) => {
      const { [optionId]: _currentValue, ...otherCurrentSelections } = currentSelections;
      const updated = { ...otherCurrentSelections, [optionId]: selectedValue };
      console.log('🔄 [NUEVO ESTADO OPCIONES]:', updated);
      return updated;
    });
    window.dispatchEvent(new CustomEvent('editor:options-changed', { detail: { productId: product.id, selections: newSelections } }));
    // El canvas resuelve `value.printArea ?? view.printArea`, conserva el
    // fondo si no hay mockup y recalcula guía, clipPath y límites del arte.
    window.dispatchEvent(new CustomEvent('editor:option-mockup', { detail: { optionId, optionValue: selectedValue, selections: newSelections } }));
  };

  const handleResetOption = (optionId: string) => {
    setSelectedOptions((currentSelections) => {
      const nextSelections = { ...currentSelections };
      delete nextSelections[optionId];
      console.log('↩️ [OPCIÓN RESTAURADA A ESTÁNDAR]:', {
        optionId,
        nextSelections,
      });
      return nextSelections;
    });
    const nextSelections = { ...selectedOptions };
    delete nextSelections[optionId];
    window.dispatchEvent(new CustomEvent('editor:options-changed', {
      detail: { productId: product.id, selections: nextSelections },
    }));
    window.dispatchEvent(new CustomEvent('editor:option-mockup', {
      detail: { optionId, optionValue: null, selections: nextSelections },
    }));
  };

  const selectedValues = Object.values(selectedOptions);
  const finalPrice = product.price + selectedValues.reduce((total, value) => total + value.priceModifier, 0);
  const priceLabel = (modifier: number) => modifier === 0 ? 'Incluido' : `${modifier > 0 ? '+' : '-'}$${Math.abs(modifier).toFixed(2)}`;
  const activeBaseView = product.views[activeViewIndex] ?? product.views[0];
  const activeResolvedView = (() => {
    const selectedValuesList = Object.values(selectedOptions);
    const optionWithViews = selectedValuesList.find((value) => value?.views && Array.isArray(value.views) && value.views.length > 0);
    if (optionWithViews) {
      const matchedView = optionWithViews.views?.[activeViewIndex] || optionWithViews.views?.find((view) => view.viewId === activeBaseView?.id || view.name === activeBaseView?.name);
      if (matchedView?.mockupUrl) {
        return matchedView;
      }
    }

    const optionWithMockup = [...selectedValuesList].reverse().find((value) => value?.mockupUrl?.trim());
    if (optionWithMockup?.mockupUrl?.trim()) {
      return {
        mockupUrl: optionWithMockup.mockupUrl,
        printArea: optionWithMockup.printArea || activeBaseView?.printArea,
      } as ProductOptionValue;
    }

    return activeBaseView;
  })();
  const quickPreviewUrl = activeResolvedView?.mockupUrl || activeBaseView?.mockupUrl || '';

  return (
    <aside className="sticky top-4 w-full max-w-[320px] self-start space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Vista Rápida</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-slate-100">
            <img src={quickPreviewUrl} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="p-3">
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
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleResetOption(option.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    !selectedOptions[option.id]
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Estándar
                </button>
                {valuesForOption(option).map((value) => {
                  const selected = selectedOptions[option.id]?.id === value.id;
                  return (
                    <button
                      key={value.id}
                      type="button"
                      onClick={() => handleOptionSelect(option.id, value)}
                      className={option.type === 'thumbnails'
                        ? `rounded-xl border p-2 text-left text-sm transition ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white' }`
                        : `flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white' }`
                      }
                    >
                      {option.type === 'thumbnails' ? (
                        <>
                          <span className="flex items-center gap-2">
                            {value.thumbnailUrl && <img src={value.thumbnailUrl} alt="" className="h-7 w-7 rounded object-cover" />}
                            {value.label}
                          </span>
                          <span className="text-xs text-slate-500">{priceLabel(value.priceModifier)}</span>
                        </>
                      ) : (
                        <>
                          <span>{value.label}</span>
                          <span className="text-xs text-slate-500">{priceLabel(value.priceModifier)}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              {option.type === 'select' ? (
                <select value={selectedOptions[option.id]?.id ?? ''} onChange={(event) => { const value = valuesForOption(option).find((item) => item.id === event.target.value); if (value) handleOptionSelect(option.id, value); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {valuesForOption(option).map((value) => <option key={value.id} value={value.id}>{value.label} ({priceLabel(value.priceModifier)})</option>)}
                </select>
              ) : (
                null
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
