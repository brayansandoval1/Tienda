'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, LockKeyhole, Minus, Plus, ShoppingBag, Sparkles, Trash2, Truck, X } from 'lucide-react';
import { useCartStore } from '@/src/store/useCartStore';

const money = (amount: number) => `$${amount.toFixed(2)}`;

export default function CartDrawer() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const openCart = () => setIsOpen(true);
    window.addEventListener('editor:cart-item-ready', openCart);
    window.addEventListener('store:open-cart', openCart);
    return () => {
      window.removeEventListener('editor:cart-item-ready', openCart);
      window.removeEventListener('store:open-cart', openCart);
    };
  }, []);

  if (!isOpen) return null;

  const total = items.reduce((sum, item) => sum + (item.totalPrice ?? item.price * item.design.quantity), 0);
  const count = items.reduce((sum, item) => sum + item.design.quantity, 0);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-violet-950/15 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Carrito de compras">
      <button type="button" className="flex-1 cursor-default" aria-label="Cerrar carrito" onClick={() => setIsOpen(false)} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-white/80 bg-[#fdfbff]/95 text-slate-800 shadow-[-30px_0_80px_rgba(109,88,150,.18)] backdrop-blur-2xl">
        <header className="flex items-center justify-between border-b border-violet-100 px-5 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-600"><ShoppingBag size={16} /></span>
              <h2 className="text-base font-semibold tracking-[-.03em]">Tu selección</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">{count ? `${count} pieza${count === 1 ? '' : 's'} personalizada${count === 1 ? '' : 's'}` : 'Tu próxima pieza única empieza aquí.'}</p>
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl border border-violet-100 bg-white p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-700" aria-label="Cerrar carrito"><X size={17} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length > 0 && <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-medium text-emerald-700"><CheckCircle2 size={16} /> Tu render HD está listo para producción.</div>}
          {items.length === 0 ? (
            <div className="py-20 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-500"><Sparkles size={22} /></span>
              <p className="mt-5 font-semibold text-slate-700">Aún no hay piezas aquí</p>
              <p className="mx-auto mt-2 max-w-[220px] text-sm leading-6 text-slate-400">Explora el catálogo y crea algo que sea completamente tuyo.</p>
              <button type="button" onClick={() => setIsOpen(false)} className="mt-6 rounded-xl bg-violet-100 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-200">Explorar productos</button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const preview = item.design.views[0]?.files.previewImage || item.design.views[0]?.preview;
                const minimumQuantity = item.minimumQuantity ?? 1;
                const breakdown = item.pricingBreakdown;
                return (
                  <article key={item.id} className="rounded-2xl border border-white bg-white/80 p-3 shadow-sm">
                    <div className="flex gap-3">
                      {preview ? <img src={preview} alt={`Diseño de ${item.design.product.name}`} className="h-20 w-20 rounded-xl border border-violet-100 bg-violet-50 object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-xl bg-violet-50 text-violet-400"><Sparkles size={18} /></div>}
                      <div className="min-w-0 flex-1">
                        <div className="flex gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.design.product.name}</p>
                          <button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 transition hover:text-rose-500" aria-label="Eliminar producto"><Trash2 size={15} /></button>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">Render personalizado · HD</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-lg border border-violet-100 bg-violet-50">
                            <button type="button" disabled={item.design.quantity <= minimumQuantity} onClick={() => updateQuantity(item.id, item.design.quantity - 1)} className="p-1.5 text-slate-500 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Reducir cantidad"><Minus size={13} /></button>
                            <span className="w-8 text-center text-xs font-semibold">{item.design.quantity}</span>
                            <button type="button" onClick={() => updateQuantity(item.id, item.design.quantity + 1)} className="p-1.5 text-slate-500 hover:text-violet-700" aria-label="Aumentar cantidad"><Plus size={13} /></button>
                          </div>
                          <p className="text-sm font-semibold text-violet-600">{money(item.totalPrice ?? item.price * item.design.quantity)}</p>
                        </div>
                        {minimumQuantity > 1 && <p className="mt-1 text-right text-[10px] text-slate-400">Mínimo {minimumQuantity} piezas</p>}
                      </div>
                    </div>
                    {breakdown && (
                      <details className="mt-3 border-t border-violet-100 pt-2.5">
                        <summary className="cursor-pointer text-xs font-semibold text-violet-700">Ver desglose del precio</summary>
                        <dl className="mt-2 space-y-1.5 text-[11px] text-slate-500">
                          <div className="flex justify-between gap-3"><dt>Precio unitario base</dt><dd>{money(breakdown.unitBasePrice)}</dd></div>
                          {breakdown.variantDelta !== 0 && <div className="flex justify-between gap-3"><dt>Variante</dt><dd>{breakdown.variantDelta > 0 ? '+' : ''}{money(breakdown.variantDelta)}</dd></div>}
                          {breakdown.sidesCost > 0 && <div className="flex justify-between gap-3"><dt>{breakdown.fullWrapUsed ? 'Cobertura completa 360°' : 'Impresión en caras adicionales'}</dt><dd>+{money(breakdown.sidesCost)}</dd></div>}
                          {breakdown.addonsCost > 0 && <div className="flex justify-between gap-3"><dt>Acabados y extras</dt><dd>+{money(breakdown.addonsCost)}</dd></div>}
                          <div className="flex justify-between gap-3 border-t border-violet-50 pt-1.5"><dt>Subtotal unitario</dt><dd>{money(breakdown.unitSubtotal)}</dd></div>
                          {breakdown.discountPercentage > 0 && <div className="flex justify-between gap-3 text-emerald-700"><dt>Descuento por volumen ({breakdown.discountPercentage}%)</dt><dd>−{money(breakdown.discountPerUnit * breakdown.quantity)}</dd></div>}
                          <div className="flex justify-between gap-3"><dt>Precio unitario con descuento</dt><dd>{money(breakdown.discountedUnitPrice)}</dd></div>
                          {breakdown.setupFee > 0 && <div className="flex justify-between gap-3"><dt>Cargo fijo de preparación</dt><dd>+{money(breakdown.setupFee)}</dd></div>}
                          <div className="flex justify-between gap-3 border-t border-violet-100 pt-1.5 font-semibold text-slate-700"><dt>Total del pedido ({breakdown.quantity} pzas.)</dt><dd>{money(breakdown.grandTotal)}</dd></div>
                        </dl>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="border-t border-violet-100 bg-white/65 p-5">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs text-violet-700"><Truck size={15} /><span><strong>Envío express gratis</strong> en pedidos superiores a $49.</span></div>
          <div className="mb-4 flex items-center justify-between"><span className="text-sm text-slate-500">Total estimado</span><span className="text-xl font-semibold tracking-[-.04em] text-slate-800">{money(total)}</span></div>
          <a href="/envio" className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3.5 text-sm font-bold text-white transition ${items.length ? 'hover:brightness-110 hover:shadow-lg hover:shadow-purple-200' : 'pointer-events-none opacity-40'}`}>Finalizar compra <LockKeyhole size={15} /></a>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400"><LockKeyhole size={11} /> Pago seguro y protegido</p>
        </footer>
      </aside>
    </div>
  );
}
