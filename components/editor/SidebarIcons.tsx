'use client';

import { useRef } from 'react';
import { Edit3, Upload, ImageIcon, Sparkles, SlidersHorizontal } from 'lucide-react';

interface SidebarIconsProps {
  onAddImage?: (dataUrl: string) => void;
  onOpenOptions?: () => void;
}

export default function SidebarIcons({ onAddImage, onOpenOptions }: SidebarIconsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (fEvent) => {
        const dataUrl = fEvent.target?.result; // Esto es una cadena Base64
        if (dataUrl) {
          window.dispatchEvent(new CustomEvent('editor:add-image', {
            detail: { dataUrl: dataUrl },
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const actions = [
    { label: 'Editar', icon: Edit3, action: () => {} },
    { label: 'Archivos subidos', icon: Upload, action: handleUploadClick },
    { label: 'Fondo', icon: ImageIcon, action: () => {} },
    { label: 'Decora', icon: Sparkles, action: () => {} },
    { label: 'Opciones', icon: SlidersHorizontal, action: onOpenOptions ?? (() => {}) },
  ];

  return (
    <>
      <aside className="hidden xl:flex xl:w-20 xl:flex-col xl:items-center xl:gap-4 xl:rounded-3xl xl:border xl:border-slate-200 xl:bg-white xl:px-3 xl:py-4 xl:shadow-sm">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className="inline-flex h-14 w-14 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              type="button"
              onClick={item.action}
            >
              <Icon size={20} />
              <span className="sr-only">{item.label}</span>
            </button>
          );
        })}
      </aside>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
    </>
  );
}
