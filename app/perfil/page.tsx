import Link from 'next/link';
import { ArrowLeft, Sparkles, UserRound } from 'lucide-react';
import ProfileTabs from '@/components/ProfileTabs';

export default function ProfilePage() {
  return <main className="min-h-screen bg-[#fcfbff] px-5 pb-16 pt-8 text-slate-800 sm:px-8 sm:pt-12">
    <div className="mx-auto max-w-5xl">
      <Link href="/#perfil" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-violet-700"><ArrowLeft size={16} /> Volver a StyleCute</Link>
      <div className="mt-8 overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_24px_70px_rgba(109,88,150,.10)]">
        <div className="bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 px-6 py-9 text-white sm:px-10 sm:py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"><Sparkles size={14} /> Vista previa del perfil</span>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Tu espacio StyleCute</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">Aquí podrás reunir tus diseños guardados y consultar tus pedidos. El perfil será opcional y podrás comprar aunque no tengas uno.</p>
        </div>
        <div className="p-5 sm:p-8"><ProfileTabs /><div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 sm:p-5"><p className="text-sm font-semibold text-slate-800">La creación de perfiles aún no está activa</p><p className="mt-1 text-xs leading-5 text-slate-600">Esta pantalla es una vista previa; todavía no se crean cuentas ni se guardan datos personales. Puedes continuar comprando como invitado.</p></div></div>
      </div>
    </div>
  </main>;
}
