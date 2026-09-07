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
  Check,
  Eraser,
  Scissors,
  X,
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
  const [isImageObject, setIsImageObject] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('transparent');
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
        setIsImageObject(false);
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
      setIsImageObject(isImage);

      // Actualizar estilos con valores seguros
      setStyle({
        fill: selectedObject.fill ?? '#000000',
        fontFamily: selectedObject.fontFamily ?? 'Arial',
        fontSize: selectedObject.fontSize ?? 24,
        isText: isText,
        isImage: isImage,
      });
    };

    const handleCropMode = () => setIsCropping(true);
    const handleCropEnd = () => setIsCropping(false);
    window.addEventListener('editor:selection-changed', handleSelectionChanged);
    window.addEventListener('editor:crop-mode-active', handleCropMode);
    window.addEventListener('editor:crop-mode-inactive', handleCropEnd);

    return () => {
      window.removeEventListener('editor:selection-changed', handleSelectionChanged);
      window.removeEventListener('editor:crop-mode-active', handleCropMode);
      window.removeEventListener('editor:crop-mode-inactive', handleCropEnd);
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

  const changeBackground = (color: string) => {
    setBackgroundColor(color);
    window.dispatchEvent(new CustomEvent('editor:design-background', { detail: { color } }));
  };

  if (!isVisible) {
    return null;
  }

  return (
    // Barra de herramientas contextual de ancho completo, fija justo debajo de
    // la barra de navegación principal. NO ocupa espacio del lienzo ni lo tapa:
    // es una franja horizontal blanca independiente que libera por completo el
    // área visual sobre el producto. Siempre presente (aunque deshabilitada por
    // defecto en los controles internos si no hay selección activa).
    <div className="w-full bg-white border-b border-slate-200 h-12 px-6 flex items-center gap-4">
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

      <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
        <span className="text-xs font-semibold text-slate-500">Fondo</span>
        {['transparent', '#000000', '#ffffff', '#2d4a3e', '#1e3a8a', '#e11d48'].map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color === 'transparent' ? 'Fondo transparente' : `Fondo ${color}`}
            title={color === 'transparent' ? 'Fondo transparente' : `Fondo ${color}`}
            onClick={() => changeBackground(color)}
            className={`h-6 w-6 rounded-md border ${backgroundColor === color ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
            style={{ background: color === 'transparent' ? 'linear-gradient(135deg, #fff 45%, #ef4444 46%, #ef4444 54%, #fff 55%)' : color }}
          />
        ))}
        <input type="color" aria-label="Elegir fondo personalizado" value={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor} onChange={(event) => changeBackground(event.target.value)} className="h-6 w-6 cursor-pointer rounded-md border-0 p-0" />
      </div>

      {isImageObject && !isCropping && (
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('editor:start-crop'))} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
          <Scissors size={15} /> Recortar
        </button>
      )}

      {isCropping && (
        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('editor:confirm-crop'))} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><Check size={15} />Confirmar</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('editor:cancel-crop'))} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><X size={15} />Cancelar</button>
          <button type="button" title="Limpiar recorte" aria-label="Limpiar recorte" onClick={() => window.dispatchEvent(new CustomEvent('editor:reset-crop'))} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"><Eraser size={15} /></button>
        </div>
      )}

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
