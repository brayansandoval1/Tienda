'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LockKeyhole, PackageCheck, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { type Product, type ProductOptionValue } from '@/src/store/useProductStore';
import ComponentColorsPanel from '@/components/editor/ComponentColorsPanel';
import { getEffectiveMockup } from '@/src/utils/getEffectiveMockup';
import type { Addon } from '@/types/addon';
import { getAddonsByProduct } from '@/services/addonsService.js';
import { usePriceCalculator } from '@/components/editor/usePriceCalculator';

const optionGroupName = (option: { name: string }) => /(?:termo|taza|\d+\s*oz|estándar)/i.test(option.name) ? 'Modelo' : option.name || 'Opción';

export default function ViewSelector({ product, panel, workflowStep = 'design', componentColors, enabledComponentMeshes, onComponentToggle, onComponentColorChange }: { product: Product; panel?: 'options' | 'preview'; workflowStep?: 'design' | 'options' | 'review'; componentColors: Record<string, string>; enabledComponentMeshes: string[]; onComponentToggle: (meshName: string, enabled: boolean) => void; onComponentColorChange: (meshName: string, color: string) => void }) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, ProductOptionValue>>({});
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<'options' | 'preview'>('options');
  const [selectedColorId, setSelectedColorId] = useState(product.colors?.[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [addonTexts, setAddonTexts] = useState<Record<string, string>>({});
  const [usedViewIds, setUsedViewIds] = useState<string[]>([]);
  const [coveragePercentage, setCoveragePercentage] = useState(0);
  const [backgroundCoversArea, setBackgroundCoversArea] = useState(false);
  const isOptionsStage = workflowStep === 'options';
  const baseView = product.views[0];

  // Las opciones sólo muestran la configuración persistida por Admin. El
  // producto base se representa exclusivamente con el control Estándar.
  const valuesForOption = (option: { values: ProductOptionValue[] }) => option.values;

  useEffect(() => {
    // Al llegar desde el detalle, restaura las variantes elegidas; los enlaces
    // directos al editor siguen iniciando con el producto estándar.
    const params = new URLSearchParams(window.location.search);
    const initialSelections = Object.fromEntries((product.options ?? []).flatMap((option) => {
      const valueId = params.get(`option.${option.id}`);
      const value = option.values.find((item) => item.id === valueId);
      return value ? [[option.id, value]] : [];
    })) as Record<string, ProductOptionValue>;
    setSelectedOptions(initialSelections);
    setActiveViewIndex(0);
    const minimumQuantity = Math.max(1, product.pricingSchema?.minimumQuantity ?? 1);
    const requestedQuantity = Number(params.get('quantity'));
    setQuantity(Number.isFinite(requestedQuantity) && requestedQuantity > 0
      ? Math.max(minimumQuantity, Math.floor(requestedQuantity))
      : minimumQuantity);
    setSelectedAddonIds([]);
    setAddonTexts({});
    setUsedViewIds([]);
    setCoveragePercentage(0);
    setBackgroundCoversArea(false);
    getAddonsByProduct(product.id, product.availableAddonIds).then(setAvailableAddons).catch((error) => { console.error('No se pudieron cargar los extras del producto:', error); setAvailableAddons([]); });
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

  // Las etapas de la navegación superior abren el contenido correspondiente
  // sin perder las selecciones de color, modelo o cantidad ya realizadas.
  useEffect(() => {
    if (panel) setActivePanel(panel);
  }, [panel]);

  useEffect(() => {

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

  useEffect(() => {
    const handleCanvasUsage = (event: Event) => {
      const detail = (event as CustomEvent<{ usedViewIds?: string[]; isFullWrap?: boolean; coveragePercentage?: number; backgroundCoversArea?: boolean }>).detail;
      setUsedViewIds(Array.isArray(detail?.usedViewIds) ? detail.usedViewIds : []);
      setCoveragePercentage(Number(detail?.coveragePercentage) || 0);
      setBackgroundCoversArea(Boolean(detail?.backgroundCoversArea));
    };
    window.addEventListener('editor:canvas-usage-change', handleCanvasUsage);
    return () => window.removeEventListener('editor:canvas-usage-change', handleCanvasUsage);
  }, []);

  const handleOptionSelect = (optionId: string, value: ProductOptionValue) => {


    // Una URL vacía no es un mockup válido: se elimina del valor seleccionado
    // para que el resolvedor vuelva a la vista base en lugar de reutilizar la
    // imagen de una variante previa.
    const selectedValue = value.mockupUrl?.trim()
      ? value
      : { ...value, mockupUrl: undefined };


    // Mantiene una selección por grupo, igual que en la ficha del producto.
    // Cualquier grupo activo desmarca Estándar; ese botón limpia todos.
    const newSelections: Record<string, ProductOptionValue> = {
      ...selectedOptions,
      [optionId]: selectedValue,
    };
    setSelectedOptions(newSelections);
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

  const selectedValues = useMemo(() => Object.values(selectedOptions), [selectedOptions]);
  const selectedAddons = useMemo(() => availableAddons.filter((addon) => selectedAddonIds.includes(addon.id)).map((addon) => ({ id: addon.id, name: addon.name, price: addon.price, perSide: addon.perSide, ...(addon.requiresInput ? { userText: addonTexts[addon.id] ?? '' } : {}) })), [availableAddons, selectedAddonIds, addonTexts]);
  const usedExtraViews = usedViewIds.filter((viewId) => viewId !== product.views[0]?.id);
  const isDoubleSidedUsed = usedExtraViews.length > 0 && usedViewIds.length > 1;
  const designedViews = product.views.filter((view) => usedViewIds.includes(view.id));
  const designProgress = product.views.length
    ? Math.round((designedViews.length / product.views.length) * 100)
    : 0;
  const designInsight = designedViews.length === 0
    ? 'Empieza con una imagen o texto. El diseño se conserva al recorrer las vistas.'
    : designedViews.length < product.views.length
      ? `Tu diseño está en ${designedViews.map((view) => view.label || view.name).join(', ')}. Puedes completar las otras vistas si quieres imprimir más caras.`
      : 'Tu diseño ya está presente en todas las vistas. Revisa cada cara antes de continuar.';
  const selectedVariant = useMemo(() => selectedValues.length > 0 ? {
    id: selectedValues[selectedValues.length - 1].id,
    variantIds: selectedValues.map((value) => value.id),
    priceDelta: selectedValues.reduce((sum, value) => sum + (Number(value.priceModifier) || 0), 0),
  } : null, [selectedValues]);
  const pricingCanvasState = useMemo(() => ({ usedViewIds, designedSideCount: usedViewIds.length, coveragePercentage, backgroundCoversArea, isDoubleSidedUsed }), [usedViewIds, coveragePercentage, backgroundCoversArea, isDoubleSidedUsed]);
  const calculation = usePriceCalculator({
    product,
    selectedVariant,
    canvasState: pricingCanvasState,
    addons: selectedAddons,
    quantity,
  });
  const { printingRule, sidesCost: sideExtra, addonsCost, unitBasePrice, unitSubtotal, discountPercentage, discountPerUnit, discountedUnitPrice: finalPrice, setupFee, grandTotal } = calculation;
  const basePrice = unitBasePrice;
  const productBasePrice = product.basePrice ?? product.price;
  const optionPrice = unitBasePrice - productBasePrice;
  const minimumQuantity = Math.max(1, product.pricingSchema?.minimumQuantity ?? 1);
  const meetsMinimumQuantity = quantity >= minimumQuantity;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('editor:quantity-validity', { detail: { productId: product.id, quantity, minimumQuantity, valid: meetsMinimumQuantity } }));
  }, [product.id, quantity, minimumQuantity, meetsMinimumQuantity]);
  const printingChargeLabel = printingRule === 'full-wrap'
    ? 'Impresión Cobertura 360° (Full Wrap)'
    : printingRule === 'double-sided' ? 'Impresión 2 Caras' : 'Impresión 1 Cara';
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('editor:addons-changed', { detail: { addons: selectedAddons, basePrice, sideExtra, isDoubleSidedUsed, printingRule, coveragePercentage, quantity, calculation, totalPrice: grandTotal } }));
  }, [selectedAddons, basePrice, sideExtra, isDoubleSidedUsed, printingRule, coveragePercentage, quantity, calculation, grandTotal]);
  const priceLabel = (modifier: number) => modifier === 0 ? 'Incluido' : `${modifier > 0 ? '+' : '-'}$${Math.abs(modifier).toFixed(2)}`;
  const activeBaseView = product.views[activeViewIndex] ?? product.views[0];
  const activeViewId = activeBaseView?.id ?? 'front';
  const colorVariants = activeBaseView?.colorVariants?.length ? activeBaseView.colorVariants : (product.colors ?? []);
  const selectedColor = colorVariants.find((variant) => variant.id === selectedColorId) ?? null;

  // "Modelo / Estilo": sólo se muestra si existen opciones reales entre las que
  // elegir. Si el producto sólo ofrece "Estándar" (o un único valor en total),
  // el bloque completo se oculta para no saturar la UI con controles inútiles.
  const totalStyleValues = (product.options ?? []).reduce((count, option) => count + valuesForOption(option).length, 0);
  // Se muestran TODOS los grupos con al menos un valor: un grupo con una sola
  // opción sigue siendo una elección válida frente a "Estándar" (esto evitaba
  // que el termo, con un único grupo de capacidad, perdiera sus opciones al
  // borrar una variante desde el Admin).
  const visibleOptions = (product.options ?? []).filter((option) => valuesForOption(option).length >= 1);
  const showStyleSection = visibleOptions.length > 0;

  // Imagen compacta del producto para dar contexto a los controles de
  // personalización sin quitar espacio al lienzo de diseño.
  const previewMockup = getEffectiveMockup(
    product,
    activeViewId,
    selectedOptions,
    selectedColorId || product.colors?.[0]?.id || activeBaseView?.colorVariants?.[0]?.id,
  );
  const previewImageUrl = previewMockup.mockupUrl || activeBaseView?.mockupUrl || '';

  const customizationControls = (
    <div className="space-y-4">
      <ComponentColorsPanel
        parts={(product.customizableParts ?? []).filter((part) => part.enabled !== false)}
        colors={componentColors}
        enabledMeshNames={enabledComponentMeshes}
        onToggle={onComponentToggle}
        onColorChange={onComponentColorChange}
      />
      {availableAddons.length > 0 && <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Acabados y extras</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Agrega personalizaciones opcionales al producto.</p>
        </div>
        <div className="space-y-2">
          {availableAddons.map((addon) => {
            const checked = selectedAddonIds.includes(addon.id);
            return <div key={addon.id} className={`rounded-xl border p-3 transition ${checked ? 'border-violet-400 bg-violet-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={checked} onChange={() => setSelectedAddonIds((current) => checked ? current.filter((id) => id !== addon.id) : [...current, addon.id])} className="mt-0.5 h-4 w-4 rounded accent-violet-600" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">{addon.name}</span>
                    <span className="text-xs font-semibold text-violet-700">+${addon.price.toFixed(2)}{addon.perSide ? ' / cara' : ''}</span>
                  </span>
                  {addon.badge && <span className="mt-1 inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{addon.badge}</span>}
                  {addon.description && <span className="mt-1 block text-xs leading-5 text-slate-500">{addon.description}</span>}
                </span>
              </label>
              {checked && addon.requiresInput && <label className="mt-3 block pl-7 text-xs font-medium text-slate-700">
                {addon.inputConfig?.label || 'Texto personalizado'}
                <textarea value={addonTexts[addon.id] ?? ''} maxLength={addon.inputConfig?.maxLength ?? 300} onChange={(event) => setAddonTexts((current) => ({ ...current, [addon.id]: event.target.value }))} placeholder={addon.inputConfig?.placeholder || 'Escribe tu texto'} rows={2} className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                <span className="mt-1 block text-right font-normal text-slate-400">{(addonTexts[addon.id] ?? '').length}/{addon.inputConfig?.maxLength ?? 300}</span>
              </label>}
            </div>;
          })}
        </div>
      </section>}
    </div>
  );

  // Depuración: verifica cuántas variantes reales recibe el frontend por grupo.
  (product.options ?? []).forEach((option) => {

  });

  return (
    <aside className={`flex min-h-0 h-full w-full flex-col overflow-hidden bg-white ${workflowStep === 'design' ? 'max-w-[320px] rounded-[22px] border border-slate-200/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]' : ''}`}>
      {/* Pestañas estilo e-commerce */}
      {workflowStep === 'design' && <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 p-2">
        <button type="button" onClick={() => setActivePanel('options')} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${activePanel === 'options' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Opciones</button>
        <button type="button" onClick={() => setActivePanel('preview')} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${activePanel === 'preview' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Personalizar</button>
      </div>}

      <div className={`min-h-0 flex-1 overflow-y-auto ${isOptionsStage ? 'p-8 lg:p-10' : 'p-4'}`}>
      {workflowStep === 'review' ? (
        <section className="mx-auto max-w-[540px] space-y-6 pb-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={15} /> Diseño listo para producción
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Revisa y finaliza tu compra</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Confirma los detalles de tu pieza personalizada antes de continuar al pago.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm"><PackageCheck size={20} /></span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{product.name}</p>
                <p className="mt-1 text-sm text-slate-500">{product.category || 'Producto personalizado'}{selectedColor?.name ? ` · ${selectedColor.name}` : ''}</p>
                {selectedValues.length > 0 && <p className="mt-2 text-xs leading-5 text-slate-600">{selectedValues.map((value) => value.label).join(' · ')}</p>}
              </div>
            </div>
          </div>

          {selectedAddons.length > 0 && <section aria-labelledby="review-addons-title" className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
            <h2 id="review-addons-title" className="text-sm font-semibold text-slate-900">Acabados y extras incluidos</h2>
            <ul className="mt-3 divide-y divide-violet-100">
              {selectedAddons.map((addon) => <li key={addon.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="text-sm font-medium text-slate-800">{addon.name}</p>{addon.userText && <p className="mt-1 break-words text-xs text-slate-600">{addon.userText}</p>}</div>
                <span className="shrink-0 text-sm font-semibold text-violet-800">+${(addon.price * (addon.perSide ? calculation.designedSideCount : 1)).toFixed(2)}</span>
              </li>)}
            </ul>
          </section>}

          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="font-semibold text-amber-950">Antes de continuar</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-amber-900/80">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-amber-600" size={15} />Verifica que los textos, imágenes y detalles sean correctos.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-amber-600" size={15} />Revisa cada vista del producto en el área central.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-amber-600" size={15} />Tu diseño se preparará en alta resolución al continuar.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-medium text-slate-600">Precio por pieza</span>
              <span className="text-lg font-bold tracking-tight text-slate-900">${finalPrice.toFixed(2)}</span>
            </div>
            <details className="group border-b border-slate-100 py-3 text-sm">
              <summary className="cursor-pointer list-none font-medium text-slate-600 marker:hidden">Ver desglose <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span></summary>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3 text-slate-600"><span>Precio unitario base</span><span>${productBasePrice.toFixed(2)}</span></div>
                {optionPrice !== 0 && <div className="flex justify-between gap-3 text-slate-600"><span>Opciones seleccionadas</span><span>{optionPrice > 0 ? '+' : '−'}${Math.abs(optionPrice).toFixed(2)}</span></div>}
                {printingRule !== 'single-sided' && <div className="flex justify-between gap-3 text-slate-600"><span>{printingChargeLabel}</span><span>{sideExtra > 0 ? `+$${sideExtra.toFixed(2)}` : 'Incluida'}</span></div>}
                {selectedAddons.map((addon) => { const addonCost = addon.price * (addon.perSide ? calculation.designedSideCount : 1); return <div key={addon.id} className="flex justify-between gap-3 text-slate-600"><span className="min-w-0">Acabado {addon.name}{addon.perSide ? ` · ${calculation.designedSideCount} caras` : ''}</span><span className="shrink-0">+${addonCost.toFixed(2)}</span></div>; })}
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-2 text-slate-600"><span>Subtotal unitario</span><span>${unitSubtotal.toFixed(2)}</span></div>
                {discountPercentage > 0 && <div className="flex justify-between gap-3 text-emerald-700"><span>Descuento por volumen (−{discountPercentage}%)</span><span>−${(discountPerUnit * quantity).toFixed(2)}</span></div>}
                {setupFee > 0 && <div className="flex justify-between gap-3 text-slate-600"><span>Cargo fijo de preparación</span><span>+${setupFee.toFixed(2)}</span></div>}
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-2 font-semibold text-slate-900"><span>Total del pedido ({quantity} pzs.)</span><span>${grandTotal.toFixed(2)}</span></div>
              </div>
            </details>
            <div className="flex items-center justify-between py-4">
              <label htmlFor="review-quantity" className="text-sm font-medium text-slate-700">Cantidad</label>
              <input id="review-quantity" type="number" min={minimumQuantity} step="1" value={quantity} onChange={(event) => setQuantity(Math.max(0, Math.floor(Number(event.target.value) || 0)))} className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
            </div>
            {!meetsMinimumQuantity && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Este producto requiere un pedido mínimo de {minimumQuantity} unidades.</p>}
            <div className="flex items-baseline justify-between border-t border-slate-100 pt-4">
              <span className="font-semibold text-slate-900">Total del pedido</span>
              <span className="text-2xl font-bold tracking-tight text-slate-950">${grandTotal.toFixed(2)}</span>
            </div>
            <button type="button" disabled={!meetsMinimumQuantity} onClick={() => window.dispatchEvent(new CustomEvent('editor:add-to-cart', { detail: { productId: product.id, basePrice, price: finalPrice, totalPrice: grandTotal, sideExtra, printingRule, coveragePercentage, isDoubleSidedUsed, addons: selectedAddons, selections: selectedOptions, quantity, minimumQuantity, calculation, pricingContext: { product: { price: product.price, basePrice: productBasePrice, pricingSchema: product.pricingSchema, pricingRules: product.pricingRules }, selectedVariant, canvasState: pricingCanvasState, addons: selectedAddons } } }))} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              <ShoppingBag size={17} /> Continuar al pago
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500"><LockKeyhole size={13} /> Pago seguro y protegido</p>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            <ShieldCheck className="shrink-0 text-emerald-600" size={18} /> Tu archivo final se genera al continuar y queda listo para producción.
          </div>
        </section>
      ) : activePanel === 'options' ? (
        <div className={isOptionsStage ? 'mx-auto max-w-[540px] space-y-7' : 'space-y-5'}>
          {isOptionsStage && <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">Configuración del producto</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Selecciona las opciones</h1>
            <p className="mt-2 text-sm text-slate-500">Elige las variantes de tu producto antes de continuar.</p>
          </div>}
          <div className="flex flex-col space-y-1 mb-4">
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              {product.category?.trim() || 'PRODUCTO PERSONALIZADO'}
              {selectedColor?.name ? ` · ${selectedColor.name}` : ''}
            </span>
            <h2 className="text-lg font-bold leading-tight text-slate-900">
              {(() => {
                // Nombre base sin capacidad heredada (ej: "termo 10 oz" -> "termo"),
                // para que el título sea base + variante activa, sin capacidades viejas.
                const baseName = product.name.replace(/\s*\d+\s*(oz|ml|l)\b/gi, '').trim() || product.name;
                const activeVariant = selectedValues.length > 0
                  ? ` ${selectedValues.map((value) => value.label).join(' ')}`
                  : '';
                return `${baseName}${activeVariant}`;
              })()}
            </h2>
          </div>

          {colorVariants.length > 0 && <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Color del producto</p>
            <div className="flex flex-wrap gap-2">
              {colorVariants.map((variant) => {
                const selected = selectedColorId === variant.id;
                return <button key={variant.id} type="button" title={variant.name} aria-label={`Seleccionar color ${variant.name}`} aria-pressed={selected} onClick={() => { setSelectedColorId(variant.id); window.dispatchEvent(new CustomEvent('editor:product-color', { detail: { variant } })); }} className={`relative h-9 w-9 rounded-full border border-slate-300 transition ${selected ? 'ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-105'}`} style={{ backgroundColor: variant.hexColor }} />;
              })}
            </div>
          </div>}
          {showStyleSection && <section className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Modelo / Estilo</p>
            <div className="space-y-2">
              <button type="button" onClick={handleStandardSelect} aria-pressed={selectedValues.length === 0} className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${selectedValues.length === 0 ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <span className="font-medium">Estándar</span><span className="ml-2 text-xs text-slate-500">Producto base</span>
              </button>
          {visibleOptions.map((option) => <div key={option.id} className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{optionGroupName(option)}</p>
            <div className={`grid auto-rows-fr gap-2 ${isOptionsStage ? 'grid-cols-3' : 'grid-cols-2'}`}>{valuesForOption(option).map((value, index) => {
              const selected = selectedOptions[option.id]?.id === value.id;
              return <button key={value.id || `opt-${option.id}-${index}`} type="button" onClick={() => handleOptionSelect(option.id, value)} aria-pressed={selected} className={`overflow-hidden rounded-xl border p-2 text-left text-sm transition ${selected ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-black/10' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="mb-1 flex h-14 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                  <img src={value.thumbnailUrl || value.mockupUrl || product.views[0]?.mockupUrl} alt={value.label || value.id || `Opción ${index + 1}`} crossOrigin="anonymous" className="h-full w-full object-contain p-1" />
                </div>
                <span className="block truncate text-xs font-medium text-slate-800">{value.label || value.id || `Opción ${index + 1}`}</span>
                <span className="text-[10px] text-slate-500">{priceLabel(value.priceModifier)}</span>
              </button>;
            })}</div>
          </div>)}
        </div>
          </section>}

          {isOptionsStage && customizationControls}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Precio total</p>
            <p className="text-2xl font-bold text-slate-900">${grandTotal.toFixed(2)}</p>
            {workflowStep === 'options' && <div className="mt-3"><label htmlFor="options-quantity" className="block text-xs font-medium text-slate-600">Cantidad</label><input id="options-quantity" type="number" min={minimumQuantity} step="1" value={quantity} onChange={(event) => setQuantity(Math.max(0, Math.floor(Number(event.target.value) || 0)))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800" />{!meetsMinimumQuantity && <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Este producto requiere un pedido mínimo de {minimumQuantity} unidades.</p>}</div>}
            <details className="group mt-2 border-t border-slate-200 pt-2 text-xs">
              <summary className="cursor-pointer list-none font-medium text-slate-600">Ver desglose <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span></summary>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between gap-3 text-slate-600"><span>Precio unitario base</span><span>${productBasePrice.toFixed(2)}</span></div>
                {optionPrice !== 0 && <div className="flex justify-between gap-3 text-slate-600"><span>Opciones seleccionadas</span><span>{optionPrice > 0 ? '+' : '−'}${Math.abs(optionPrice).toFixed(2)}</span></div>}
                {printingRule !== 'single-sided' && <div className="flex justify-between gap-3 text-slate-600"><span>{printingChargeLabel}</span><span>{sideExtra > 0 ? `+$${sideExtra.toFixed(2)}` : 'Incluida'}</span></div>}
                {selectedAddons.map((addon) => { const addonCost = addon.price * (addon.perSide ? calculation.designedSideCount : 1); return <div key={addon.id} className="flex justify-between gap-3 text-slate-600"><span>Acabado {addon.name}{addon.perSide ? ` · ${calculation.designedSideCount} caras` : ''}</span><span>+${addonCost.toFixed(2)}</span></div>; })}
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-slate-600"><span>Subtotal unitario</span><span>${unitSubtotal.toFixed(2)}</span></div>
                {discountPercentage > 0 && <div className="flex justify-between gap-3 text-emerald-700"><span>Descuento por volumen (−{discountPercentage}%)</span><span>−${(discountPerUnit * quantity).toFixed(2)}</span></div>}
                {setupFee > 0 && <div className="flex justify-between gap-3 text-slate-600"><span>Cargo fijo de preparación</span><span>+${setupFee.toFixed(2)}</span></div>}
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold text-slate-900"><span>Total del pedido</span><span>${grandTotal.toFixed(2)}</span></div>
              </div>
            </details>
          </div>
          {workflowStep === 'design' && <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><Sparkles size={16} /></span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Estado del diseño</h3>
                  <p className="text-xs text-slate-500">{designedViews.length} de {product.views.length} vistas con diseño</p>
                </div>
              </div>
              <span className="text-xs font-semibold tabular-nums text-indigo-700">{designProgress}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-indigo-100" role="progressbar" aria-label="Progreso de vistas diseñadas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={designProgress}>
              <div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${designProgress}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.views.map((view) => {
                const hasDesign = usedViewIds.includes(view.id);
                return <button
                  key={view.id}
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('editor:request-view', { detail: { viewId: view.id } }))}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${hasDesign ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-700'}`}
                >
                  {hasDesign ? <CheckCircle2 size={12} /> : <span className="h-2 w-2 rounded-full border border-current opacity-50" />}
                  {view.label || view.name}
                </button>;
              })}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{designInsight}</p>
          </section>}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">Personaliza tu producto</h2>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">Ajusta los componentes 3D y agrega acabados opcionales.</p>
          </div>
          <div className="flex h-36 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <img src={previewImageUrl} alt={product.name} crossOrigin="anonymous" className="h-full w-full object-contain" />
          </div>
          {customizationControls}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-500">Total estimado</p>
            <p className="text-2xl font-bold text-slate-900">${grandTotal.toFixed(2)}</p>
          </div>
        </div>
      )}

      </div>
    </aside>
  );
}
