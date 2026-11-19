import Link from 'next/link';
import { ArrowRight, Bookmark, Box, Clock3, PackageCheck, Sparkles, UserRound } from 'lucide-react';

const benefits = [
  { icon: Bookmark, title: 'Diseños guardados', text: 'Retoma tus ideas cuando quieras.' },
  { icon: PackageCheck, title: 'Tus pedidos', text: 'Consulta el estado y el historial de tus compras.' },
  { icon: Clock3, title: 'Compra más fácil', text: 'Ten tus datos a la mano para la próxima vez.' },
];

export default function ProfilePreview() {
  return <section id="perfil" className="border-y border-violet-100 bg-white px-5 py-20 sm:px-8 lg:px-12">
    <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"><UserRound size={14} /> Tu espacio personal</p>
        <h2 className="mt-5 max-w-xl text-3xl font-semibold tracking-[-.055em] text-slate-900 sm:text-4xl">Tus diseños y pedidos, en un solo lugar.</h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">Un perfil StyleCute te ayudará a guardar tus creaciones y encontrar fácilmente tus compras. Será opcional: podrás seguir diseñando y comprar como invitado.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">{benefits.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon size={17} /></span><div><h3 className="text-sm font-semibold text-slate-800">{title}</h3><p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p></div></div>)}</div>
        <Link href="/perfil" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700">Ver vista previa <ArrowRight size={16} /></Link>
        <p className="mt-3 text-xs text-slate-400">La creación de cuentas estará disponible próximamente.</p>
      </div>

      <div aria-label="Vista previa del futuro perfil StyleCute" className="relative mx-auto w-full max-w-2xl rounded-[1.75rem] border border-violet-100 bg-[#faf9ff] p-3 shadow-[0_24px_70px_rgba(109,88,150,.12)] sm:p-5">
        <div className="absolute -right-3 -top-3 grid h-11 w-11 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200"><Sparkles size={19} /></div>
        <div className="flex items-center justify-between rounded-2xl border border-white bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-violet-200 to-rose-100 text-violet-700"><UserRound size={20} /></span><div><p className="text-sm font-semibold text-slate-900">Tu perfil</p><p className="mt-0.5 text-xs text-slate-500">Un espacio para tus ideas</p></div></div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Próximamente</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-white bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-700">Mis diseños</h3><Bookmark size={15} className="text-violet-500" /></div><div className="mt-3 grid h-28 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-100 via-white to-rose-100"><div className="grid h-16 w-16 place-items-center rounded-2xl border border-white bg-white/80 text-violet-500 shadow-sm"><Sparkles size={24} /></div></div><p className="mt-2 text-[11px] text-slate-500">Tus creaciones guardadas aparecerán aquí.</p></article>
          <article className="rounded-2xl border border-white bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-700">Mis pedidos</h3><PackageCheck size={15} className="text-emerald-600" /></div><div className="mt-3 flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center"><Box size={23} className="text-slate-300" /><p className="mt-2 text-[11px] font-medium text-slate-500">Aquí verás tus compras</p></div><p className="mt-2 text-[11px] text-slate-500">Revisa su estado y los detalles.</p></article>
        </div>
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-center text-[11px] leading-5 text-violet-700">Esta es una vista previa. Por ahora puedes comprar como invitado.</p>
      </div>
    </div>
  </section>;
}
