'use client';

import { useState, useEffect } from 'react';
// Dropdown "Fuente" del toolbar: se pinta desde el catálogo completo
// (lib/googleFontLibrary.ts) agrupando por estilo para que ~60 familias
// sigan siendo navegables. Agregar una familia allí la añade aquí y en la
// galería del sidebar automáticamente.
import {
  FONT_LIBRARY,
  FONT_STYLE_LABELS,
  type GoogleFontStyle,
} from '@/lib/googleFontLibrary';

const FONT_GROUP_ORDER: GoogleFontStyle[] = [
  'sistema',
  'sans',
  'serif',
  'display',
  'script',
  'retro',
  'mono',
];
const FONT_GROUPS = FONT_GROUP_ORDER.map((style) => ({
  style,
  fonts: FONT_LIBRARY.filter((font) => font.style === style),
})).filter((group) => group.fonts.length > 0);

import {
  designBackgroundToCss,
  encodeDesignBackground,
  gradientPresetToBackground,
  GRADIENT_BACKGROUND_PRESETS,
} from './designBackground';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignEndVertical,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AArrowUp,
  AArrowDown,
  Highlighter,
  RemoveFormatting,
  Pencil,
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
  fontWeight?: string | number;
  fontStyle?: string;
  underline?: boolean;
  linethrough?: boolean;
}

