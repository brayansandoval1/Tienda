'use client';

import { useState, useEffect } from 'react';
import { GOOGLE_FONTS } from '../../lib/fonts';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignEndVertical,
} from 'lucide-react';

interface ObjectStyle {
  fill: string;
  fontFamily?: string;
  fontSize?: number;
  isText: boolean;
  isImage: boolean;
}

export default function TextToolbar() {
  const [isVisible, setIsVisible] = useState(false);
  const [isTextObject, setIsTextObject] = useState(false);
  const [style, setStyle] = useState<ObjectStyle>({
    fill: '#000000',
    fontFamily: 'Arial',
    fontSize: 24,
    isText: false,
    isImage: false,
  });

  useEffect(() => {
    const handleSelectionChanged = (e: Event) => {
      // Protección completa contra null/undefined
      const customEvent = e as CustomEvent<any>;
      const detail = customEvent?.detail || {};
      const selectedObject = detail.selectedObject;

      if (!selectedObject) {
        setIsVisible(false);
        setIsTextObject(false);
        return;
      }

      setIsVisible(true);
      
      // Ignorar overlay de recorte
      if (selectedObject.isCropOverlay) {
        setIsVisible(false);
        return;
      }

      // Asegurar que el selector de color esté VISIBLE para grupos/iconos SVG
      if (selectedObject.type === 'group' || selectedObject.type === 'path') {
        setIsVisible(true);
      }

      // Verificar tipo de objeto
      const isText = selectedObject.type === 'i-text' || selectedObject.type === 'text';
      const isImage = selectedObject.type === 'image';
      setIsTextObject(isText);

      // Actualizar estilos con valores seguros
      setStyle({
        fill: selectedObject.fill ?? '#000000',
        fontFamily: selectedObject.fontFamily ?? 'Arial',
        fontSize: selectedObject.fontSize ?? 24,
        isText: isText,
        isImage: isImage,
      });
    };

    window.addEventListener('editor:selection-changed', handleSelectionChanged);

    return () => {
      window.removeEventListener('editor:selection-changed', handleSelectionChanged);
    };
  }, []);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setStyle((prev) => ({ ...prev, fill: newColor }));
    window.dispatchEvent(new CustomEvent('editor:change-color', { detail: { color: newColor } }));
  };

  const handleColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setStyle((prev) => ({ ...prev, fill: newColor }));
    window.dispatchEvent(new CustomEvent('editor:change-color', { detail: { color: newColor } }));
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFont = e.target.value;
    setStyle((prev) => ({ ...prev, fontFamily: newFont }));
    window.dispatchEvent(new CustomEvent('editor:change-font', { detail: { fontFamily: newFont } }));
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value, 10);
    setStyle((prev) => ({ ...prev, fontSize: newSize }));
    window.dispatchEvent(new CustomEvent('editor:change-fontSize', { detail: { fontSize: newSize } }));
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-700">
        <label className="text-sm font-semibold text-slate-600">Color</label>
        <input
          type="color"
          value={style.fill}
          onChange={handleColorChange}
          onInput={handleColorInput}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white"
        />
      </div>

      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        <span className="px-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Alinear</span>
        {[
          { alignment: 'center-h', icon: AlignCenterHorizontal, title: 'Centrar horizontalmente' },
          { alignment: 'center-v', icon: AlignCenterVertical, title: 'Centrar verticalmente' },
          { alignment: 'center-both', icon: AlignCenter, title: 'Centrar (ambos ejes)' },
          { alignment: 'left', icon: AlignLeft, title: 'Alinear a la izquierda' },
          { alignment: 'right', icon: AlignRight, title: 'Alinear a la derecha' },
          { alignment: 'top', icon: AlignStartVertical, title: 'Alinear arriba' },
          { alignment: 'bottom', icon: AlignEndVertical, title: 'Alinear abajo' },
        ].map(({ alignment, icon: Icon, title }) => (
          <button
            key={alignment}
            type="button"
            title={title}
            aria-label={title}
            onClick={() =>
              window.dispatchEvent(new CustomEvent('editor:align', { detail: { alignment } }))
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white hover:text-slate-900 hover:shadow-sm"
          >
            <Icon size={17} />
          </button>
        ))}
      </div>

      {isTextObject && (
        <>
          <div className="flex items-center gap-2 text-slate-700">
            <label className="text-sm font-semibold text-slate-600">Tamaño</label>
            <input
              type="number"
              value={style.fontSize || 24}
              min={12}
              max={96}
              onChange={handleFontSizeChange}
              className="w-20 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <label className="text-sm font-semibold text-slate-600">Fuente</label>
            <select value={style.fontFamily || 'Arial'} onChange={handleFontChange} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
              {GOOGLE_FONTS.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}