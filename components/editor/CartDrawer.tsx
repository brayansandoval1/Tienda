'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ShoppingCart, X } from 'lucide-react';
import { useCartStore } from '@/src/store/useCartStore';

/** Confirmación visible del carrito; se abre al terminar la exportación. */
export default function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openCart = () => setIsOpen(true);
    window.addEventListener('editor:cart-item-ready', openCart);
    return () => window.removeEventListener('editor:cart-item-ready', openCart);
  }, []);

  if (!isOpen) return null;

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/30" role="dialog" aria-modal="true" aria-label="Carrito de compras">
      <button type="button" className="flex-1 cursor-default" aria-label="Cerrar carrito" onClick={() => setIsOpen(false)} />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 text-slate-900">
            <ShoppingCart size={20} />
            <h2 className="text-lg font-bold">Carrito ({items.length})</h2>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar carrito">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={18} /> Diseño personalizado añadido al carrito.
          </div>
          <div className="space-y-3">
            {items.map((item) => {
              const preview = item.design.views[0]?.files.previewImage || item.design.views[0]?.preview;
              return (
                <article key={item.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                  {preview && <img src={preview} alt={`Diseño de ${item.design.product.name}`} className="h-20 w-20 rounded-lg bg-slate-100 object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{item.design.product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">Diseño personalizado · {item.design.views.length} vista{item.design.views.length === 1 ? '' : 's'}</p>
                    <p className="mt-2 font-bold text-slate-900">${item.price.toFixed(2)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="border-t border-slate-200 p-5">
          <div className="mb-4 flex items-center justify-between text-base font-bold text-slate-900">
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
          <a href="/envio" className="block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800">
            Continuar al pago
          </a>
          <button type="button" onClick={() => setIsOpen(false)} className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Seguir diseñando
          </button>
        </footer>
      </aside>
    </div>
  );
}
