'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, PointerEvent } from 'react';
import { ArrowRight, Camera, Check, Gift, Heart, Image, Package, Sparkles, Star, X, ZoomIn } from 'lucide-react';
import StorefrontHeader from '@/components/StorefrontHeader';
import CartDrawer from '@/components/editor/CartDrawer';
import { useProductStore } from '@/src/store/useProductStore';
import type { Product } from '@/src/config/products';
import { getDraft } from '@/src/utils/designDraftStorage';
import { DEFAULT_SURPRISE_GIFT_CONFIG } from '@/src/config/surpriseGiftConfig';
import { surpriseGiftConfigRepository } from '@/src/services/surpriseGiftConfigRepository';
import SurpriseGiftIcon from '@/components/surprise/SurpriseGiftIcon';
type PhotoSlot = { src: string; zoom: number; x: number } | null;

export default function SurpriseGiftStudio() {
  const [config, setConfig] = useState(DEFAULT_SURPRISE_GIFT_CONFIG);
  const { occasions, giftItems, boxStyles, ribbonColors, boxPresentations, itemVolumes, catalogOptions, catalogItemIds } = config;
  const { genders, ages, styles } = config.recipientOptions;
  const { pricing } = config;
  const [occasion, setOccasion] = useState('cumpleanos');
  const [customOccasionName, setCustomOccasionName] = useState('');
  const [recipientGender, setRecipientGender] = useState('sin-especificar');
  const [recipientAge, setRecipientAge] = useState('sin-especificar');
  const [recipientStyle, setRecipientStyle] = useState('automatico');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedCatalogChoices, setSelectedCatalogChoices] = useState<Record<string, string>>({});
  const [catalogModalCategory, setCatalogModalCategory] = useState<string | null>(null);
  const [catalogDraftId, setCatalogDraftId] = useState('');
  const [boxStyleId, setBoxStyleId] = useState('rosa');
  const [boxPresentationId, setBoxPresentationId] = useState('clasica-cuadrada');
  const [baseColor, setBaseColor] = useState(DEFAULT_SURPRISE_GIFT_CONFIG.boxStyles[0].color);
  const [lidColor, setLidColor] = useState(DEFAULT_SURPRISE_GIFT_CONFIG.boxStyles[0].color);
  const [ribbonColorId, setRibbonColorId] = useState(DEFAULT_SURPRISE_GIFT_CONFIG.ribbonColors[0].id);
  const [message, setMessage] = useState('¡Hoy celebramos lo increíble que eres!');
  const [ribbonEnabled, setRibbonEnabled] = useState(true);
  const [boxSize, setBoxSize] = useState<'standard' | 'premium'>('standard');
  const [capacityWarning, setCapacityWarning] = useState('');
  const [letterOpen, setLetterOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [letterDraft, setLetterDraft] = useState('');
  const [letterText, setLetterText] = useState('');
  const [photos, setPhotos] = useState<PhotoSlot[]>(Array(6).fill(null));
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [ideaTarget, setIdeaTarget] = useState('caja');
  const [ideaTargetDraft, setIdeaTargetDraft] = useState('caja');
  const [ideaDraft, setIdeaDraft] = useState('');
  const [specialIdea, setSpecialIdea] = useState('');
  const [referencePhoto, setReferencePhoto] = useState('');
  const [referencePhotoDraft, setReferencePhotoDraft] = useState('');
  const [referencePhotoError, setReferencePhotoError] = useState('');
  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const products = useProductStore((state) => state.products);
  const [boxClosed, setBoxClosed] = useState(false);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const activeOccasion = occasion === 'otra'
    ? { id: 'otra', name: customOccasionName.trim() || 'Otra ocasión', emoji: '✨' }
    : occasions.find((item) => item.id === occasion) ?? occasions[0] ?? DEFAULT_SURPRISE_GIFT_CONFIG.occasions[0];
  const activeBox = boxStyles.find((item) => item.id === boxStyleId) ?? boxStyles[0] ?? DEFAULT_SURPRISE_GIFT_CONFIG.boxStyles[0];
  const activePresentation = boxPresentations.find((item) => item.id === boxPresentationId) ?? boxPresentations[0] ?? DEFAULT_SURPRISE_GIFT_CONFIG.boxPresentations[0];
  const ribbonColor = ribbonColors.find((item) => item.id === ribbonColorId)?.color ?? ribbonColors[0]?.color ?? DEFAULT_SURPRISE_GIFT_CONFIG.ribbonColors[0].color;
  const chosenItems = giftItems.filter((item) => selectedItems.includes(item.id));
  const getCatalogChoice = (categoryId: string, choiceId = selectedCatalogChoices[categoryId]) => {
    const options = (catalogOptions[occasion] ?? catalogOptions.sorpresa ?? DEFAULT_SURPRISE_GIFT_CONFIG.catalogOptions.sorpresa)?.[categoryId] ?? [];
    if (choiceId === '') return undefined;
    return options.find((option) => option.id === choiceId) ?? options[0];
  };
  const getItemVolume = (id: string) => catalogItemIds.includes(id)
    ? getCatalogChoice(id)?.volume ?? itemVolumes[id] ?? 0
    : itemVolumes[id] ?? 0;
  const itemsTotal = chosenItems.reduce((sum, item) => sum + (catalogItemIds.includes(item.id) ? (getCatalogChoice(item.id)?.price ?? 0) : item.price), 0) + products.filter((product) => selectedProducts.includes(product.id)).reduce((sum, product) => sum + product.price, 0);
  const usedVolume = selectedItems.reduce((sum, id) => sum + getItemVolume(id), 0);
  const capacity = Math.max(1, boxSize === 'premium' ? activePresentation.extendedCapacity : activePresentation.capacity);
  const capacityPercent = Math.round((usedVolume / capacity) * 100);
  const estimate = activePresentation.price + itemsTotal + (boxSize === 'premium' ? pricing.premiumBoxSurcharge : 0);
  const selectedProductNames = [
    ...chosenItems.map((item) => getCatalogChoice(item.id)?.name ?? item.name),
    ...products.filter((product) => selectedProducts.includes(product.id)).map((product) => product.name),
  ];
  const currentIdeaSuggestions = [...(config.ideaSuggestions[occasion] ?? config.ideaSuggestions.sorpresa ?? []), ...(selectedProducts.length ? [`Integra con cuidado ${products.filter((product) => selectedProducts.includes(product.id)).map((product) => product.name).join(', ')}.`] : [])];
  const recipientContext = [
    recipientGender !== 'sin-especificar' ? genders.find((item) => item.id === recipientGender)?.label ?? recipientGender : '',
    recipientAge !== 'sin-especificar' ? ages.find((item) => item.id === recipientAge)?.label ?? recipientAge : '',
  ].filter(Boolean).join(' · ') || 'sin especificar';
  const getRecommendedCatalogOptions = (categoryId: string) => {
    const options = (catalogOptions[occasion] ?? catalogOptions.sorpresa)?.[categoryId] ?? [];
    const preferredTerms = [...(config.recommendationTerms.ages[recipientAge] ?? []), ...(config.recommendationTerms.styles[recipientStyle] ?? [])];
    return options.map((option, index) => ({ option, index, score: preferredTerms.reduce((score, term) => score + (`${option.name} ${option.detail}`.toLocaleLowerCase('es-MX').includes(term) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ option }, index) => ({ ...option, recommended: index === 0 && preferredTerms.length > 0 }));
  };

  useEffect(() => {
    const refreshConfig = () => setConfig(surpriseGiftConfigRepository.read());
    refreshConfig();
    window.addEventListener('storage', refreshConfig);
    window.addEventListener('surprise-gift-config-updated', refreshConfig);
    return () => {
      window.removeEventListener('storage', refreshConfig);
      window.removeEventListener('surprise-gift-config-updated', refreshConfig);
    };
  }, []);

  useEffect(() => {
    const selectedBox = boxStyles.find((item) => item.id === boxStyleId) ?? boxStyles[0];
    if (selectedBox) {
      setBaseColor(selectedBox.color);
      setLidColor(selectedBox.color);
    }
  }, [boxStyles, boxStyleId]);

  useEffect(() => {
    if (!ribbonColors.some((item) => item.id === ribbonColorId) && ribbonColors[0]) {
      setRibbonColorId(ribbonColors[0].id);
    }
  }, [ribbonColors, ribbonColorId]);

  useEffect(() => {
    const refreshSavedProducts = () => setSavedProducts(products.filter((product) => Boolean(getDraft(product.id))));
    refreshSavedProducts();
    const refreshOnReturn = () => { if (document.visibilityState === 'visible') refreshSavedProducts(); };
    window.addEventListener('storage', refreshSavedProducts);
    window.addEventListener('focus', refreshOnReturn);
    return () => {
      window.removeEventListener('storage', refreshSavedProducts);
      window.removeEventListener('focus', refreshOnReturn);
    };
  }, [products]);

  useEffect(() => {
    if (!tiltEnabled) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setTilt({ x: Math.max(-8, Math.min(8, (event.beta ?? 0) / 5)), y: Math.max(-8, Math.min(8, (event.gamma ?? 0) / 5)) });
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [tiltEnabled]);

  const enableDeviceTilt = async () => {
    const orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
    if (orientation.requestPermission) {
      try {
        if (await orientation.requestPermission() !== 'granted') return;
      } catch { return; }
    }
    setTiltEnabled(true);
  };

  const trackPointerTilt = (event: PointerEvent<HTMLDivElement>) => {
    if (tiltEnabled || event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setTilt({ x: ((event.clientY - bounds.top) / bounds.height - 0.5) * -10, y: ((event.clientX - bounds.left) / bounds.width - 0.5) * 10 });
  };

  const toggleItem = (id: string) => {
    if (id === 'producto-personalizado') {
      setProductsModalOpen(true);
      return;
    }
    if (catalogItemIds.includes(id)) {
      const options = (catalogOptions[occasion] ?? catalogOptions.sorpresa)?.[id] ?? [];
      setCatalogDraftId(selectedCatalogChoices[id] && options.some((option) => option.id === selectedCatalogChoices[id]) ? selectedCatalogChoices[id] : options[0]?.id ?? '');
      setCatalogModalCategory(id);
      return;
    }
    if (selectedItems.includes(id)) {
      const remainingItems = selectedItems.filter((item) => item !== id);
      const remainingVolume = remainingItems.reduce((sum, item) => sum + getItemVolume(item), 0);
      setSelectedItems(remainingItems);
      setCapacityWarning(remainingVolume > (boxSize === 'premium' ? activePresentation.extendedCapacity : activePresentation.capacity)
        ? 'Todavía hay más volumen del que admite esta presentación. Quita otro elemento.'
        : remainingVolume > activePresentation.capacity ? 'Hay más elementos que espacio en esta presentación.' : '');
      if (id === 'carta') setLetterOpen(false);
      return;
    }
    const nextVolume = usedVolume + (itemVolumes[id] ?? 0);
    if (nextVolume > activePresentation.extendedCapacity) {
      setCapacityWarning(`La ${activePresentation.name.toLowerCase()} llegó a su capacidad máxima. Quita algún elemento para continuar.`);
      return;
    }
    setSelectedItems((current) => [...current, id]);
    setCapacityWarning(nextVolume > activePresentation.capacity && boxSize === 'standard' ? 'Hay más elementos que espacio en esta presentación.' : '');
    if (id === 'carta') setLetterOpen(true);
  };

  const saveCatalogSelection = () => {
    if (!catalogModalCategory) return;
    const option = getCatalogChoice(catalogModalCategory, catalogDraftId);
    const currentVolume = selectedItems.includes(catalogModalCategory)
      ? getCatalogChoice(catalogModalCategory)?.volume ?? itemVolumes[catalogModalCategory] ?? 0
      : 0;
    const nextVolume = usedVolume - currentVolume + (option?.volume ?? 0);
    if (nextVolume > activePresentation.extendedCapacity) {
      setCapacityWarning(`La ${activePresentation.name.toLowerCase()} llegó a su capacidad máxima. Quita algún elemento para continuar.`);
      return;
    }
    if (option) {
      setSelectedCatalogChoices((current) => ({ ...current, [catalogModalCategory]: option.id }));
      setSelectedItems((current) => current.includes(catalogModalCategory) ? current : [...current, catalogModalCategory]);
    } else {
      setSelectedItems((current) => current.filter((item) => item !== catalogModalCategory));
      setSelectedCatalogChoices((current) => { const next = { ...current }; delete next[catalogModalCategory]; return next; });
    }
    setCapacityWarning(nextVolume > capacity && boxSize === 'standard' ? 'Hay más elementos que espacio en la caja actual.' : '');
    setCatalogModalCategory(null);
  };

  const toggleProduct = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      const remaining = selectedProducts.filter((id) => id !== productId);
      setSelectedProducts(remaining);
      if (!remaining.length) setSelectedItems((current) => current.filter((id) => id !== 'producto-personalizado'));
      return;
    }
    const maximum = boxSize === 'premium' ? 3 : 1;
    if (selectedProducts.length >= maximum) return;
    const nextVolume = usedVolume + (itemVolumes['producto-personalizado'] ?? 0);
    if (nextVolume > activePresentation.extendedCapacity) {
      setCapacityWarning(`La ${activePresentation.name.toLowerCase()} llegó a su capacidad máxima. Quita algún elemento para continuar.`);
      return;
    }
    setSelectedProducts((current) => [...current, productId]);
    setSelectedItems((current) => current.includes('producto-personalizado') ? current : [...current, 'producto-personalizado']);
    setCapacityWarning(nextVolume > activePresentation.capacity && boxSize === 'standard' ? 'Hay más elementos que espacio en esta presentación.' : '');
  };

  const draftLetter = () => {
    const name = recipient.trim() || 'persona especial';
    const greeting = recipientGender === 'mujer' ? 'Querida' : recipientGender === 'hombre' ? 'Querido' : 'Hola';
    const textByOccasion: Record<string, string> = {
      cumpleanos: `${greeting} ${name}:\n\nHoy celebramos tu vida y la alegría que compartes con quienes te queremos. Deseo que este nuevo año te traiga momentos tan bonitos como los que tú regalas. Nunca olvides lo especial que eres.\n\nCon mucho cariño,`,
      boda: `Queridos ${name}:\n\nQue esta nueva etapa esté llena de complicidad, paciencia y pequeños momentos que se conviertan en grandes recuerdos. Les deseo una vida compartida con mucho amor y alegría.\n\nCon todo mi cariño,`,
      aniversario: `${recipientGender === 'mujer' ? 'Mi querida' : recipientGender === 'hombre' ? 'Mi querido' : 'Hola'}, ${name}:\n\nGracias por cada recuerdo, cada sonrisa y por todo lo que seguimos construyendo juntos. Hoy celebro nuestra historia y todos los momentos que todavía nos esperan.\n\nCon todo mi amor,`,
      sorpresa: `Hola, ${name}:\n\nNo hace falta una fecha especial para recordarte cuánto te quiero y lo importante que eres para mí. Espero que esta pequeña sorpresa te saque una sonrisa.\n\nCon mucho cariño,`,
    };
    setLetterDraft(textByOccasion[occasion] ?? textByOccasion.sorpresa);
  };

  const loadPhoto = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotos((current) => current.map((photo, slot) => slot === index ? { src: String(reader.result), zoom: 1, x: 50 } : photo));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const updatePhoto = (index: number, patch: Partial<NonNullable<PhotoSlot>>) => setPhotos((current) => current.map((photo, slot) => slot === index && photo ? { ...photo, ...patch } : photo));

  const loadReferencePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setReferencePhotoError('Selecciona un archivo de imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setReferencePhotoError('La imagen debe pesar menos de 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferencePhotoDraft(String(reader.result));
      setReferencePhotoError('');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#fcfbff] text-slate-800">
      <StorefrontHeader />
      <CartDrawer />
      <section className="relative px-4 pb-16 pt-28 sm:px-7 sm:pt-32 lg:px-10">
        <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-rose-200/45 blur-[100px]" />
        <div className="pointer-events-none absolute -right-28 top-48 h-96 w-96 rounded-full bg-violet-200/50 blur-[110px]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white bg-white/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-violet-700 shadow-sm">
                <Sparkles size={13} /> Un regalo hecho alrededor de su historia
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-.065em] text-slate-800 sm:text-5xl lg:text-6xl">
                Una sorpresa que <span className="bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">se abre en capas.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Elige qué lleva dentro, personaliza el exterior y crea un regalo completo para ese momento especial.
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-2xl border border-white bg-white/70 px-4 py-3 text-xs font-medium text-slate-500 shadow-sm backdrop-blur sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-600"><Heart size={16} /></span>
              Cumpleaños · bodas · aniversarios
            </div>
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(390px,.92fr)]">
            <div className="space-y-4">
              <section className="rounded-[1.6rem] border border-white bg-white/85 p-5 shadow-[0_18px_50px_rgba(109,88,150,.08)] backdrop-blur sm:p-6">
                <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-sm font-bold text-amber-700">01</span><div><h2 className="font-semibold text-slate-800">Elige la forma de tu caja</h2><p className="text-xs text-slate-400">Cada presentación transforma la sorpresa.</p></div></div>
                <div className="grid gap-2 sm:grid-cols-3">{boxPresentations.map((presentation) => <button key={presentation.id} type="button" onClick={() => { setBoxPresentationId(presentation.id); if (presentation.id === 'explosiva-fotos') setSelectedItems((current) => current.includes('fotos') ? current : [...current, 'fotos']); const incomingVolume = presentation.id === 'explosiva-fotos' && !selectedItems.includes('fotos') ? itemVolumes.fotos ?? 0 : 0; const volume = usedVolume + incomingVolume; const limit = boxSize === 'premium' ? presentation.extendedCapacity : presentation.capacity; setCapacityWarning(volume > limit ? `${presentation.name} no tiene espacio suficiente para todos los detalles seleccionados.` : ''); }} aria-pressed={boxPresentationId === presentation.id} className={`rounded-2xl border p-3 text-left transition ${boxPresentationId === presentation.id ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-violet-200'}`}><span className="mb-2 grid h-20 place-items-center overflow-hidden rounded-xl" style={{ backgroundColor: `${activeBox.color}80` }}><span className={`block border-2 border-white/90 shadow-md ${presentation.shape === 'round' ? 'h-12 w-16 rounded-[50%/24%]' : presentation.shape === 'explosion' ? 'h-12 w-14 rotate-3 rounded-sm' : 'h-11 w-14 rounded-sm'}`} style={{ background: `linear-gradient(135deg, ${activeBox.color}, white)` }}>{presentation.shape === 'explosion' && <span className="grid h-full place-items-center text-xl">📸</span>}</span></span><span className="block min-h-9 text-[11px] font-bold leading-4 text-slate-800">{presentation.name}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{presentation.detail}</span><span className="mt-2 block text-xs font-bold text-slate-800">${presentation.price.toLocaleString('es-MX')} MXN</span><span className="mt-1 block text-[9px] text-slate-400">Capacidad ${presentation.capacity} · extendida ${presentation.extendedCapacity}</span></button>)}</div>
                {activePresentation.id === 'explosiva-fotos' && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[10px] leading-4 text-rose-800">Agregamos Fotos favoritas para que puedas subir tus imágenes y verlas en las caras de la caja.</p>}
              </section>

              <section className="rounded-[1.6rem] border border-white bg-white/85 p-5 shadow-[0_18px_50px_rgba(109,88,150,.08)] backdrop-blur sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">02</span>
                  <div><h2 className="font-semibold text-slate-800">¿Qué celebramos?</h2><p className="text-xs text-slate-400">La ocasión inspira cada detalle.</p></div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {occasions.map((item) => <button key={item.id} type="button" onClick={() => setOccasion(item.id)} aria-pressed={occasion === item.id} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition ${occasion === item.id ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50'}`}><SurpriseGiftIcon emoji={item.emoji} imageUrl={item.imageUrl} className="h-7 w-7 text-xl" /><span className="text-xs font-semibold text-slate-700">{item.name}</span></button>)}
                  <button type="button" onClick={() => setOccasion('otra')} aria-pressed={occasion === 'otra'} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition ${occasion === 'otra' ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50'}`}><span className="text-xl">✨</span><span className="text-xs font-semibold text-slate-700">Otra ocasión</span></button>
                </div>
                {occasion === 'otra' && <label className="mt-3 block text-xs font-semibold text-slate-700">¿Qué celebramos?<input autoFocus value={customOccasionName} onChange={(event) => setCustomOccasionName(event.target.value.slice(0, 40))} maxLength={40} placeholder="Ej. Graduación, Día de las Madres…" className="mt-1.5 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" /><span className="mt-1 block text-right text-[10px] font-normal text-slate-400">{customOccasionName.length}/40</span></label>}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="mb-3"><h3 className="text-xs font-semibold text-slate-800">¿Para quién es?</h3><p className="mt-1 text-[10px] text-slate-500">Estos datos afinan las sugerencias. Son opcionales y puedes dejar alguno sin especificar.</p></div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="text-[10px] font-semibold text-slate-600">Género (opcional)<select value={recipientGender} onChange={(event) => setRecipientGender(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-700 outline-none focus:border-violet-400">{genders.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                    <label className="text-[10px] font-semibold text-slate-600">Edad (opcional)<select value={recipientAge} onChange={(event) => setRecipientAge(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-700 outline-none focus:border-violet-400">{ages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                    <label className="text-[10px] font-semibold text-slate-600">Estilo preferido<select value={recipientStyle} onChange={(event) => setRecipientStyle(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-700 outline-none focus:border-violet-400">{styles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                  </div>
                  <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-[10px] leading-4 text-violet-800">{recipientAge === 'sin-especificar' && recipientStyle === 'automatico' ? 'Las opciones se ordenan según la ocasión; puedes elegir el estilo y la edad para afinarlas.' : `Sugerencias adaptadas a ${recipientContext}${recipientStyle !== 'automatico' ? ` · estilo ${recipientStyle}` : ''}. El género no limita los productos.`}</p>
                </div>
              </section>

              <section className="rounded-[1.6rem] border border-white bg-white/85 p-5 shadow-[0_18px_50px_rgba(109,88,150,.08)] backdrop-blur sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-sm font-bold text-rose-700">03</span><div><h2 className="font-semibold text-slate-800">Arma la sorpresa</h2><p className="text-xs text-slate-400">Selecciona lo que quieres incluir.</p></div></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">{selectedItems.length} seleccionados</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {giftItems.map((item) => {
                    const checked = selectedItems.includes(item.id);
                    return <button key={item.id} type="button" onClick={() => toggleItem(item.id)} aria-pressed={checked} className={`group relative flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${checked ? 'border-violet-300 bg-violet-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <SurpriseGiftIcon emoji={item.emoji} imageUrl={item.imageUrl} className="h-11 w-11 rounded-xl bg-white text-2xl shadow-sm" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{item.name}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400">{catalogItemIds.includes(item.id) ? (getCatalogChoice(item.id)?.name ?? 'Elige una opción') : item.detail}</span><span className="mt-1 block text-[10px] font-bold text-violet-700">{item.id === 'producto-personalizado' ? 'Precio según diseño' : catalogItemIds.includes(item.id) ? (getCatalogChoice(item.id) ? `+$${getCatalogChoice(item.id)?.price} MXN · Cambiar` : 'Elegir producto') : `+$${item.price} MXN`}</span></span>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${checked ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}><Check size={12} /></span>
                      {item.id === 'fotos' && photos.some(Boolean) && <span className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-40 w-full rounded-xl border border-rose-100 bg-white p-3 opacity-0 shadow-xl transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"><span className="mb-2 block text-[10px] font-semibold text-slate-600">Vista previa de tus fotos · {photos.filter(Boolean).length}/6</span><span className="grid grid-cols-3 gap-1.5">{photos.map((photo, photoIndex) => <span key={photoIndex} className="aspect-square overflow-hidden rounded-md bg-rose-50">{photo ? <img src={photo.src} alt={`Vista previa foto ${photoIndex + 1}`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[9px] text-rose-300">{photoIndex + 1}</span>}</span>)}</span></span>}
                    </button>;
                  })}
                </div>
                {selectedItems.includes('carta') && <button type="button" onClick={() => { setLetterDraft(letterText); setLetterOpen(true); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-50">💌 {letterText ? 'Editar carta' : 'Abrir carta especial'}</button>}
                <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-700">Espacio de la caja</p><p className="mt-1 text-[11px] text-slate-500">Tu caja está al {capacityPercent}% de su capacidad</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-violet-700">{boxSize === 'premium' ? 'Capacidad extendida' : 'Capacidad estándar'}</span></div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full transition-all ${capacityPercent > 100 ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-500 to-rose-400'}`} style={{ width: `${Math.min(capacityPercent, 100)}%` }} /></div>
                  {capacityWarning && <p role="status" className="mt-3 text-xs font-medium text-rose-700">{capacityWarning}</p>}
                  {usedVolume > activePresentation.capacity && boxSize === 'standard' && usedVolume <= activePresentation.extendedCapacity && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3"><p className="text-[11px] text-slate-600">Te conviene más espacio para esta presentación.</p><button type="button" onClick={() => { setBoxSize('premium'); setCapacityWarning(''); }} className="rounded-lg bg-violet-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-violet-800">Ampliar capacidad +${pricing.premiumBoxSurcharge}</button></div>}
                  {usedVolume > activePresentation.extendedCapacity && <p role="status" className="mt-3 rounded-xl bg-rose-50 p-3 text-[11px] font-medium text-rose-700">Los artículos superan el máximo de esta presentación. Quita algún elemento o elige otra forma.</p>}
                  {boxSize === 'premium' && usedVolume <= activePresentation.capacity && selectedProducts.length <= 1 && <button type="button" onClick={() => setBoxSize('standard')} className="mt-2 text-[10px] font-medium text-violet-700 underline">Volver a caja estándar</button>}
                </div>
                {selectedItems.includes('fotos') && <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-800">Tus 6 fotos favoritas</p><p className="mt-1 text-[10px] text-slate-500">Súbelas y ajusta el encuadre de cada impresión.</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] text-slate-500">{photos.filter(Boolean).length}/6</span></div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo, index) => <div key={index} className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100"><label className="block cursor-pointer"><div className="relative aspect-[4/3] overflow-hidden bg-slate-100">{photo ? <img src={photo.src} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" style={{ transform: `scale(${photo.zoom})`, objectPosition: `${photo.x}% center` }} /> : <div className="grid h-full place-items-center text-center text-slate-400"><Camera size={20} /><span className="mt-1 text-[9px]">Subir foto {index + 1}</span></div>}<input type="file" accept="image/*" className="sr-only" onChange={(event) => loadPhoto(index, event)} /></div><span className="mt-2 block text-center text-[9px] font-medium text-slate-500">{photo ? 'Cambiar foto' : 'Elegir imagen'}</span></label>{photo && <div className="mt-2 space-y-1.5"><label className="flex items-center gap-1 text-[9px] text-slate-500"><ZoomIn size={11} /><input aria-label={`Acercar foto ${index + 1}`} type="range" min="1" max="2.5" step="0.05" value={photo.zoom} onChange={(event) => updatePhoto(index, { zoom: Number(event.target.value) })} className="w-full accent-violet-600" /></label><input aria-label={`Mover encuadre de foto ${index + 1}`} type="range" min="0" max="100" value={photo.x} onChange={(event) => updatePhoto(index, { x: Number(event.target.value) })} className="w-full accent-rose-500" /></div>}</div>)}</div>
                </div>}
              </section>



              <section className="rounded-[1.6rem] border border-white bg-white/85 p-5 shadow-[0_18px_50px_rgba(109,88,150,.08)] backdrop-blur sm:p-6">
                <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-sm font-bold text-amber-700">04</span><div><h2 className="font-semibold text-slate-800">Personaliza el exterior</h2><p className="text-xs text-slate-400">Elige el forrado de la tapa y la base.</p></div></div>
                <div className="flex flex-wrap gap-2">
                  {boxStyles.map((style) => <button key={style.id} type="button" onClick={() => { setBoxStyleId(style.id); setBaseColor(style.color); setLidColor(style.color); }} aria-label={`Caja ${style.name}`} aria-pressed={boxStyleId === style.id} className={`group flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${boxStyleId === style.id ? 'border-slate-700 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}><span className="h-4 w-4 rounded-full border border-black/5" style={{ backgroundColor: style.color }} />{style.name}</button>)}
                </div>
                {activePresentation.id === 'clasica-cuadrada' && <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2"><div><p className="text-xs font-semibold text-slate-700">Forrado de la tapa</p><div className="mt-2 flex flex-wrap gap-2">{boxStyles.map((style) => <button key={`lid-${style.id}`} type="button" onClick={() => setLidColor(style.color)} aria-label={`Forrado de tapa ${style.name}`} aria-pressed={lidColor === style.color} className={`h-7 w-7 rounded-full border-2 ${lidColor === style.color ? 'border-slate-800 ring-2 ring-slate-200' : 'border-white shadow ring-1 ring-slate-200'}`} style={{ backgroundColor: style.color }} />)}</div></div><div><p className="text-xs font-semibold text-slate-700">Forrado de la base</p><div className="mt-2 flex flex-wrap gap-2">{boxStyles.map((style) => <button key={`base-${style.id}`} type="button" onClick={() => setBaseColor(style.color)} aria-label={`Forrado de base ${style.name}`} aria-pressed={baseColor === style.color} className={`h-7 w-7 rounded-full border-2 ${baseColor === style.color ? 'border-slate-800 ring-2 ring-slate-200' : 'border-white shadow ring-1 ring-slate-200'}`} style={{ backgroundColor: style.color }} />)}</div></div></div>}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-semibold text-slate-700">Color del listón</p><p className="mt-0.5 text-[10px] text-slate-400">Elige un color disponible para combinarlo con cualquier caja.</p><div className="mt-2 flex flex-wrap gap-2">{ribbonColors.map((item) => <button key={item.id} type="button" onClick={() => setRibbonColorId(item.id)} aria-label={`Listón ${item.name}`} title={item.name} aria-pressed={ribbonColorId === item.id} className={`h-8 w-8 rounded-full border-2 transition ${ribbonColorId === item.id ? 'scale-110 border-slate-800 ring-2 ring-slate-200' : 'border-white shadow ring-1 ring-slate-200'}`} style={{ backgroundColor: item.color }} />)}</div></div>
                <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <input type="checkbox" checked={ribbonEnabled} onChange={(event) => setRibbonEnabled(event.target.checked)} className="h-4 w-4 accent-violet-600" />
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600"><Gift size={16} /></span>
                  <span className="flex-1"><span className="block text-xs font-semibold text-slate-700">Moño de regalo</span><span className="text-[10px] text-slate-400">Un detalle para el momento de abrirla</span></span>
                  <span className="text-xs font-semibold text-violet-700">Incluido</span>
                </label>
                <label className="mt-4 block text-xs font-semibold text-slate-700">Un mensaje para acompañar
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={140} rows={2} placeholder="Escribe unas palabras especiales…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
                  <span className="mt-1 block text-right text-[10px] font-normal text-slate-400">{message.length}/140</span>
                </label>
              </section>
            </div>

            <aside className="xl:sticky xl:top-24">
              <section className="overflow-hidden rounded-[1.8rem] border border-white bg-white/90 shadow-[0_24px_70px_rgba(109,88,150,.14)] backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 px-5 py-4">
                  <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-500">Tu regalo va tomando forma</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-800">Vista de la sorpresa</h2></div>
                  <div className="flex items-center gap-2"><button type="button" onClick={() => setBoxClosed((value) => !value)} aria-pressed={boxClosed} className="rounded-full border border-violet-200 bg-white px-3 py-2 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-50">{boxClosed ? 'Ver caja abierta' : 'Ver caja cerrada'}</button><button type="button" onClick={enableDeviceTilt} className="rounded-full bg-emerald-50 px-2.5 py-2 text-[10px] font-semibold text-emerald-700">{tiltEnabled ? 'Movimiento activo' : 'Activar movimiento'}</button></div>
                </div>
                <div className="relative grid min-h-[370px] place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,.95),transparent_44%),linear-gradient(145deg,#fbf7ff,#f4efff_55%,#fdf1f6)] px-5 py-8" onPointerMove={trackPointerTilt} onPointerLeave={() => !tiltEnabled && setTilt({ x: 0, y: 0 })}>
                  <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(#b8a5d6 0.7px, transparent 0.7px)', backgroundSize: '18px 18px' }} />
                  <div className="relative w-full max-w-[360px]" style={{ perspective: '900px', transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform 180ms ease-out' }}>
                    <div className={`relative z-20 mx-auto flex h-24 w-[90%] items-center justify-center border-[8px] border-b-0 border-white/75 shadow-[0_15px_25px_rgba(94,65,120,.14)] ${activePresentation.shape === 'round' ? 'rounded-[50%/35%]' : 'rounded-t-[2rem]'}`} style={{ backgroundColor: `${activePresentation.id === 'clasica-cuadrada' ? lidColor : baseColor}dd`, transform: `translateZ(28px) rotateX(${boxClosed ? '0deg' : '-12deg'}) translateY(${boxClosed ? '72px' : '0px'})`, transformOrigin: 'bottom center', transition: 'transform 850ms cubic-bezier(.2,.8,.2,1)', boxShadow: '0 15px 25px rgba(94,65,120,.18)' }}>
                      <span className={`rounded-lg bg-white/75 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-slate-600 shadow-sm transition-opacity ${boxClosed ? 'opacity-0' : 'opacity-100'}`}>{activeOccasion.name}</span>
                    </div>
                    <div className={`relative z-10 -mt-1 grid min-h-40 grid-cols-3 items-center justify-items-center gap-1 overflow-hidden border-[9px] border-t-[6px] border-white/80 px-3 py-3 shadow-[0_22px_26px_rgba(94,65,120,.18)] ${activePresentation.shape === 'round' ? 'rounded-[50%/18%]' : activePresentation.shape === 'explosion' ? 'rounded-md' : 'rounded-[1.35rem]'}`} style={{ backgroundColor: baseColor, transform: 'translateZ(8px)', transition: 'background-color 350ms' }}>
                      <div className="pointer-events-none absolute inset-x-2 bottom-1 z-0 h-10 rounded-b-xl opacity-70" style={{ background: `repeating-linear-gradient(35deg, ${ribbonColor}88 0 3px, transparent 3px 8px), repeating-linear-gradient(-24deg, #fff9 0 2px, transparent 2px 7px)` }} />
                      {activePresentation.shape === 'explosion' && [0, 1, 2, 3].map((face) => <div key={`face-${face}`} className={`pointer-events-none absolute z-0 overflow-hidden rounded-md border-2 border-white/80 bg-white/45 shadow-sm ${face === 0 ? 'inset-x-4 top-2 h-8' : face === 1 ? 'inset-x-4 bottom-2 h-8' : face === 2 ? 'bottom-12 left-2 top-12 w-8' : 'bottom-12 right-2 top-12 w-8'}`}>{photos[face] && <img src={photos[face]?.src} alt="" className="h-full w-full object-cover" />}{!photos[face] && <span className="grid h-full place-items-center px-1 text-center text-[8px] font-semibold text-slate-600">{message.slice(0, 24) || 'Tu mensaje'}</span>}</div>)}
                      {chosenItems.length ? chosenItems.slice(0, 6).flatMap((item) => item.id === 'producto-personalizado' ? selectedProducts.slice(0, 3).map((productId) => ({ id: `product-${productId}`, emoji: '🎨', imageUrl: '' })) : catalogItemIds.includes(item.id) ? [{ id: item.id, emoji: getCatalogChoice(item.id)?.emoji ?? item.emoji, imageUrl: getCatalogChoice(item.id)?.imageUrl ?? item.imageUrl ?? '' }] : [{ id: item.id, emoji: item.emoji, imageUrl: item.imageUrl ?? '' }]).map((item, index) => <span key={item.id} className={`relative z-10 grid h-[4.4rem] w-[4.4rem] place-items-center overflow-hidden text-4xl transition-all duration-700 ${boxClosed ? 'translate-y-8 scale-75 opacity-0' : 'opacity-100'} ${index % 2 ? 'rotate-3' : '-rotate-3'}`} style={{ filter: 'drop-shadow(0 12px 5px rgba(79,42,75,.32))', transform: `translateZ(${20 + index * 3}px) ${boxClosed ? 'translateY(38px) scale(.7)' : ''}`, transitionDelay: `${index * 35}ms` }}>{item.id === 'fotos' && photos.some(Boolean) ? <span className="grid h-full w-full grid-cols-2 gap-0.5 rounded-sm bg-white p-1">{photos.filter(Boolean).slice(0, 4).map((photo, photoIndex) => photo && <img key={photoIndex} src={photo.src} alt="" className="h-full w-full object-cover" />)}</span> : <SurpriseGiftIcon emoji={item.emoji} imageUrl={item.imageUrl} className="h-full w-full text-4xl" />}</span>) : <div className="relative z-10 col-span-3 py-8 text-center text-xs font-medium text-slate-500">Agrega detalles para llenar la sorpresa</div>}
                      {ribbonEnabled && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-4 -translate-x-1/2 opacity-80" style={{ backgroundColor: ribbonColor }} />}
                    </div>
                    {ribbonEnabled && <div aria-hidden="true" className="absolute left-1/2 z-30 h-12 w-16 -translate-x-1/2 drop-shadow-md" style={{ top: boxClosed ? '3.8rem' : '-1.25rem', transform: `translateX(-50%) translateZ(45px) scale(${boxClosed ? 1.1 : 1})`, transition: 'top 850ms cubic-bezier(.2,.8,.2,1), transform 850ms cubic-bezier(.2,.8,.2,1)' }}>
                      <span className="absolute left-1 top-1 h-7 w-8 rounded-[80%_20%_70%_30%] border border-black/10 shadow-inner" style={{ backgroundColor: ribbonColor, transform: 'rotate(28deg)' }} />
                      <span className="absolute right-1 top-1 h-7 w-8 rounded-[20%_80%_30%_70%] border border-black/10 shadow-inner" style={{ backgroundColor: ribbonColor, transform: 'rotate(-28deg)' }} />
                      <span className="absolute left-1/2 top-3 h-5 w-5 -translate-x-1/2 rounded-md border border-black/10 shadow-sm" style={{ backgroundColor: ribbonColor }} />
                      <span className="absolute left-3 top-6 h-6 w-3 border border-black/10 shadow-sm" style={{ backgroundColor: ribbonColor, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)', transform: 'rotate(12deg)' }} />
                      <span className="absolute right-3 top-6 h-6 w-3 border border-black/10 shadow-sm" style={{ backgroundColor: ribbonColor, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)', transform: 'rotate(-12deg)' }} />
                    </div>}
                    <div className="mx-auto h-5 w-[86%] rounded-b-full bg-slate-900/10 blur-md" />
                  </div>
                  {message.trim() && <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-center text-xs font-medium italic text-slate-600 shadow-sm backdrop-blur">“{message}”</div>}
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-700">{chosenItems.length} detalles seleccionados</p><p className="mt-0.5 text-[10px] text-slate-400">{activeOccasion.name} · Para: {recipientContext}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Package size={17} /></span></div>
                  <div className="flex flex-wrap gap-1.5">{chosenItems.map((item) => item.id === 'producto-personalizado' ? selectedProducts.map((productId) => { const product = products.find((candidate) => candidate.id === productId); return product && <span key={product.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">🎨 {product.name}</span>; }) : <span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600"><SurpriseGiftIcon emoji={getCatalogChoice(item.id)?.emoji ?? item.emoji} imageUrl={getCatalogChoice(item.id)?.imageUrl ?? item.imageUrl} className="mr-1 inline-grid h-4 w-4 align-middle" />{getCatalogChoice(item.id)?.name ?? item.name}</span>)}</div>
                  <div className="space-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    <div className="flex justify-between"><span>{activePresentation.name}</span><span>${activePresentation.price.toLocaleString('es-MX')} MXN</span></div>
                    {boxSize === 'premium' && <div className="flex justify-between"><span>Capacidad extendida</span><span>+${pricing.premiumBoxSurcharge.toLocaleString('es-MX')} MXN</span></div>}
                    <div className="flex justify-between"><span>Detalles seleccionados</span><span>${itemsTotal.toLocaleString('es-MX')} MXN</span></div>
                  </div>
                  <div className="rounded-xl bg-violet-50 px-3 py-2.5"><div className="flex justify-between text-[10px] font-medium text-violet-800"><span>Capacidad {boxSize === 'premium' ? 'premium' : 'de la caja'}</span><span>{capacityPercent}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-rose-400" style={{ width: `${Math.min(capacityPercent, 100)}%` }} /></div></div>
                  <div className="flex items-end justify-between border-t border-slate-100 pt-4"><div><p className="text-[10px] text-slate-400">Estimado visual</p><p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-800">${estimate.toLocaleString('es-MX')} <span className="text-xs font-medium text-slate-400">MXN</span></p></div><button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-xs font-semibold text-white opacity-70">Continuar <ArrowRight size={14} /></button></div>
                  <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-400"><Star size={12} className="text-amber-400" /> Cada elemento y acabado se podrá confirmar al conectar el catálogo.</p>
                </div>
              </section>
              <section className="mt-4 rounded-2xl border border-white bg-white/75 p-4 shadow-sm">
                <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-500"><Image size={16} /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-700">¿Tienes fotos o una idea especial?</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Cuéntanos cómo quieres personalizar este regalo.</p></div><button type="button" onClick={() => { setIdeaDraft(specialIdea); setIdeaTargetDraft(ideaTarget); setReferencePhotoDraft(referencePhoto); setIdeaOpen(true); }} className="shrink-0 rounded-xl bg-violet-700 px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-violet-800">{specialIdea || referencePhoto ? 'Editar idea' : 'Cuéntanos tu idea'}</button></div>
                {(specialIdea || referencePhoto) && <div className="mt-3 flex items-start gap-3 rounded-xl bg-violet-50 p-3">{referencePhoto && <img src={referencePhoto} alt="Referencia para la idea especial" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}<div className="min-w-0"><p className="text-[10px] font-semibold text-violet-800">Nota para {ideaTarget === 'caja' ? 'la caja' : ideaTarget === 'peluche' ? 'el peluche' : ideaTarget === 'productos' ? 'los productos' : 'el acomodo'}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-600">{specialIdea || 'Imagen de referencia agregada.'}</p><p className="mt-1 text-[9px] text-slate-400">Ocasión: {activeOccasion.name} · {selectedProductNames.length ? selectedProductNames.join(', ') : 'sin productos seleccionados'}</p></div></div>}
              </section>
            </aside>
          </div>
          <p className="mt-7 text-center text-[10px] text-slate-400">Propuesta visual · La selección todavía no se guarda ni se agrega al carrito.</p>
        </div>
      </section>
      {letterOpen && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setLetterOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="letter-title" className="my-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700"><Heart size={12} /> Carta especial · +${giftItems.find((item) => item.id === 'carta')?.price ?? 0} MXN</span><h2 id="letter-title" className="mt-3 text-xl font-semibold text-slate-800">Redacta tu carta</h2><p className="mt-1 text-xs leading-5 text-slate-500">Crea un primer borrador y edítalo para que suene a ti.</p></div><button type="button" aria-label="Cerrar" onClick={() => setLetterOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
          <label className="mt-5 block text-xs font-semibold text-slate-700">¿Para quién es?<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Nombre o apodo" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" /></label>
          <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-700">Tu mensaje</span><button type="button" onClick={draftLetter} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-violet-800"><Sparkles size={13} />Redactar</button></div>
          <textarea value={letterDraft} onChange={(event) => setLetterDraft(event.target.value)} maxLength={1200} rows={9} placeholder="Pulsa Redactar para obtener una sugerencia o empieza a escribir tu carta…" className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Borrador local basado en la ocasión: {activeOccasion.name.toLowerCase()}.</span><span>{letterDraft.length}/1200</span></div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setLetterOpen(false)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">Cancelar</button><button type="button" onClick={() => { setLetterText(letterDraft.trim()); setLetterOpen(false); }} disabled={!letterDraft.trim()} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Guardar carta</button></div>
        </section>
      </div>}
      {catalogModalCategory && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setCatalogModalCategory(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="gift-catalog-title" className="my-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
          <div className="mt-1 rounded-lg bg-violet-50 px-3 py-2 text-[10px] text-violet-800">Recomendaciones para {activeOccasion.name.toLowerCase()} · {recipientContext}{recipientStyle !== 'automatico' ? ` · estilo ${recipientStyle}` : ''}</div>
          <div className="mt-4 space-y-2">{getRecommendedCatalogOptions(catalogModalCategory).map((option) => { const selected = catalogDraftId === option.id; return <button key={option.id} type="button" onClick={() => setCatalogDraftId(option.id)} aria-pressed={selected} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 hover:border-violet-200 hover:bg-violet-50/40'}`}><SurpriseGiftIcon emoji={option.emoji} imageUrl={option.imageUrl} className="h-12 w-12 rounded-xl bg-white text-3xl shadow-sm" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800">{option.name}</span><span className="mt-1 block text-[10px] text-slate-500">{option.detail}</span><span className="mt-1 block text-[10px] font-bold text-violet-700">+${option.price} MXN</span></span>{option.recommended && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-800">Recomendado</span>}<span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}><Check size={12} /></span></button>; })}</div>
          {catalogModalCategory && selectedItems.includes(catalogModalCategory) && <button type="button" onClick={() => setCatalogDraftId('')} className={`mt-3 rounded-lg px-2 py-1.5 text-[11px] font-medium ${catalogDraftId === '' ? 'text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}>Quitar este producto de la caja</button>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCatalogModalCategory(null)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">Cancelar</button><button type="button" onClick={saveCatalogSelection} disabled={!catalogDraftId && !selectedItems.includes(catalogModalCategory)} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{catalogDraftId ? 'Agregar a la caja' : 'Quitar de la caja'}</button></div>
        </section>
      </div>}
      {ideaOpen && <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setIdeaOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="special-idea-title" className="my-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700"><Sparkles size={12} /> Idea especial · {activeOccasion.name}</span><h2 id="special-idea-title" className="mt-3 text-xl font-semibold text-slate-800">Cuéntanos cómo imaginas tu regalo</h2><p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">Usa una sugerencia o escribe lo que tienes en mente. La nota y la referencia quedarán juntas en el resumen.</p></div><button type="button" aria-label="Cerrar" onClick={() => setIdeaOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_.85fr]">
            <div><label className="block text-xs font-semibold text-slate-700">¿Qué te gustaría personalizar?<select value={ideaTargetDraft} onChange={(event) => setIdeaTargetDraft(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"><option value="caja">La caja por fuera o por dentro</option><option value="peluche">El oso de peluche</option><option value="productos">Uno de los productos</option><option value="acomodo">El acomodo y la presentación</option></select></label>
              <label className="mt-4 block text-xs font-semibold text-slate-700">Describe tu idea<textarea value={ideaDraft} onChange={(event) => setIdeaDraft(event.target.value)} maxLength={500} rows={6} placeholder="Ej. Quiero tonos azul y plata, con una estrella y la fecha en la tapa…" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal leading-5 text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" /></label><p className="mt-1 text-right text-[10px] text-slate-400">{ideaDraft.length}/500</p>
              <div className="mt-3"><p className="mb-2 text-[10px] font-semibold text-slate-600">Ideas para {activeOccasion.name.toLowerCase()}</p><div className="flex flex-wrap gap-1.5">{currentIdeaSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => setIdeaDraft((current) => current ? `${current.trim()} ${suggestion}` : suggestion)} className="rounded-full border border-violet-100 bg-violet-50/70 px-2.5 py-1.5 text-left text-[9px] leading-4 text-violet-800 transition hover:bg-violet-100">+ {suggestion}</button>)}</div></div>
            </div>
            <div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-700">Foto de referencia</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Sube una imagen de inspiración, colores o acomodo.</p></div><Image size={17} className="text-violet-500" /></div>
              {referencePhotoDraft ? <div className="relative mt-3 overflow-hidden rounded-xl bg-white"><img src={referencePhotoDraft} alt="Vista previa de la referencia" className="max-h-52 w-full object-contain" /><button type="button" onClick={() => setReferencePhotoDraft('')} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-600 shadow" aria-label="Quitar referencia"><X size={14} /></button></div> : <label className="mt-3 grid min-h-36 cursor-pointer place-items-center rounded-xl border border-dashed border-violet-200 bg-white p-4 text-center transition hover:border-violet-400"><span><Image size={22} className="mx-auto text-violet-400" /><span className="mt-2 block text-xs font-semibold text-slate-700">Subir imagen</span><span className="mt-1 block text-[10px] text-slate-400">JPG, PNG o WebP · máximo 8 MB</span></span><input type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={loadReferencePhoto} className="sr-only" /></label>}
              {referencePhotoError && <p role="alert" className="mt-2 text-[10px] text-rose-600">{referencePhotoError}</p>}
            </div><div className="mt-3 rounded-2xl bg-violet-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-violet-800">Resumen de tu idea</p><p className="mt-1 text-xs leading-5 text-slate-600">Para <strong>{activeOccasion.name.toLowerCase()}</strong> y <strong>{recipientContext}</strong>, quieres personalizar <strong>{ideaTargetDraft === 'caja' ? 'la caja' : ideaTargetDraft === 'peluche' ? 'el oso' : ideaTargetDraft === 'productos' ? 'un producto' : 'la presentación'}</strong>{selectedProductNames.length ? ` junto con ${selectedProductNames.join(', ')}` : ''}{referencePhotoDraft ? ', usando también tu imagen como referencia.' : '.'}</p><p className="mt-2 text-[10px] text-violet-700">{ideaDraft.trim() || 'Agrega una nota o una foto para completar la solicitud.'}</p></div></div>
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-2"><button type="button" onClick={() => { setSpecialIdea(''); setReferencePhoto(''); setReferencePhotoDraft(''); setIdeaDraft(''); setIdeaOpen(false); }} className="rounded-xl px-3 py-2.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50">Borrar solicitud</button><div className="flex gap-2"><button type="button" onClick={() => setIdeaOpen(false)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">Cancelar</button><button type="button" onClick={() => { setSpecialIdea(ideaDraft.trim()); setIdeaTarget(ideaTargetDraft); setReferencePhoto(referencePhotoDraft); setIdeaOpen(false); }} disabled={!ideaDraft.trim() && !referencePhotoDraft} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Guardar idea</button></div></div>
          <p className="mt-3 text-center text-[9px] text-slate-400">La solicitud se conserva en esta página durante esta sesión; todavía no se envía con un pedido.</p>
        </section>
      </div>}
      {productsModalOpen && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductsModalOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="custom-products-title" className="my-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700"><Package size={12} /> Diseños guardados</span><h2 id="custom-products-title" className="mt-3 text-xl font-semibold text-slate-800">Elige tus productos personalizados</h2><p className="mt-1 text-xs leading-5 text-slate-500">Selecciona productos que ya diseñaste y guardaste en este navegador.</p></div><button type="button" aria-label="Cerrar" onClick={() => setProductsModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50 p-3"><div><p className="text-xs font-semibold text-violet-900">{selectedProducts.length}/{boxSize === 'premium' ? 3 : 1} productos seleccionados</p><p className="mt-1 text-[10px] text-violet-700">{boxSize === 'premium' ? 'Con capacidad extendida puedes agregar hasta 3 productos.' : 'La configuración estándar permite 1 producto personalizado.'}</p></div>{boxSize !== 'premium' && <button type="button" onClick={() => { setBoxSize('premium'); setCapacityWarning(''); }} className="rounded-xl bg-violet-700 px-3 py-2.5 text-[10px] font-semibold text-white hover:bg-violet-800">Ampliar capacidad · +${pricing.premiumBoxSurcharge} MXN</button>}</div>
          {savedProducts.length ? <div className="mt-4 grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">{savedProducts.map((product) => { const selected = selectedProducts.includes(product.id); const disabled = !selected && selectedProducts.length >= (boxSize === 'premium' ? 3 : 1); return <div key={product.id} className={`rounded-2xl border p-3 transition ${selected ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200'}`}><button type="button" onClick={() => toggleProduct(product.id)} disabled={disabled} aria-pressed={selected} className={`flex w-full items-center gap-3 text-left ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}><span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">{product.views[0]?.mockupUrl ? <img src={product.views[0].mockupUrl} alt="" className="h-full w-full object-contain" /> : <Package size={21} className="text-slate-400" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{product.name}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{product.category} · ${product.price.toLocaleString('es-MX')} MXN</span></span><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}><Check size={12} /></span></button><a href={`/editor/${product.id}`} target="_blank" rel="noreferrer" onClick={() => { if (!selected && !disabled) toggleProduct(product.id); }} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-violet-700"><Sparkles size={12} />Abrir editor 3D para ajustar estampado</a></div>; })}</div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm"><Package size={20} /></span><p className="mt-3 text-sm font-semibold text-slate-700">Aún no hay diseños guardados</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Diseña un producto y guarda el borrador en el editor. Aparecerá aquí para agregarlo a tu sorpresa.</p></div>}
          <div className="mt-5 flex justify-end"><button type="button" onClick={() => setProductsModalOpen(false)} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white">Listo</button></div>
        </section>
      </div>}
    </main>
  );
}
