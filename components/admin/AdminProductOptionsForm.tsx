'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ProductOption, ProductOptionValue } from '@/src/store/useProductStore';
import MockupAreaPicker, { normalizePrintArea, type PrintArea } from '@/components/admin/MockupAreaPicker';

interface AdminProductOptionsFormProps {
  options: ProductOption[];
  onChange: (options: ProductOption[]) => void;
}

const newValue = () => ({ id: crypto.randomUUID(), label: '', priceModifier: 0, thumbnailUrl: '', mockupUrl: '', printArea: null });
const newOption = (): ProductOption => ({ id: crypto.randomUUID(), name: '', type: 'radio', displayType: 'radio', values: [newValue()] });

export default function AdminProductOptionsForm({ options, onChange }: AdminProductOptionsFormProps) {
  const updateOption = (index: number, update: Partial<ProductOption>) => onChange(options.map((option, optionIndex) => optionIndex === index ? { ...option, ...update } : option));
  const updateValue = <K extends keyof ProductOptionValue>(optionIndex: number, valueIndex: number, field: K, value: ProductOptionValue[K]) => onChange(options.map((option, index) => index !== optionIndex ? option : { ...option, values: option.values.map((item, itemIndex) => itemIndex === valueIndex ? { ...item, [field]: value } : item) }));
  const setPrintAreaEnabled = (optionIndex: number, valueIndex: number, enabled: boolean) => {
    const value = options[optionIndex].values[valueIndex];
    updateValue(optionIndex, valueIndex, 'printArea', enabled ? value.printArea ?? { x: 25, y: 25, width: 50, height: 50 } : null);
  };
  const updatePrintArea = (optionIndex: number, valueIndex: number, area: PrintArea) => updateValue(optionIndex, valueIndex, 'printArea', normalizePrintArea(area));

  return (
    <section className="mt-6 max-w-full space-y-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h2 className="font-semibold text-slate-900">Opciones y variantes</h2>
        <p className="mt-1 text-sm text-slate-500">Configura estilos, tallas y capacidades con sus ajustes de precio.</p>
      </div>

      {options.map((option, optionIndex) => (
        <fieldset key={option.id} className="max-w-full space-y-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <label className="grid gap-1 md:col-span-2"><span className="text-xs font-bold text-gray-700">Nombre de la opción</span><input value={option.name} onChange={(event) => updateOption(optionIndex, { name: event.target.value })} placeholder="Ej: Tamaño, Estilo, Capacidad" className="w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm" /></label>
            <label className="grid gap-1"><span className="text-xs font-bold text-gray-700">Tipo de visualización</span><select value={option.displayType ?? option.type} onChange={(event) => updateOption(optionIndex, { type: event.target.value as ProductOption['type'], displayType: event.target.value as ProductOption['type'] })} className="w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm"><option value="radio">Selección radio</option><option value="thumbnails">Miniaturas con foto</option><option value="select">Lista desplegable</option></select></label>
          </div>

          <div className="flex justify-end"><button type="button" onClick={() => onChange(options.filter((_, index) => index !== optionIndex))} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"><Trash2 size={15} />Eliminar opción</button></div>
          <hr className="border-gray-200" />

          <div className="space-y-3"><span className="block text-xs font-bold text-gray-600">Valores disponibles:</span>
            {option.values.map((value, valueIndex) => {
              const printArea = value.printArea;
              return (
              <div key={value.id} className="grid grid-cols-1 items-end gap-2 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-12">
                <label className="grid gap-0.5 md:col-span-3"><span className="text-[10px] font-semibold text-gray-500">Etiqueta</span><input value={value.label} onChange={(event) => updateValue(optionIndex, valueIndex, 'label', event.target.value)} placeholder="Ej: 15 oz / Mágica" className="w-full min-w-0 rounded border px-2.5 py-1.5 text-xs" /></label>
                <label className="grid gap-0.5 md:col-span-2"><span className="text-[10px] font-semibold text-gray-500">Precio extra ($)</span><input type="number" step="0.01" value={value.priceModifier} onChange={(event) => updateValue(optionIndex, valueIndex, 'priceModifier', Number(event.target.value) || 0)} placeholder="0.00" className="w-full min-w-0 rounded border px-2.5 py-1.5 text-xs" /></label>
                <label className="grid gap-0.5 md:col-span-3"><span className="text-[10px] font-semibold text-gray-500">URL miniatura (opcional)</span><input value={value.thumbnailUrl ?? ''} onChange={(event) => updateValue(optionIndex, valueIndex, 'thumbnailUrl', event.target.value)} placeholder="/thumbs/taza.png" className="w-full min-w-0 rounded border px-2.5 py-1.5 text-xs" /></label>
                <label className="grid gap-0.5 md:col-span-3"><span className="text-[10px] font-semibold text-gray-500">URL mockup Canvas (opcional)</span><input value={value.mockupUrl ?? ''} onChange={(event) => updateValue(optionIndex, valueIndex, 'mockupUrl', event.target.value)} placeholder="/mockups/taza-magica.png" className="w-full min-w-0 rounded border px-2.5 py-1.5 text-xs" /></label>
                <div className="flex justify-center pt-2 md:col-span-1 md:pt-0"><button type="button" onClick={() => updateOption(optionIndex, { values: option.values.filter((_, index) => index !== valueIndex) })} disabled={option.values.length === 1} className="rounded p-1 text-red-500 hover:text-red-700 disabled:opacity-30" title="Eliminar valor" aria-label="Eliminar valor"><Trash2 size={16} /></button></div>
                <label className="flex items-center gap-2 md:col-span-12"><input type="checkbox" checked={Boolean(value.printArea)} onChange={(event) => setPrintAreaEnabled(optionIndex, valueIndex, event.target.checked)} /><span className="text-xs font-medium text-gray-600">Usar zona segura específica para este valor</span></label>
                {printArea && <><div className="md:col-span-12"><MockupAreaPicker mockupUrl={value.mockupUrl} initialPrintArea={printArea} onChange={(area) => updatePrintArea(optionIndex, valueIndex, area)} /></div><div className="grid grid-cols-2 gap-2 md:col-span-12 md:grid-cols-4">{(['x', 'y', 'width', 'height'] as const).map((field) => <label key={field} className="grid gap-0.5"><span className="text-[10px] font-semibold text-gray-500">{field === 'x' ? 'Posición X' : field === 'y' ? 'Posición Y' : field === 'width' ? 'Ancho' : 'Alto'} (%)</span><input type="number" min="0" max="100" step="0.01" value={printArea[field]} onChange={(event) => updatePrintArea(optionIndex, valueIndex, { ...printArea, [field]: Number(event.target.value) || 0 })} className="w-full min-w-0 rounded border px-2.5 py-1.5 text-xs" /></label>)}</div></>}
              </div>
              );
            })}
          </div>
          <button type="button" onClick={() => updateOption(optionIndex, { values: [...option.values, newValue()] })} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"><Plus size={15} />Agregar valor</button>
        </fieldset>
      ))}
      <button type="button" onClick={() => onChange([...options, newOption()])} className="inline-flex items-center gap-2 rounded-md border border-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-700"><Plus size={16} />Agregar opción</button>
    </section>
  );
}
