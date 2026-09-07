'use client';

import { useRef } from 'react';
import { Edit3, Upload, ImageIcon, Sparkles } from 'lucide-react';

interface SidebarIconsProps {}

export default function SidebarIcons({ }: SidebarIconsProps) {
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
  ];

  return (
    <>
      <aside className="hidden min-h-0 xl:flex xl:w-[72px] xl:flex-col xl:items-center xl:gap-3 xl:rounded-[22px] xl:border xl:border-slate-200/80 xl:bg-white xl:px-2 xl:py-3 xl:shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className="inline-flex h-12 w-12 flex-col items-center justify-center rounded-2xl border border-transparent bg-slate-50 text-slate-600 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-950"
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