export default function TextToolbar({ isPanoramaActive = false, onTogglePanorama, allowPanorama = false }: { isPanoramaActive?: boolean; onTogglePanorama?: () => void; allowPanorama?: boolean }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isTextObject, setIsTextObject] = useState(false);
  const [isImageObject, setIsImageObject] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [drawingMode, setDrawingMode] = useState<'off' | 'draw' | 'erase'>('off');
  const [drawingColor, setDrawingColor] = useState('#1e293b');
  const [drawingWidth, setDrawingWidth] = useState(4);
  const [eraserSize, setEraserSize] = useState<'small' | 'medium' | 'stroke'>('small');
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
        setIsVisible(true);
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
        fontWeight: selectedObject.fontWeight ?? 'normal',
        fontStyle: selectedObject.fontStyle ?? 'normal',
        underline: Boolean(selectedObject.underline),
        linethrough: Boolean(selectedObject.linethrough),
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

  const changeTextFormat = (property: string, value: unknown) => {
    window.dispatchEvent(new CustomEvent('editor:text-format', { detail: { property, value } }));
    setStyle((prev) => ({ ...prev, [property]: value }));
  };

  const adjustFontSize = (delta: number) => {
    const fontSize = Math.min(200, Math.max(8, (style.fontSize || 24) + delta));
    setStyle((prev) => ({ ...prev, fontSize }));
    window.dispatchEvent(new CustomEvent('editor:change-fontSize', { detail: { fontSize } }));
  };

  const clearTextFormatting = () => {
    window.dispatchEvent(new CustomEvent('editor:text-format', {
      detail: { property: 'clear', value: null },
    }));
    setStyle((prev) => ({ ...prev, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', underline: false, linethrough: false }));
  };

  const setDrawingTool = (mode: 'off' | 'draw' | 'erase', size: 'small' | 'medium' | 'stroke' = eraserSize) => {
    setDrawingMode(mode);
    setEraserSize(size);
    window.dispatchEvent(new CustomEvent('editor:drawing-tool', {
      detail: { mode, color: drawingColor, width: drawingWidth, eraserSize: size },
    }));
  };

  const updateDrawingStyle = (next: { color?: string; width?: number }) => {
    const color = next.color ?? drawingColor;
    const width = next.width ?? drawingWidth;
    if (next.color) setDrawingColor(color);
    if (next.width) setDrawingWidth(width);
    if (drawingMode !== 'off') {
      window.dispatchEvent(new CustomEvent('editor:drawing-style', {
        detail: { mode: drawingMode, color, width, eraserSize },
      }));
    }
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
    <div className="w-full min-w-0 overflow-x-auto bg-white border-b border-slate-200 h-12 px-4 flex items-center gap-3">
      <div className="flex shrink-0 items-center gap-1 border-r border-slate-200 pr-3">
        <button type="button" title="Dibujar" aria-label="Activar dibujo libre" aria-pressed={drawingMode === 'draw'} onClick={() => setDrawingTool(drawingMode === 'draw' ? 'off' : 'draw')} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 ${drawingMode === 'draw' ? 'bg-blue-100 text-blue-700' : ''}`}><Pencil size={18} /></button>
        <button type="button" title="Borrador pequeño: elimina solo una sección local del trazo" aria-label="Borrador pequeño" aria-pressed={drawingMode === 'erase' && eraserSize === 'small'} onClick={() => setDrawingTool(drawingMode === 'erase' && eraserSize === 'small' ? 'off' : 'erase', 'small')} className={`inline-flex h-9 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 ${drawingMode === 'erase' && eraserSize === 'small' ? 'bg-blue-100 text-blue-700' : ''}`}><Eraser size={14} /></button>
        <button type="button" title="Borrador mediano: elimina una sección local más amplia" aria-label="Borrador mediano" aria-pressed={drawingMode === 'erase' && eraserSize === 'medium'} onClick={() => setDrawingTool(drawingMode === 'erase' && eraserSize === 'medium' ? 'off' : 'erase', 'medium')} className={`inline-flex h-9 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 ${drawingMode === 'erase' && eraserSize === 'medium' ? 'bg-blue-100 text-blue-700' : ''}`}><Eraser size={19} /></button>
        <button type="button" title="Borrador de trazos: elimina el trazo completo" aria-label="Borrador de trazos" aria-pressed={drawingMode === 'erase' && eraserSize === 'stroke'} onClick={() => setDrawingTool(drawingMode === 'erase' && eraserSize === 'stroke' ? 'off' : 'erase', 'stroke')} className={`inline-flex h-9 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 ${drawingMode === 'erase' && eraserSize === 'stroke' ? 'bg-blue-100 text-blue-700' : ''}`}><Eraser size={17} /></button>
        {drawingMode === 'draw' && <>
          <label title="Color del trazo" className="relative ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-200" style={{ backgroundColor: drawingColor }}><input type="color" aria-label="Color del trazo" value={drawingColor} onChange={(event) => updateDrawingStyle({ color: event.target.value })} className="absolute inset-0 cursor-pointer opacity-0" /></label>
          <select aria-label="Grosor del trazo" value={drawingWidth} onChange={(event) => updateDrawingStyle({ width: Number(event.target.value) })} className="h-8 w-16 rounded-md border border-slate-200 bg-white px-1 text-xs">{[2, 4, 6, 10, 16].map((width) => <option key={width} value={width}>{width}px</option>)}</select>
        </>}
      </div>
      {isTextObject ? (
        <>
          <div className="flex shrink-0 items-center gap-1 border-r border-slate-200 pr-3">
            <button type="button" title="Negrita" aria-label="Negrita" aria-pressed={style.fontWeight === 'bold' || Number(style.fontWeight) >= 600} onClick={() => changeTextFormat('fontWeight', style.fontWeight === 'bold' || Number(style.fontWeight) >= 600 ? 'normal' : 'bold')} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 ${style.fontWeight === 'bold' || Number(style.fontWeight) >= 600 ? 'bg-slate-200' : ''}`}><Bold size={17} /></button>
            <button type="button" title="Cursiva" aria-label="Cursiva" aria-pressed={style.fontStyle === 'italic'} onClick={() => changeTextFormat('fontStyle', style.fontStyle === 'italic' ? 'normal' : 'italic')} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 ${style.fontStyle === 'italic' ? 'bg-slate-200' : ''}`}><Italic size={17} /></button>
            <button type="button" title="Subrayado" aria-label="Subrayado" aria-pressed={style.underline} onClick={() => changeTextFormat('underline', !style.underline)} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 ${style.underline ? 'bg-slate-200' : ''}`}><Underline size={17} /></button>
            <button type="button" title="Tachado" aria-label="Tachado" aria-pressed={style.linethrough} onClick={() => changeTextFormat('linethrough', !style.linethrough)} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 ${style.linethrough ? 'bg-slate-200' : ''}`}><Strikethrough size={17} /></button>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" title="Aumentar tamaño" aria-label="Aumentar tamaño" onClick={() => adjustFontSize(2)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"><AArrowUp size={18} /></button>
            <input type="number" aria-label="Tamaño de fuente" value={style.fontSize || 24} min={8} max={200} onChange={handleFontSizeChange} className="w-[4.25rem] rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500" />
            <button type="button" title="Reducir tamaño" aria-label="Reducir tamaño" onClick={() => adjustFontSize(-2)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"><AArrowDown size={18} /></button>
          </div>
          <select aria-label="Fuente" value={style.fontFamily || 'Arial'} onChange={handleFontChange} className="max-w-40 shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500">
            {!FONT_LIBRARY.some((font) => font.family === style.fontFamily) && <option value={style.fontFamily}>{style.fontFamily}</option>}
            {FONT_GROUPS.map((group) => <optgroup key={group.style} label={FONT_STYLE_LABELS[group.style]}>{group.fonts.map((font) => <option key={font.family} value={font.family}>{font.family}</option>)}</optgroup>)}
          </select>
          <div className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-3">
            <label title="Color del texto" className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-slate-100"><span className="text-sm font-bold text-slate-700">A</span><span className="absolute bottom-1 h-1 w-5 rounded" style={{ backgroundColor: style.fill }} /><input type="color" aria-label="Color del texto" value={/^#[0-9a-f]{6}$/i.test(style.fill) ? style.fill : '#000000'} onChange={handleColorChange} className="absolute inset-0 cursor-pointer opacity-0" /></label>
            <label title="Resaltado" className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-slate-100"><Highlighter size={17} className="text-slate-700" /><input type="color" aria-label="Color de resaltado" defaultValue="#fff176" onChange={(event) => changeTextFormat('textBackgroundColor', event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" /></label>
            <button type="button" title="Quitar formato" aria-label="Quitar formato" onClick={clearTextFormatting} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"><RemoveFormatting size={17} /></button>
          </div>
        </>
      ) : <div className="flex items-center gap-2 text-slate-700">
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
      </div>}

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
        {/* Degradados predefinidos: colorean la Zona Segura del producto
            (mismo evento que los sólidos; viaja la spec serializada). */}
        {GRADIENT_BACKGROUND_PRESETS.slice(0, 5).map((preset) => {
          const spec = gradientPresetToBackground(preset);
          const encoded = encodeDesignBackground(spec);
          return (
            <button
              key={preset.id}
              type="button"
              aria-label={`Fondo degradado ${preset.name}`}
              title={`Degradado ${preset.name}`}
              onClick={() => changeBackground(encoded)}
              className={`h-6 w-6 rounded-md border border-transparent ${backgroundColor === encoded ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
              style={{ background: designBackgroundToCss(spec) }}
            />
          );
        })}
        <input type="color" aria-label="Elegir fondo personalizado" value={/^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : '#ffffff'} onChange={(event) => changeBackground(event.target.value)} className="h-6 w-6 cursor-pointer rounded-md border-0 p-0" />
      </div>

      {allowPanorama && onTogglePanorama && (
        <button
          type="button"
          aria-pressed={isPanoramaActive}
          onClick={onTogglePanorama}
          className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${isPanoramaActive ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          title="Editar todas las vistas en un lienzo horizontal continuo"
        >
          {isPanoramaActive ? 'Volver a vistas individuales' : 'Diseñar lienzo 360°'}
        </button>
      )}

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

    </div>
  );
}
