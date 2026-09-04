'use client';

import { useEffect, useState } from 'react';
import { type Product, type ProductOptionValue } from '@/src/store/useProductStore';
import ProductSelector from '@/components/editor/ProductSelector';
import { getEffectiveMockup } from '@/src/utils/getEffectiveMockup';

const optionGroupName = (option: { name: string }) => /(?:termo|taza|\d+\s*oz|estándar)/i.test(option.name) ? 'Modelo' : option.name || 'Opción';

const getDefaultSelections = (): Record<string, ProductOptionValue> => ({});

export default function ViewSelector({ product }: { product: Product }) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, ProductOptionValue>>({});
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const baseView = product.views[0];

  // Las opciones sólo muestran la configuración persistida por Admin. El
  // producto base se representa exclusivamente con el control Estándar.
  const valuesForOption = (option: { values: ProductOptionValue[] }) => option.values;

  useEffect(() => {
    // Un producto nuevo no hereda selecciones ajenas: cada grupo inicia con
    // su primera variante, sin añadir un botón genérico “Estándar”.
    const initialSelections = getDefaultSelections();
    setSelectedOptions(initialSelections);
    setActiveViewIndex(0);

    const currentViewId = product.views[0]?.id ?? 'front';
    const resolvedMockup = getEffectiveMockup(
      product,
      currentViewId,
      initialSelections,
      product.colors?.[0]?.id ?? product.views[0]?.colorVariants?.[0]?.id,
    );

    window.dispatchEvent(new CustomEvent('editor:options-changed', {
      detail: {
        productId: product.id,
        selections: initialSelections,
      },
    }));

    window.dispatchEvent(new CustomEvent('editor:option-mockup', {
      detail: {
        optionId: 'initial',
        selections: initialSelections,
        mockupUrl: resolvedMockup.mockupUrl,
        printArea: resolvedMockup.printArea,
        viewId: resolvedMockup.viewId,
      },
    }));
  }, [product.id]);

  useEffect(() => {
    console.log('📌 [UI OPTIONS] Opciones seleccionadas actuales:', selectedOptions);
  }, [selectedOptions]);

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
    console.log('👇 [UI OPTIONS] Clic detectado en:', {
      groupName: optionId,
      value,
    });
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
    // El mapa usa el ID estable del grupo. Reemplazar esta clave elimina
    // cualquier valor anterior del mismo grupo y conserva los demás grupos.
    const newSelections: Record<string, ProductOptionValue> = {
      [optionId]: selectedValue,
    };
    console.log('🔄 [UI OPTIONS] Nuevas opciones que se enviarán al estado:', newSelections);
    setSelectedOptions((currentSelections) => {
      const updated: Record<string, ProductOptionValue> = {
        [optionId]: selectedValue,
      };
      console.log('🔄 [NUEVO ESTADO OPCIONES]:', updated);
      return updated;
    });
    const currentViewId = product.views[activeViewIndex]?.id ?? product.views[0]?.id ?? 'front';
    const resolvedMockup = getEffectiveMockup(
      product,
      currentViewId,
      newSelections,
      product.colors?.[0]?.id ?? product.views[0]?.colorVariants?.[0]?.id,
    );
    window.dispatchEvent(new CustomEvent('editor:options-changed', { detail: { productId: product.id, selections: newSelections } }));
    window.dispatchEvent(new CustomEvent('editor:option-mockup', {
      detail: {
        optionId,
        optionValue: selectedValue,
        selections: newSelections,
        mockupUrl: resolvedMockup.mockupUrl,
        printArea: resolvedMockup.printArea,
        viewId: resolvedMockup.viewId,
      },
    }));
  };

  const handleStandardSelect = () => {
    const newSelections: Record<string, ProductOptionValue> = {};
    const currentViewId = product.views[activeViewIndex]?.id ?? product.views[0]?.id ?? 'front';
    const resolvedMockup = getEffectiveMockup(
      product,
      currentViewId,
      newSelections,
      product.colors?.[0]?.id ?? product.views[0]?.colorVariants?.[0]?.id,
    );
    setSelectedOptions(newSelections);
    window.dispatchEvent(new CustomEvent('editor:options-changed', {
      detail: { productId: product.id, selections: newSelections },
    }));
    window.dispatchEvent(new CustomEvent('editor:option-mockup', {
      detail: {
        optionId: 'standard',
        selections: newSelections,
        mockupUrl: resolvedMockup.mockupUrl,
        printArea: resolvedMockup.printArea,
        viewId: resolvedMockup.viewId,
      },
    }));
  };

  const selectedValues = Object.values(selectedOptions);
  const finalPrice = product.price + selectedValues.reduce((total, value) => total + value.priceModifier, 0);
  const priceLabel = (modifier: number) => modifier === 0 ? 'Incluido' : `${modifier > 0 ? '+' : '-'}$${Math.abs(modifier).toFixed(2)}`;
  const activeBaseView = product.views[activeViewIndex] ?? product.views[0];
  const activeViewId = activeBaseView?.id ?? 'front';
  const activeResolvedView = getEffectiveMockup(
    product,
    activeViewId,
    selectedOptions,
    product.colors?.[0]?.id ?? activeBaseView?.colorVariants?.[0]?.id,
  );
  const quickPreviewUrl = activeResolvedView.mockupUrl || activeBaseView?.mockupUrl || '';

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
          <button
            type="button"
            onClick={handleStandardSelect}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${Object.keys(selectedOptions).length === 0 ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'}`}
          >
            <span className="font-medium">Estándar</span>
            <span className="ml-2 text-xs text-slate-500">Producto base</span>
          </button>
          {product.options.map((option) => (
            <div key={option.id} className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">{optionGroupName(option)}</p>
              {option.type === 'select' ? (
                <select value={selectedOptions[option.id]?.id ?? ''} onChange={(event) => { const value = valuesForOption(option).find((item) => item.id === event.target.value); if (value) handleOptionSelect(option.id, value); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="" disabled>Selecciona una opción</option>
                  {valuesForOption(option).map((value) => <option key={value.id} value={value.id}>{value.label} ({priceLabel(value.priceModifier)})</option>)}
                </select>
              ) : <div className={option.type === 'thumbnails' ? 'flex flex-wrap gap-2' : 'space-y-2'}>{valuesForOption(option).map((value) => {
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
                })}</div>}
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
