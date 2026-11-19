'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bell, ChevronDown, Heart, Menu, PackageCheck, ShoppingBag, Sparkles, UserRound, X } from 'lucide-react';
import { useCartStore } from '@/src/store/useCartStore';

export default function StorefrontHeader() {
  const itemCount = useCartStore((state) => state.items.reduce((total, item) => total + (item.kind === 'catalog' ? item.quantity : item.design.quantity), 0));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const selectProfileTab = (tab: string) => {
    setProfileOpen(false);
    window.dispatchEvent(new CustomEvent('profile:select-tab', { detail: { tab } }));
  };

  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);

  return <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
    <div className="pointer-events-auto mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl border border-white/70 bg-white/65 px-3 shadow-[0_12px_32px_rgba(109,88,150,.12)] backdrop-blur-xl sm:h-16 sm:px-4">
      <Link href="/" className="group flex items-center gap-2.5 font-bold tracking-[-.04em] text-slate-800"><span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-400 via-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-300/50 transition-transform duration-300 group-hover:rotate-12"><Sparkles size={16} /></span><span className="text-lg">Style<span className="text-violet-600">Cute</span></span></Link>
      <nav className="hidden items-center gap-5 text-sm font-medium text-slate-500 lg:flex"><Link href="/#catalogo" className="transition hover:text-violet-700">Catálogo</Link><Link href="/regalos-sorpresa" className="font-semibold text-violet-600 transition hover:text-violet-800">Cajas sorpresa</Link><Link href="/#como-funciona" className="transition hover:text-violet-700">Cómo funciona</Link><Link href="/#inspiracion" className="transition hover:text-violet-700">Inspiración</Link><Link href="/#perfil" className="transition hover:text-violet-700">Mi perfil</Link></nav>
      <div className="flex items-center gap-1.5">
        <div ref={notificationRef} className="relative">
          <button type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notificaciones" aria-expanded={notificationsOpen} aria-haspopup="dialog" className={`relative grid h-9 w-9 place-items-center rounded-xl border transition sm:h-10 sm:w-10 ${notificationsOpen ? 'border-violet-200 bg-violet-100 text-violet-700' : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}><Bell size={18} /></button>
          {notificationsOpen && <section role="dialog" aria-label="Notificaciones" className="absolute right-0 top-full z-[80] mt-3 w-[min(90vw,370px)] overflow-hidden rounded-2xl border border-violet-100 bg-white text-left shadow-[0_24px_70px_rgba(49,38,79,.22)]">
            <div className="flex items-start justify-between border-b border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Bell size={18} /></span><div><h2 className="text-sm font-semibold text-slate-900">Notificaciones</h2><p className="mt-0.5 text-xs text-slate-500">Novedades de tu espacio StyleCute</p></div></div><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Cerrar notificaciones" className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"><X size={16} /></button></div>
            <div className="p-5"><div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-violet-50 text-2xl">👋</span><h3 className="mt-3 text-base font-semibold text-slate-900">¡Te damos la bienvenida!</h3><p className="mt-2 text-sm leading-6 text-slate-600">Aquí recibirás actualizaciones de tus pedidos, productos favoritos, diseños guardados y otras novedades.</p><p className="mt-3 text-xs font-medium text-slate-500">Por ahora no tienes notificaciones nuevas.</p></div>
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/70 p-3.5"><p className="text-xs font-semibold text-amber-900">Consejo</p><p className="mt-1 text-xs leading-5 text-amber-800">Guarda productos con el corazón para encontrarlos después en <Link href="/perfil" onClick={() => setNotificationsOpen(false)} className="font-semibold underline underline-offset-2">Mi perfil</Link>.</p></div>
              <p className="mt-4 text-center text-[10px] leading-4 text-slate-400">Las alertas de pedidos estarán disponibles cuando se active el seguimiento de compras.</p>
            </div>
          </section>}
        </div>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('store:open-cart'))} className="relative inline-flex h-9 items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/80 px-2.5 text-sm font-semibold text-slate-700 transition hover:bg-violet-100 sm:h-10 sm:px-3" aria-label={`Abrir carrito, ${itemCount} productos`}><ShoppingBag size={17} /><span className="hidden sm:inline">Carrito</span>{itemCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">{itemCount}</span>}</button>
        <div ref={profileRef} className="relative hidden sm:block">
          <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-label="Abrir menú de perfil" aria-expanded={profileOpen} aria-haspopup="menu" className={`inline-flex h-10 items-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition sm:px-3 ${profileOpen ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-violet-100 bg-white/80 text-violet-700 hover:bg-violet-50'}`}><span className="grid h-6 w-6 place-items-center rounded-full bg-violet-100"><UserRound size={14} /></span><span className="text-left"><span className="block leading-4">Invitado</span><span className="hidden text-[9px] font-medium text-slate-500 sm:block">Mi perfil</span></span><ChevronDown size={13} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} /></button>
          {profileOpen && <div role="menu" aria-label="Opciones de perfil" className="absolute right-0 top-full z-[80] mt-3 w-64 overflow-hidden rounded-2xl border border-violet-100 bg-white p-2 text-left shadow-[0_24px_70px_rgba(49,38,79,.2)]">
            <div className="rounded-xl bg-violet-50/80 px-3 py-3"><p className="text-sm font-semibold text-slate-900">Hola, Invitado</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">El perfil será opcional. Aún no hay una cuenta conectada.</p></div>
            <Link role="menuitem" href="/perfil?tab=overview" onClick={() => selectProfileTab('overview')} className="mt-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-violet-50"><span className="flex items-center gap-2"><UserRound size={15} />Mi perfil</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">Pronto</span></Link>
            <Link role="menuitem" href="/perfil?tab=favorites" onClick={() => selectProfileTab('favorites')} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-violet-50"><Heart size={15} className="text-rose-500" />Mis favoritos</Link>
            <Link role="menuitem" href="/perfil?tab=orders" onClick={() => selectProfileTab('orders')} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-violet-50"><PackageCheck size={15} className="text-violet-600" />Mis pedidos</Link>
            <Link role="menuitem" href="/perfil?tab=details" onClick={() => selectProfileTab('details')} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-violet-50"><UserRound size={15} className="text-sky-600" />Mis datos</Link>
          </div>}
        </div>
        <Link href="/regalos-sorpresa" className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-800 px-2 text-[10px] font-bold text-white transition hover:bg-violet-600 sm:h-10 sm:px-3 sm:text-xs lg:hidden">Cajas sorpresa <ArrowUpRight size={14} /></Link>
        <Link href="/#catalogo" className="hidden h-10 items-center gap-1 rounded-xl bg-slate-800 px-3 text-xs font-bold text-white transition hover:bg-violet-600 lg:inline-flex">Crear <ArrowUpRight size={14} /></Link>
        <button type="button" className="rounded-lg p-2 text-slate-600 md:hidden" aria-label="Abrir menú"><Menu size={19} /></button>
      </div>
    </div>
  </header>;
}
