'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Gift, Plus, Save, Trash2 } from 'lucide-react';
import {
  DEFAULT_SURPRISE_GIFT_CONFIG,
  type SurpriseGiftConfig,
} from '@/src/config/surpriseGiftConfig';
import { surpriseGiftConfigRepository } from '@/src/services/surpriseGiftConfigRepository';
import SurpriseGiftImageField from '@/components/admin/SurpriseGiftImageField';

type Tab = 'prices' | 'occasions' | 'items' | 'options' | 'profiles';
type CatalogOption = SurpriseGiftConfig['catalogOptions'][string][string][number];
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'prices', label: 'Caja y precios' },
  { id: 'occasions', label: 'Ocasiones' },
  { id: 'items', label: 'Elementos' },
  { id: 'options', label: 'Productos por ocasión' },
  { id: 'profiles', label: 'Perfiles y sugerencias' },
];

export default function AdminSurpriseGiftManager() {
  const [config, setConfig] = useState<SurpriseGiftConfig>(DEFAULT_SURPRISE_GIFT_CONFIG);
  const [tab, setTab] = useState<Tab>('prices');
  const [occasionId, setOccasionId] = useState('cumpleanos');
  const [categoryId, setCategoryId] = useState('peluche');
  const [status, setStatus] = useState('');
  const occasionOptions = config.catalogOptions[occasionId]?.[categoryId] ?? [];

  useEffect(() => setConfig(surpriseGiftConfigRepository.read()), []);

  const updatePricing = (key: keyof SurpriseGiftConfig['pricing'], value: number) => setConfig((current) => ({
    ...current,
    pricing: { ...current.pricing, [key]: Math.max(0, value) },
  }));

  const updateCatalogOption = (id: string, patch: Partial<CatalogOption>) => setConfig((current) => ({
    ...current,
    catalogOptions: {
      ...current.catalogOptions,
      [occasionId]: {
        ...current.catalogOptions[occasionId],
        [categoryId]: (current.catalogOptions[occasionId]?.[categoryId] ?? []).map((option) => option.id === id ? { ...option, ...patch } : option),
      },
    },
  }));

  const addCatalogOption = () => {
    const option: CatalogOption = {
      id: `${categoryId}-${Date.now().toString(36)}`,
      name: 'Nueva opción', detail: 'Describe este producto', emoji: categoryId === 'flores' ? '💐' : categoryId === 'dulces' ? '🍫' : '🧸', price: 0, volume: 20,
    };
    setConfig((current) => ({
      ...current,
      catalogOptions: {
        ...current.catalogOptions,
        [occasionId]: {
          ...current.catalogOptions[occasionId],
          [categoryId]: [...(current.catalogOptions[occasionId]?.[categoryId] ?? []), option],
        },
      },
    }));
  };

  const addOccasion = () => {
    const id = `ocasion-${Date.now().toString(36)}`;
    setConfig((current) => ({
      ...current,
      occasions: [...current.occasions, { id, name: 'Nueva ocasión', emoji: '✨', imageUrl: '' }],
      catalogOptions: { ...current.catalogOptions, [id]: structuredClone(current.catalogOptions.sorpresa) },
      ideaSuggestions: { ...current.ideaSuggestions, [id]: [...(current.ideaSuggestions.sorpresa ?? [])] },
    }));
    setOccasionId(id);
  };

  const save = () => {
    const succeeded = surpriseGiftConfigRepository.write(config);
    setStatus(succeeded ? 'Cambios guardados en este navegador.' : 'No se pudo guardar. Revisa el espacio disponible del navegador.');
    window.setTimeout(() => setStatus(''), 3500);
  };

  const updateRecipientOption = (group: keyof SurpriseGiftConfig['recipientOptions'], id: string, label: string) => setConfig((current) => ({
    ...current,
    recipientOptions: {
      ...current.recipientOptions,
      [group]: current.recipientOptions[group].map((option) => option.id === id ? { ...option, label } : option),
    },
  }));

  const addRecipientOption = (group: keyof SurpriseGiftConfig['recipientOptions']) => setConfig((current) => ({
    ...current,
    recipientOptions: {
      ...current.recipientOptions,
      [group]: [...current.recipientOptions[group], { id: `${group}-${Date.now().toString(36)}`, label: 'Nueva opción' }],
    },
  }));

  const updateRecommendationTerms = (group: 'ages' | 'styles', id: string, value: string) => setConfig((current) => ({
    ...current,
    recommendationTerms: {
      ...current.recommendationTerms,
      [group]: {
        ...current.recommendationTerms[group],
        [id]: value.split(',').map((term) => term.trim()).filter(Boolean).slice(0, 20),
      },
    },
  }));

  const summary = useMemo(() => `${config.occasions.length} ocasiones · ${config.giftItems.length} elementos · ${Object.values(config.catalogOptions).reduce((sum, occasion) => sum + Object.values(occasion).reduce((count, options) => count + options.length, 0), 0)} opciones de producto`, [config]);

  return <main className="min-h-screen px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700"><Gift size={16} /> Administración de tienda</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Regalos sorpresa</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Configura lo que aparece en el personalizador de regalos: ocasiones, productos, perfiles y precios.</p><p className="mt-2 text-xs text-slate-400">{summary}</p></div><button type="button" onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"><Save size={16} /> Guardar cambios</button></header>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><nav aria-label="Opciones de regalos sorpresa" className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === item.id ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/80 hover:text-slate-800'}`}>{item.label}</button>)}</nav>
      {tab === 'prices' && <section className="space-y-7 p-5 sm:p-7"><div><h2 className="font-semibold text-slate-900">Precio y capacidad</h2><p className="mt-1 text-xs text-slate-500">Estos valores se reflejan en el estimado y el medidor de la caja.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([
        ['boxBasePrice', 'Caja y armado (MXN)'], ['premiumBoxSurcharge', 'Extra caja premium (MXN)'], ['standardCapacity', 'Capacidad estándar'], ['premiumCapacity', 'Capacidad premium'],
      ] as Array<[keyof SurpriseGiftConfig['pricing'], string]>).map(([key, label]) => <label key={key} className="text-xs font-semibold text-slate-700">{label}<input type="number" min="0" step="1" value={config.pricing[key]} onChange={(event) => updatePricing(key, Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></label>)}</div></div>
        <div><h2 className="font-semibold text-slate-900">Colores de caja y listón</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{config.boxStyles.map((box) => <div key={box.id} className="rounded-xl border border-slate-200 p-3"><label className="block text-[10px] font-semibold text-slate-500">Nombre<input value={box.name} onChange={(event) => setConfig((current) => ({ ...current, boxStyles: current.boxStyles.map((item) => item.id === box.id ? { ...item, name: event.target.value } : item) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-800" /></label><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-500">Caja<input type="color" value={box.color} onChange={(event) => setConfig((current) => ({ ...current, boxStyles: current.boxStyles.map((item) => item.id === box.id ? { ...item, color: event.target.value } : item) }))} className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-200 bg-white p-1" /></label><label className="text-[10px] text-slate-500">Listón<input type="color" value={box.ribbon} onChange={(event) => setConfig((current) => ({ ...current, boxStyles: current.boxStyles.map((item) => item.id === box.id ? { ...item, ribbon: event.target.value } : item) }))} className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-200 bg-white p-1" /></label></div></div>)}</div></div>
      </section>}

      {tab === 'occasions' && <section className="space-y-3 p-5 sm:p-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-slate-900">Ocasiones disponibles</h2><p className="mt-1 text-xs text-slate-500">Cada ocasión tiene su propio catálogo y sugerencias.</p></div><button type="button" onClick={addOccasion} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Añadir ocasión</button></div>{config.occasions.map((occasion) => <div key={occasion.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[70px_1fr_90px_auto] sm:items-end"><div><label className="text-[10px] font-semibold text-slate-500">Emoji<input value={occasion.emoji} maxLength={4} onChange={(event) => setConfig((current) => ({ ...current, occasions: current.occasions.map((item) => item.id === occasion.id ? { ...item, emoji: event.target.value } : item) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-base" /></label><SurpriseGiftImageField value={occasion.imageUrl} onChange={(imageUrl) => setConfig((current) => ({ ...current, occasions: current.occasions.map((item) => item.id === occasion.id ? { ...item, imageUrl } : item) }))} /></div><label className="text-[10px] font-semibold text-slate-500">Nombre visible<input value={occasion.name} onChange={(event) => setConfig((current) => ({ ...current, occasions: current.occasions.map((item) => item.id === occasion.id ? { ...item, name: event.target.value } : item) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800" /></label><label className="text-[10px] font-semibold text-slate-500">Clave<input value={occasion.id} readOnly className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500" /></label><button type="button" disabled={config.occasions.length <= 1} onClick={() => { setConfig((current) => { const occasions = current.occasions.filter((item) => item.id !== occasion.id); const catalogOptions = { ...current.catalogOptions }; delete catalogOptions[occasion.id]; const ideaSuggestions = { ...current.ideaSuggestions }; delete ideaSuggestions[occasion.id]; return { ...current, occasions, catalogOptions, ideaSuggestions }; }); if (occasionId === occasion.id) setOccasionId(config.occasions.find((item) => item.id !== occasion.id)?.id ?? 'sorpresa'); }} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" aria-label={`Eliminar ${occasion.name}`}><Trash2 size={16} /></button></div>)}</section>}

      {tab === 'items' && <section className="p-5 sm:p-7"><h2 className="font-semibold text-slate-900">Elementos de la caja</h2><p className="mt-1 text-xs text-slate-500">Edita nombres, descripciones, precios y volumen utilizado.</p><div className="mt-4 space-y-3">{config.giftItems.map((item) => <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[58px_1fr_1fr_110px_110px] sm:items-end"><div><label className="text-[10px] font-semibold text-slate-500">Emoji<input value={item.emoji} maxLength={4} onChange={(event) => setConfig((current) => ({ ...current, giftItems: current.giftItems.map((entry) => entry.id === item.id ? { ...entry, emoji: event.target.value } : entry) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-lg" /></label><SurpriseGiftImageField value={item.imageUrl} onChange={(imageUrl) => setConfig((current) => ({ ...current, giftItems: current.giftItems.map((entry) => entry.id === item.id ? { ...entry, imageUrl } : entry) }))} /></div><label className="text-[10px] font-semibold text-slate-500">Nombre<input value={item.name} onChange={(event) => setConfig((current) => ({ ...current, giftItems: current.giftItems.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-[10px] font-semibold text-slate-500">Descripción<input value={item.detail} onChange={(event) => setConfig((current) => ({ ...current, giftItems: current.giftItems.map((entry) => entry.id === item.id ? { ...entry, detail: event.target.value } : entry) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-[10px] font-semibold text-slate-500">Precio (MXN)<input type="number" min="0" value={item.price} onChange={(event) => setConfig((current) => ({ ...current, giftItems: current.giftItems.map((entry) => entry.id === item.id ? { ...entry, price: Number(event.target.value) } : entry) }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-[10px] font-semibold text-slate-500">Volumen<input type="number" min="0" value={config.itemVolumes[item.id] ?? 0} onChange={(event) => setConfig((current) => ({ ...current, itemVolumes: { ...current.itemVolumes, [item.id]: Number(event.target.value) } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label></div>)}</div></section>}

      {tab === 'options' && <section className="p-5 sm:p-7"><div><h2 className="font-semibold text-slate-900">Productos según ocasión</h2><p className="mt-1 text-xs text-slate-500">Edita los modelos y precios que verá el cliente en cada modal de oso, chocolates o flores.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Ocasión<select value={occasionId} onChange={(event) => setOccasionId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">{config.occasions.map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-700">Tipo de producto<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">{config.catalogItemIds.map((id) => <option key={id} value={id}>{config.giftItems.find((item) => item.id === id)?.name ?? id}</option>)}</select></label></div><div className="mt-4 space-y-3">{occasionOptions.map((option) => <div key={option.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[58px_1fr_1fr_100px_100px_auto] sm:items-end"><div><label className="text-[10px] font-semibold text-slate-500">Emoji<input value={option.emoji} maxLength={4} onChange={(event) => updateCatalogOption(option.id, { emoji: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-lg" /></label><SurpriseGiftImageField value={option.imageUrl} onChange={(imageUrl) => updateCatalogOption(option.id, { imageUrl })} /></div><label className="text-[10px] font-semibold text-slate-500">Nombre<input value={option.name} onChange={(event) => updateCatalogOption(option.id, { name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-[10px] font-semibold text-slate-500">Descripción<input value={option.detail} onChange={(event) => updateCatalogOption(option.id, { detail: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-[10px] font-semibold text-slate-500">Precio<input type="number" min="0" value={option.price} onChange={(event) => updateCatalogOption(option.id, { price: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-[10px] font-semibold text-slate-500">Volumen<input type="number" min="0" value={option.volume} onChange={(event) => updateCatalogOption(option.id, { volume: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><button type="button" onClick={() => setConfig((current) => ({ ...current, catalogOptions: { ...current.catalogOptions, [occasionId]: { ...current.catalogOptions[occasionId], [categoryId]: (current.catalogOptions[occasionId]?.[categoryId] ?? []).filter((item) => item.id !== option.id) } } }))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Eliminar ${option.name}`}><Trash2 size={16} /></button></div>)}</div><button type="button" onClick={addCatalogOption} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"><Plus size={14} /> Agregar producto</button></section>}

      {tab === 'profiles' && <section className="space-y-7 p-5 sm:p-7">{([
        ['genders', 'Género (opcional)'], ['ages', 'Rangos de edad'], ['styles', 'Estilos preferidos'],
      ] as Array<[keyof SurpriseGiftConfig['recipientOptions'], string]>).map(([group, title]) => <div key={group}><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900">{title}</h2><p className="mt-1 text-[10px] text-slate-500">Opciones que puede elegir el cliente para afinar recomendaciones.</p></div><button type="button" onClick={() => addRecipientOption(group)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600"><Plus size={12} /> Añadir</button></div><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{config.recipientOptions[group].map((option) => <label key={option.id} className="text-[10px] font-semibold text-slate-500">{option.id}<input value={option.label} onChange={(event) => updateRecipientOption(group, option.id, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-800" /></label>)}</div></div>)}
        <div><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900">Sugerencias de personalización</h2><p className="mt-1 text-[10px] text-slate-500">Una por línea; aparecen como ideas rápidas en el modal del cliente.</p></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{config.occasions.map((occasion) => <label key={occasion.id} className="text-[10px] font-semibold text-slate-600">{occasion.emoji} {occasion.name}<textarea value={(config.ideaSuggestions[occasion.id] ?? []).join('\n')} onChange={(event) => setConfig((current) => ({ ...current, ideaSuggestions: { ...current.ideaSuggestions, [occasion.id]: event.target.value.split('\n').slice(0, 8) } }))} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal leading-5 text-slate-700" /></label>)}</div></div>
        <div><h2 className="text-sm font-semibold text-slate-900">Palabras para recomendaciones inteligentes</h2><p className="mt-1 text-[10px] text-slate-500">El configurador prioriza productos cuyo nombre o descripción coincide con estas palabras. Sepáralas con comas.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(['ages', 'styles'] as const).flatMap((group) => config.recipientOptions[group].filter((option) => !['sin-especificar', 'automatico'].includes(option.id)).map((option) => <label key={`${group}-${option.id}`} className="text-[10px] font-semibold text-slate-600">{option.label}<input value={(config.recommendationTerms[group][option.id] ?? []).join(', ')} onChange={(event) => updateRecommendationTerms(group, option.id, event.target.value)} placeholder="Ej. mini, colorido, premium" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700" /></label>))}</div></div>
      </section>}
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400"><p>La configuración se guarda localmente y queda desacoplada detrás de un repositorio para conectarla a una API/base de datos después.</p>{status && <p role="status" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><Check size={14} />{status}</p>}</div>
  </div></main>;
}
