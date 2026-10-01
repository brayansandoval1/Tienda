'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, LayoutDashboard, Package, Sparkles } from 'lucide-react';

const links = [
  { href: '/admin', label: 'Panel', icon: LayoutDashboard, exact: true },
  { href: '/admin/products', label: 'Productos', icon: Package },
  { href: '/admin/addons', label: 'Acabados y Extras', icon: Sparkles },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-slate-50"><header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"><Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight text-slate-900"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-white"><Box size={17} /></span>Administración</Link><nav aria-label="Navegación administrativa" className="flex items-center gap-1">{links.map(({ href, label, icon: Icon, exact }) => { const active = exact ? pathname === href || pathname === '/admin/dashboard' : pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><Icon size={16} /><span className="hidden sm:inline">{label}</span></Link>; })}</nav></div></header>{children}</div>;
}
