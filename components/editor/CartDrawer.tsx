'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Minus, Plus, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import Link from 'next/link';
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

  const total = items.reduce((sum, item) => sum + (item.kind === 'catalog' ? item.totalPrice : item.totalPrice ?? item.price * item.design.quantity), 0);
  const count = items.reduce((sum, item) => sum + (item.kind === 'catalog' ? item.quantity : item.design.quantity), 0);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-2 backdrop-blur-sm sm:p-5 lg:p-8" role="dialog" aria-modal="true" aria-label="Tu carrito">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar carrito" onClick={() => setIsOpen(false)} />
      <section className="relative flex h-[min(94vh,900px)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/80 bg-[#fcfbff] text-slate-800 shadow-2xl sm:rounded-3xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-8 sm:py-5">
          <div><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="text-2xl font-semibold tracking-[-.05em] text-slate-900 sm:text-3xl">Tu carrito</h2><span className="text-sm text-slate-500">{count} {count === 1 ? 'artículo' : 'artículos'}</span></div><p className="mt-1 text-xs text-slate-500">Puedes continuar como invitado; no necesitas crear un perfil.</p></div>
          <button type="button" onClick={() => setIsOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" aria-label="Cerrar carrito"><X size={19} /></button>
        </header>

        {items.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center px-6 text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-violet-100 text-violet-600"><ShoppingBag size={26} /></span><h3 className="mt-5 text-xl font-semibold text-slate-900">Tu carrito está vacío</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Explora el catálogo para encontrar un producto o empieza a personalizar una pieza única.</p><Link href="/#catalogo" onClick={() => setIsOpen(false)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700">Explorar catálogo <ShoppingBag size={16} /></Link></div> : <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_350px] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-xs font-medium text-emerald-800"><CheckCircle2 size={16} className="shrink-0" /> Tu selección está lista para revisar.</div>
            <div className="divide-y divide-slate-200">{items.map((item) => {
              const isCatalogItem = item.kind === 'catalog';
              const preview = isCatalogItem ? item.imageUrl : item.design.views[0]?.files.previewImage || item.design.views[0]?.preview;
              const productName = isCatalogItem ? item.productName : item.design.product.name;
              const quantity = isCatalogItem ? item.quantity : item.design.quantity;
              const minimumQuantity = item.minimumQuantity ?? 1;
              const lineTotal = isCatalogItem ? item.totalPrice : item.totalPrice ?? item.price * quantity;
              const breakdown = isCatalogItem ? undefined : item.pricingBreakdown;
              return <article key={item.id} className="py-5 first:pt-2 last:pb-2">
                <div className="flex flex-col gap-4 sm:flex-row">
                  {preview ? <img src={preview} alt={`Vista previa de ${productName}`} className="h-28 w-full rounded-xl border border-slate-100 bg-white object-contain p-2 sm:h-32 sm:w-36 sm:shrink-0" /> : <div className="grid h-28 w-full place-items-center rounded-xl bg-violet-50 text-violet-400 sm:h-32 sm:w-36 sm:shrink-0"><Sparkles size={24} /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-violet-600">{isCatalogItem ? 'Producto del catálogo' : 'Diseño personalizado'}</p><h3 className="mt-1 text-base font-semibold leading-6 text-slate-900">{productName}</h3></div><button type="button" onClick={() => removeItem(item.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label={`Eliminar ${productName}`} title="Eliminar"><Trash2 size={16} /></button></div>
                    {isCatalogItem && item.selectedOptions?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{item.selectedOptions.map((option) => <span key={option.optionId} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">{option.optionName}: {option.valueLabel}</span>)}</div> : null}
                    {isCatalogItem && item.selectedColors?.length ? <div className="mt-2 flex flex-wrap gap-2">{item.selectedColors.map((part) => <span key={part.meshName} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: part.color }} />{part.label}</span>)}</div> : null}
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] text-slate-500">Cantidad</p><div className="mt-1 inline-flex items-center rounded-lg border border-slate-200 bg-white"><button type="button" disabled={quantity <= minimumQuantity} onClick={() => updateQuantity(item.id, quantity - 1)} className="p-2 text-slate-500 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Reducir cantidad de ${productName}`}><Minus size={14} /></button><span className="min-w-8 text-center text-sm font-semibold">{quantity}</span><button type="button" onClick={() => updateQuantity(item.id, quantity + 1)} className="p-2 text-slate-500 hover:text-violet-700" aria-label={`Aumentar cantidad de ${productName}`}><Plus size={14} /></button></div>{minimumQuantity > 1 && <p className="mt-1 text-[10px] text-slate-400">Mínimo {minimumQuantity} piezas</p>}</div><div className="text-right"><p className="text-[11px] text-slate-500">Total del artículo</p><p className="mt-1 text-lg font-semibold text-slate-900">{money(lineTotal)}</p></div></div>
                    {breakdown && <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-violet-700">Ver desglose del precio</summary><dl className="mt-2 space-y-1 text-[11px] text-slate-500"><div className="flex justify-between gap-3"><dt>Precio base unitario</dt><dd>{money(breakdown.unitBasePrice)}</dd></div>{breakdown.variantDelta !== 0 && <div className="flex justify-between gap-3"><dt>Variante</dt><dd>{breakdown.variantDelta > 0 ? '+' : ''}{money(breakdown.variantDelta)}</dd></div>}{breakdown.sidesCost > 0 && <div className="flex justify-between gap-3"><dt>{breakdown.fullWrapUsed ? 'Cobertura completa 360°' : 'Caras adicionales'}</dt><dd>+{money(breakdown.sidesCost)}</dd></div>}{breakdown.addonsCost > 0 && <div className="flex justify-between gap-3"><dt>Acabados y extras</dt><dd>+{money(breakdown.addonsCost)}</dd></div>}{breakdown.discountPercentage > 0 && <div className="flex justify-between gap-3 text-emerald-700"><dt>Descuento por volumen ({breakdown.discountPercentage}%)</dt><dd>−{money(breakdown.discountPerUnit * breakdown.quantity)}</dd></div>}{breakdown.setupFee > 0 && <div className="flex justify-between gap-3"><dt>Preparación</dt><dd>+{money(breakdown.setupFee)}</dd></div>}<div className="flex justify-between gap-3 border-t border-slate-100 pt-1 font-semibold text-slate-700"><dt>Total del pedido</dt><dd>{money(breakdown.grandTotal)}</dd></div></dl></details>}
                  </div>
                </div>
              </article>;
            })}</div>
            <Link href="/#catalogo" onClick={() => setIsOpen(false)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900">Seguir explorando <span aria-hidden="true">→</span></Link>
          </div>

          <aside className="flex flex-col border-t border-slate-200 bg-white p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Resumen</p><h3 className="mt-1 text-xl font-semibold text-slate-900">Tu pedido</h3></div>
            <div className="mt-6 space-y-3 border-b border-slate-100 pb-5 text-sm"><div className="flex justify-between gap-4 text-slate-600"><span>Subtotal ({count} {count === 1 ? 'artículo' : 'artículos'})</span><span className="font-semibold text-slate-900">{money(total)}</span></div><div className="flex justify-between gap-4 text-slate-500"><span>Envío</span><span>Se calcula después</span></div></div>
            <div className="mt-5 flex items-baseline justify-between gap-4"><span className="text-sm font-semibold text-slate-700">Total estimado</span><span className="text-2xl font-bold tracking-tight text-slate-900">{money(total)}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">El envío y cualquier costo adicional se mostrarán antes de confirmar.</p>
            <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50/70 p-3.5"><p className="text-xs font-semibold text-violet-900">Compra como invitado</p><p className="mt-1 text-xs leading-5 text-violet-800/80">No necesitas crear un perfil para continuar con tu compra.</p></div>
            <a href="/envio" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition hover:brightness-110">Continuar <ArrowRight size={15} /></a>
            <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">Los métodos de pago se mostrarán cuando estén configurados.</p>
          </aside>
        </div>}
      </section>
    </div>
  );
}
