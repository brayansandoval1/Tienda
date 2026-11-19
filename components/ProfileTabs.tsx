'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bookmark, Clock3, FolderHeart, Heart, MapPin, PackageCheck, Phone, UserRound } from 'lucide-react';
import ProfileFavorites from '@/components/ProfileFavorites';

type ProfileTab = 'overview' | 'favorites' | 'orders' | 'details';

const tabs: Array<{ id: ProfileTab; label: string; icon: typeof Heart }> = [
  { id: 'overview', label: 'Mi perfil', icon: UserRound },
  { id: 'favorites', label: 'Mis favoritos', icon: Heart },
  { id: 'orders', label: 'Mis pedidos', icon: PackageCheck },
  { id: 'details', label: 'Mis datos', icon: UserRound },
];

function OverviewTab({ onNavigate }: { onNavigate: (tab: ProfileTab) => void }) {
  return <section className="space-y-5">
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-rose-50 p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-600">Resumen de tu espacio</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">¡Bienvenido a Mi perfil!</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Desde aquí podrás consultar tus productos favoritos, tus pedidos y tus datos. El perfil todavía es una vista previa y no requiere registro.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <button type="button" onClick={() => onNavigate('favorites')} className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-500"><Heart size={18} /></span><h3 className="mt-4 text-sm font-semibold text-slate-800">Mis favoritos</h3><p className="mt-1 text-xs leading-5 text-slate-500">Vuelve a ver los productos que guardaste.</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">Abrir colección <ArrowRight size={13} /></span></button>
      <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Bookmark size={18} /></span><div className="mt-4 flex items-center gap-2"><h3 className="text-sm font-semibold text-slate-800">Mis diseños guardados</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">Próximamente</span></div><p className="mt-1 text-xs leading-5 text-slate-500">Retoma las personalizaciones que hayas creado y guardado.</p></article>
      <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-fuchsia-50 text-fuchsia-600"><FolderHeart size={18} /></span><div className="mt-4 flex items-center gap-2"><h3 className="text-sm font-semibold text-slate-800">Mis colecciones</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">Próximamente</span></div><p className="mt-1 text-xs leading-5 text-slate-500">Organiza tus diseños favoritos por ocasión o idea.</p></article>
      <button type="button" onClick={() => onNavigate('orders')} className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><PackageCheck size={18} /></span><h3 className="mt-4 text-sm font-semibold text-slate-800">Mis pedidos</h3><p className="mt-1 text-xs leading-5 text-slate-500">La consulta de pedidos estará disponible próximamente.</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">Ver sección <ArrowRight size={13} /></span></button>
      <button type="button" onClick={() => onNavigate('details')} className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600"><UserRound size={18} /></span><h3 className="mt-4 text-sm font-semibold text-slate-800">Mis datos</h3><p className="mt-1 text-xs leading-5 text-slate-500">Cuando se active el perfil podrás gestionar tus datos.</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">Ver sección <ArrowRight size={13} /></span></button>
    </div>
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4"><span className="mt-0.5 text-slate-400"><Clock3 size={17} /></span><p className="text-xs leading-5 text-slate-500">Puedes seguir explorando y comprar como invitado. Tus favoritos se conservan en este navegador.</p></div>
  </section>;
}

function OrdersTab() {
  return <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight text-slate-900">Mis pedidos</h2><p className="mt-1 text-sm text-slate-500">Consulta el estado y los detalles de tus compras.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Próximamente</span></div>
    <div className="mt-7 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-violet-400 shadow-sm"><PackageCheck size={23} /></span><h3 className="mt-4 text-base font-semibold text-slate-800">Tus pedidos aparecerán aquí</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Cuando el perfil esté activo, podrás revisar compras, fechas y actualizaciones de entrega. Por ahora, tus pedidos como invitado no se vinculan a esta vista previa.</p><Link href="/#catalogo" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">Explorar catálogo <ArrowRight size={15} /></Link></div>
  </section>;
}

function DetailsTab() {
  return <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight text-slate-900">Mis datos</h2><p className="mt-1 text-sm text-slate-500">La información de tu perfil y dirección de entrega.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Próximamente</span></div>
    <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50/70 p-4"><p className="text-sm font-semibold text-slate-800">Esta vista es solo una muestra</p><p className="mt-1 text-xs leading-5 text-slate-600">Aún no guardamos datos personales. Los campos estarán disponibles cuando activemos los perfiles.</p></div>
    <form className="mt-6 space-y-5" aria-label="Vista previa de datos personales">
      <fieldset disabled className="space-y-5 opacity-70"><legend className="mb-4 text-sm font-semibold text-slate-800">Información de contacto</legend>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-medium text-slate-600">Nombre completo<input type="text" autoComplete="name" placeholder="Tu nombre" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-400" /></label><label className="block text-xs font-medium text-slate-600">Correo electrónico<input type="email" autoComplete="email" placeholder="tu@correo.com" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-400" /></label><label className="block text-xs font-medium text-slate-600"><span className="inline-flex items-center gap-1.5"><Phone size={13} /> Teléfono</span><input type="tel" autoComplete="tel" placeholder="Tu teléfono" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-400" /></label></div>
      </fieldset>
      <fieldset disabled className="space-y-4 opacity-70"><legend className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800"><MapPin size={15} /> Dirección de entrega</legend><label className="block text-xs font-medium text-slate-600">Calle y número<input type="text" autoComplete="street-address" placeholder="Calle, número exterior e interior" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-400" /></label><div className="grid gap-4 sm:grid-cols-3"><label className="block text-xs font-medium text-slate-600">Colonia<input type="text" autoComplete="address-line2" placeholder="Colonia" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-400" /></label><label className="block text-xs font-medium text-slate-600">Ciudad<input type="text" autoComplete="address-level2" placeholder="Ciudad" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-400" /></label><label className="block text-xs font-medium text-slate-600">Código postal<input type="text" autoComplete="postal-code" placeholder="00000" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 placeholder:text-slate-400" /></label></div></fieldset>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5"><button type="button" disabled className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white opacity-50">Guardar cambios</button><span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13} /> Se activará cuando esté disponible el perfil.</span></div>
    </form>
  </section>;
}

export default function ProfileTabs() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  useEffect(() => {
    const selectTab = (requestedTab: string | null) => {
      if (tabs.some((tab) => tab.id === requestedTab)) setActiveTab(requestedTab as ProfileTab);
    };
    selectTab(new URLSearchParams(window.location.search).get('tab'));
    const handleProfileTab = (event: Event) => selectTab((event as CustomEvent<{ tab?: string }>).detail?.tab ?? null);
    window.addEventListener('profile:select-tab', handleProfileTab);
    return () => window.removeEventListener('profile:select-tab', handleProfileTab);
  }, []);
  return <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
    <nav aria-label="Secciones de perfil" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50 p-2 lg:block lg:space-y-1 lg:self-start">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:w-full ${activeTab === id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}><Icon size={16} />{label}{id !== 'favorites' && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">Pronto</span>}</button>)}</nav>
    <div className="min-w-0">{activeTab === 'overview' ? <OverviewTab onNavigate={setActiveTab} /> : activeTab === 'favorites' ? <ProfileFavorites /> : activeTab === 'orders' ? <OrdersTab /> : <DetailsTab />}</div>
  </div>;
}
