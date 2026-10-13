'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

export default function SurpriseGiftImageField({ value, onChange }: { value?: string; onChange: (imageUrl: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen.');
      return;
    }
    try {
      const image = new Image();
      image.src = URL.createObjectURL(file);
      await image.decode();
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo procesar la imagen.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      onChange(canvas.toDataURL('image/webp', 0.78));
      URL.revokeObjectURL(image.src);
      setError('');
    } catch {
      setError('No se pudo leer la imagen. Prueba con JPG, PNG o WebP.');
    }
  };

  return <div className="flex items-center gap-1.5">
    <button type="button" onClick={() => inputRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-400" aria-label={value ? 'Cambiar imagen' : 'Agregar imagen'}>
      {value ? <img src={value} alt="Vista previa" className="h-full w-full object-contain" /> : <ImagePlus size={17} />}
    </button>
    <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ''; }} />
    {error && <p role="alert" className="max-w-28 text-[9px] text-rose-600">{error}</p>}
    {value && <button type="button" onClick={() => onChange('')} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Quitar imagen"><Trash2 size={14} /></button>}
  </div>;
}
