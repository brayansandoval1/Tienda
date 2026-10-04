'use client';

import MockupAreaPicker, { type PrintArea } from '@/components/admin/MockupAreaPicker';

/** Editor nodal para una cara individual de la faja UV desplegada. */
export default function PrintArea3DEditor({ viewName, area, aspectRatio, mockupUrl, onChange }: {
  viewName: string;
  area: PrintArea;
  aspectRatio: number;
  mockupUrl?: string;
  onChange: (area: PrintArea) => void;
}) {
  return <section className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold text-sky-900">Faja 3D desplegada · {viewName}</p>
      <span className="rounded bg-white px-2 py-0.5 text-[10px] font-medium text-sky-700">UV por vista</span>
    </div>
    <MockupAreaPicker
      mockupUrl={mockupUrl}
      imageOpacity={mockupUrl ? 0.35 : 1}
      initialPrintArea={area}
      onChange={onChange}
      aspectRatio={aspectRatio}
      fallbackLabel="Superficie UV plana: edita aquí los nodos que se envolverán sobre el termo."
      hideShapeControls
    />
  </section>;
}
