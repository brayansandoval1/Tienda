export const occasions = [
  { id: 'cumpleanos', name: 'Cumpleaños', emoji: '🎂', imageUrl: '' },
  { id: 'boda', name: 'Boda', emoji: '💍', imageUrl: '' },
  { id: 'aniversario', name: 'Aniversario', emoji: '💝', imageUrl: '' },
  { id: 'sorpresa', name: 'Solo porque sí', emoji: '✨', imageUrl: '' },
];

export const giftItems = [
  { id: 'peluche', name: 'Oso de peluche', detail: 'Suave y abrazable', emoji: '🧸', imageUrl: '', price: 320 },
  { id: 'producto-personalizado', name: 'Producto personalizado', detail: 'Elige entre tus diseños guardados', emoji: '🎨', imageUrl: '', price: 0 },
  { id: 'fotos', name: 'Fotos favoritas', detail: 'Set de 6 impresiones', emoji: '📸', imageUrl: '', price: 90 },
  { id: 'dulces', name: 'Dulces y chocolates', detail: 'Un toque delicioso', emoji: '🍫', imageUrl: '', price: 140 },
  { id: 'carta', name: 'Carta especial', detail: 'Escrita para esa persona', emoji: '💌', imageUrl: '', price: 60 },
  { id: 'flores', name: 'Flores preservadas', detail: 'Un detalle que perdura', emoji: '🌷', imageUrl: '', price: 230 },
];

export const boxStyles = [
  { id: 'rosa', name: 'Rosa pastel', color: '#f5b8cf', ribbon: '#c64e83' },
  { id: 'lavanda', name: 'Lavanda', color: '#c9b9ee', ribbon: '#7657b8' },
  { id: 'crema', name: 'Crema', color: '#ead9ba', ribbon: '#a47a46' },
  { id: 'menta', name: 'Menta', color: '#b4ddd0', ribbon: '#4e9b83' },
];

export const ribbonColors = [
  { id: 'rosa-liston', name: 'Rosa', color: '#c64e83' },
  { id: 'lavanda-liston', name: 'Lavanda', color: '#7657b8' },
  { id: 'dorado-liston', name: 'Dorado', color: '#a47a46' },
  { id: 'menta-liston', name: 'Menta', color: '#4e9b83' },
];

const itemVolumes: Record<string, number> = { peluche: 34, 'producto-personalizado': 23, fotos: 8, dulces: 20, carta: 4, flores: 25 };
const catalogOptions: Record<string, Record<string, Array<{ id: string; name: string; detail: string; emoji: string; imageUrl?: string; price: number; volume: number }>>> = {
  cumpleanos: {
    peluche: [
      { id: 'oso-cumple-clasico', name: 'Oso abrazable', detail: 'Peluche suave con moño', emoji: '🧸', price: 320, volume: 34 },
      { id: 'oso-cumple-fiesta', name: 'Oso cumpleañero', detail: 'Con gorrito de fiesta', emoji: '🐻', price: 390, volume: 38 },
      { id: 'oso-cumple-mini', name: 'Osito mini', detail: 'Pequeño y adorable', emoji: '🐻‍❄️', price: 220, volume: 22 },
    ],
    dulces: [
      { id: 'dulces-cumple-caja', name: 'Caja de chocolates', detail: 'Selección para celebrar', emoji: '🍫', price: 140, volume: 20 },
      { id: 'dulces-cumple-color', name: 'Dulces de colores', detail: 'Mezcla alegre para compartir', emoji: '🍬', price: 110, volume: 18 },
      { id: 'dulces-cumple-premium', name: 'Trufas premium', detail: 'Presentación especial', emoji: '🍬', price: 210, volume: 17 },
    ],
    flores: [
      { id: 'flores-cumple-rosa', name: 'Ramo de rosas', detail: 'Tonos suaves de cumpleaños', emoji: '🌹', price: 230, volume: 25 },
      { id: 'flores-cumple-mixto', name: 'Mini ramo mixto', detail: 'Flores de temporada', emoji: '💐', price: 190, volume: 23 },
    ],
  },
  boda: {
    peluche: [
      { id: 'oso-boda-pareja', name: 'Ositos de pareja', detail: 'Dos peluches con detalle nupcial', emoji: '🧸', price: 450, volume: 40 },
      { id: 'oso-boda-blanco', name: 'Oso blanco', detail: 'Con moño elegante', emoji: '🐻‍❄️', price: 360, volume: 34 },
    ],
    dulces: [
      { id: 'dulces-boda-trufas', name: 'Trufas para brindar', detail: 'Caja de chocolates finos', emoji: '🍫', price: 220, volume: 20 },
      { id: 'dulces-boda-corazon', name: 'Chocolates corazón', detail: 'Selección romántica', emoji: '💝', price: 180, volume: 18 },
    ],
    flores: [
      { id: 'flores-boda-blancas', name: 'Ramo blanco', detail: 'Arreglo en tonos marfil', emoji: '💐', price: 320, volume: 28 },
      { id: 'flores-boda-rosas', name: 'Rosas románticas', detail: 'Rosas con follaje delicado', emoji: '🌹', price: 280, volume: 25 },
    ],
  },
  aniversario: {
    peluche: [
      { id: 'oso-aniversario-corazon', name: 'Oso con corazón', detail: 'Un detalle para compartir', emoji: '🧸', price: 350, volume: 35 },
      { id: 'oso-aniversario-mini', name: 'Osito de bolsillo', detail: 'Suave y compacto', emoji: '🐻', price: 240, volume: 24 },
    ],
    dulces: [
      { id: 'dulces-aniversario-premium', name: 'Bombones de chocolate', detail: 'Caja para una ocasión especial', emoji: '🍫', price: 190, volume: 19 },
      { id: 'dulces-aniversario-fresas', name: 'Fresas cubiertas', detail: 'Chocolate y toque romántico', emoji: '🍓', price: 260, volume: 22 },
    ],
    flores: [
      { id: 'flores-aniversario-rosas', name: 'Rosas rojas', detail: 'Clásicas y románticas', emoji: '🌹', price: 290, volume: 26 },
      { id: 'flores-aniversario-mix', name: 'Ramo de temporada', detail: 'Colores cálidos y delicados', emoji: '💐', price: 250, volume: 25 },
    ],
  },
  sorpresa: {
    peluche: [
      { id: 'oso-sorpresa-clasico', name: 'Oso clásico', detail: 'Un abrazo inesperado', emoji: '🧸', price: 320, volume: 34 },
      { id: 'oso-sorpresa-mini', name: 'Osito mini', detail: 'Pequeño detalle sorpresa', emoji: '🐻', price: 220, volume: 22 },
    ],
    dulces: [
      { id: 'dulces-sorpresa-mix', name: 'Mix de dulces', detail: 'Una selección para alegrar el día', emoji: '🍬', price: 130, volume: 20 },
      { id: 'dulces-sorpresa-choco', name: 'Chocolates favoritos', detail: 'Un clásico para compartir', emoji: '🍫', price: 160, volume: 19 },
    ],
    flores: [
      { id: 'flores-sorpresa-mix', name: 'Flores de temporada', detail: 'Un ramo espontáneo', emoji: '💐', price: 230, volume: 24 },
      { id: 'flores-sorpresa-tulipan', name: 'Tulipanes', detail: 'Color y frescura', emoji: '🌷', price: 260, volume: 24 },
    ],
  },
};
export const catalogItemIds = ['peluche', 'dulces', 'flores'];

