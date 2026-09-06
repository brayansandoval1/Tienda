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
  const [activePanel, setActivePanel] = useState<'preview' | 'options'>('preview');
  const [selectedColorId, setSelectedColorId] = useState(product.colors?.[0]?.id ?? '');
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
    setSelectedColorId(product.colors?.[0]?.id ?? product.views[0]?.colorVariants?.[0]?.id ?? '');

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
  const colorVariants = activeBaseView?.colorVariants?.length ? activeBaseView.colorVariants : (product.colors ?? []);
  const activeResolvedView = getEffectiveMockup(
    product,
    activeViewId,
    selectedOptions,
    product.colors?.[0]?.id ?? activeBaseView?.colorVariants?.[0]?.id,
  );
  const quickPreviewUrl = activeResolvedView.mockupUrl || activeBaseView?.mockupUrl || '';
  const selectedOptionLabel = Object.values(selectedOptions)[0]?.label?.trim();
  const optionLabels = (product.options ?? [])
    .flatMap((option) => option.values.map((value) => value.label.trim()))
    .filter(Boolean);
  const basePreviewName = optionLabels.reduce(
    (name, label) => name.replace(new RegExp(`\\s*${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*`, 'i'), ' ').trim(),
    product.name.replace(/\s+\d+(?:[.,]\d+)?\s*(?:oz|onzas?)\b/gi, ' ').trim(),
  );
  const previewProductName = selectedOptionLabel
    ? `${basePreviewName} ${selectedOptionLabel}`.trim()
    : product.name;

  return (
    <aside className="flex min-h-0 h-full w-full max-w-[320px] flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 p-2">
        <button type="button" onClick={() => setActivePanel('preview')} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${activePanel === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Vista previa</button>
        <button type="button" onClick={() => setActivePanel('options')} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${activePanel === 'options' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Opciones</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {activePanel === 'preview' ? <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Vista Rápida</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-slate-100">
            <img src={quickPreviewUrl} alt={previewProductName} className="h-full w-full object-cover" />
          </div>
          <div className="p-3">
            <h3 className="font-semibold text-slate-900">{previewProductName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Total <span className="font-medium text-slate-700">${finalPrice.toFixed(2)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Productos</p>
        <ProductSelector selectedId={product.id} />
      </div>
      </div> : <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Opciones del producto</p>
        {colorVariants.length > 0 && <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Color del producto</p>
          <div className="flex flex-wrap gap-2">
            {colorVariants.map((variant) => {
              const selected = selectedColorId === variant.id;
              return <button key={variant.id} type="button" title={variant.name} aria-label={`Seleccionar color ${variant.name}`} aria-pressed={selected} onClick={() => { setSelectedColorId(variant.id); window.dispatchEvent(new CustomEvent('editor:product-color', { detail: { variant } })); }} className={`relative h-9 w-9 rounded-full border border-slate-300 transition ${selected ? 'ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-105'}`} style={{ backgroundColor: variant.hexColor }} />;
            })}
          </div>
        </div>}
        {!!product.options?.length && <>
          <button type="button" onClick={handleStandardSelect} className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${Object.keys(selectedOptions).length === 0 ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white'}`}>
            <span className="font-medium">Estándar</span><span className="ml-2 text-xs text-slate-500">Producto base</span>
          </button>
          {product.options.map((option) => <div key={option.id} className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{optionGroupName(option)}</p>
            <div className="grid grid-cols-2 gap-2">{valuesForOption(option).map((value) => {
              const selected = selectedOptions[option.id]?.id === value.id;
              return <button key={value.id} type="button" onClick={() => handleOptionSelect(option.id, value)} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <span className="block truncate">{value.label}</span><span className="text-xs text-slate-500">{priceLabel(value.priceModifier)}</span>
              </button>;
            })}</div>
          </div>)}
        </>}
      </section>}
      </div>
    </aside>
  );
}