export const recipientOptions = {
  genders: [
    { id: 'sin-especificar', label: 'Prefiero no decirlo' },
    { id: 'mujer', label: 'Mujer' },
    { id: 'hombre', label: 'Hombre' },
    { id: 'otro', label: 'Otra identidad' },
  ],
  ages: [
    { id: 'sin-especificar', label: 'Sin especificar' },
    { id: 'nino', label: 'Niño/a · 3–12' },
    { id: 'adolescente', label: 'Adolescente · 13–17' },
    { id: 'joven', label: 'Joven · 18–29' },
    { id: 'adulto', label: 'Adulto/a · 30–59' },
    { id: 'mayor', label: 'Adulto/a mayor · 60+' },
  ],
  styles: [
    { id: 'automatico', label: 'Sugerir por ocasión' },
    { id: 'colorido', label: 'Colorido' },
    { id: 'romantico', label: 'Romántico' },
    { id: 'elegante', label: 'Elegante' },
    { id: 'divertido', label: 'Divertido' },
  ],
};

export const recommendationTerms = {
  ages: {
    nino: ['mini', 'oso', 'dulce', 'color', 'fiesta', 'mix'],
    adolescente: ['mix', 'favoritos', 'color', 'mini', 'trufas'],
    joven: ['premium', 'pareja', 'rosas', 'tulipanes', 'trufas'],
    adulto: ['clásico', 'blanco', 'premium', 'rosas', 'ramo'],
    mayor: ['clásico', 'blanco', 'ramo', 'bombones', 'rosas'],
  },
  styles: {
    colorido: ['colores', 'color', 'mix', 'temporada', 'fiesta', 'tulipanes'],
    romantico: ['romántic', 'corazón', 'rosa', 'pareja', 'trufas'],
    elegante: ['premium', 'blanco', 'fino', 'marfil', 'rosa', 'trufas'],
    divertido: ['mini', 'fiesta', 'dulce', 'color', 'mix', 'oso'],
  },
};

export const giftPricing = {
  boxBasePrice: 490,
  premiumBoxSurcharge: 80,
  standardCapacity: 100,
  premiumCapacity: 140,
};

export const ideaSuggestions: Record<string, string[]> = {
  cumpleanos: ['Usa colores alegres y una presentación festiva.', 'Agrega un detalle que represente sus gustos.', 'Coloca el mensaje en la parte superior de la caja.'],
  boda: ['Mantén una paleta elegante en tonos claros.', 'Acomoda los detalles con un estilo romántico.', 'Cuida que la presentación se vea delicada y especial.'],
  aniversario: ['Usa tonos cálidos y románticos.', 'Incluye un detalle que recuerde un momento juntos.', 'Presenta las flores y chocolates como protagonistas.'],
  sorpresa: ['Usa sus colores favoritos.', 'Esconde un pequeño detalle para descubrir al abrir la caja.', 'Combina los artículos para que se sienta personal.'],
};

export type SurpriseGiftConfig = {
  occasions: typeof occasions;
  giftItems: typeof giftItems;
  boxStyles: typeof boxStyles;
  ribbonColors: typeof ribbonColors;
  itemVolumes: typeof itemVolumes;
  catalogOptions: typeof catalogOptions;
  catalogItemIds: typeof catalogItemIds;
  recipientOptions: typeof recipientOptions;
  recommendationTerms: { ages: Record<string, string[]>; styles: Record<string, string[]> };
  pricing: typeof giftPricing;
  ideaSuggestions: typeof ideaSuggestions;
};

export const DEFAULT_SURPRISE_GIFT_CONFIG: SurpriseGiftConfig = {
  occasions, giftItems, boxStyles, ribbonColors, itemVolumes, catalogOptions, catalogItemIds,
  recipientOptions, recommendationTerms, pricing: giftPricing, ideaSuggestions,
};
