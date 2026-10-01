// ── Biblioteca de combinaciones tipográficas (estilo Canva) ────────────────
// Cada preset define, a la vez:
//   1. `layers`: propiedades literales de fabric.IText que EditorCanvas aplica
//      al crear el objeto (una capa = IText simple editable; dos o más capas =
//      fabric.Group apilado verticalmente con `gap` px de separación), y
//   2. `google`: qué familia/pesos de Google Fonts exige cada capa. Esos pesos
//      se inyectan con loadGoogleFonts() tanto en las tarjetas del panel (para
//      ver la tipografía REAL en la vista previa) como en el lienzo antes de
//      construir los objetos.
//   3. `tags`: palabras clave (minúsculas, sin acentos) que alimentan el
//      buscador del panel ("neon", "retro", "oferta", "parrilla", ...).
// Los tamaños de fuente están en px del lienzo lógico del mockup; el panel los
// escala con PREVIEW_SCALE para las miniaturas CSS (grid de 2 columnas).

import type { FontRequest } from '@/lib/googleFonts';

export type TypographyPresetCategory = 'titulos' | 'combinaciones';

export interface PresetTextLayer {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  fill: string;
  /** Trazo externo: usar junto a paintFirst: 'stroke' para no comer el relleno. */
  stroke?: string;
  strokeWidth?: number;
  paintFirst?: 'stroke' | 'fill';
  /** Sombra en formato compatible Fabric/CSS: "offsetX offsetY blur color". */
  shadow?: string;
  /** Espaciado Fabric (milésimas de em): 200 ≈ 0.2em en CSS. */
  charSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  /** Fondo sólo detrás del texto (barrera de color tipo "bloque"). */
  textBackgroundColor?: string;
  /** Inclinación del objeto en grados (efectos tipo distorsión / sello). */
  rotation?: number;
  /** Sesgo horizontal en grados (falsos itálicos / deformaciones expresivas). */
  skewX?: number;
  google?: { weights?: number[]; italicWeights?: number[] };
}

export interface TypographyPreset {
  id: string;
  name: string;
  category: TypographyPresetCategory;
  /** Palabras clave para el buscador (minúsculas y sin acentos). */
  tags: string[];
  /** Fondo CSS de la miniatura (oscuro para presets neón, papel para vintage). */
  previewBackground?: string;
  /** 1 capa → fabric.IText; 2+ → fabric.Group de IText apilados. */
  layers: PresetTextLayer[];
  /** Separación vertical (px de lienzo) entre capas del Group. */
  gap?: number;
  /** Alineación del bloque al apilar capas. */
  align?: 'left' | 'center';
}

export const TEXT_PRESET_CATEGORIES: { id: TypographyPresetCategory; label: string }[] = [
  { id: 'titulos', label: 'Títulos y Efectos' },
  { id: 'combinaciones', label: 'Combinaciones y Párrafos' },
];

/** Escala de las miniaturas CSS del panel respecto al lienzo (grid 2 col). */
export const PREVIEW_SCALE = 0.5;

/** Quita acentos y mayúsculas: el buscador debe ignorar ambas cosas. */
export const normalizePresetSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Un preset coincide con la consulta si TODOS los tokens escritos aparecen en
 * su nombre, etiquetas, familias de fuente o textos internos.
 */
export const presetMatchesQuery = (preset: TypographyPreset, rawQuery: string): boolean => {
  const query = normalizePresetSearch(rawQuery);
  if (!query) return true;
  const haystack = normalizePresetSearch(
    [
      preset.name,
      ...preset.tags,
      ...preset.layers.map((layer) => layer.fontFamily),
      ...preset.layers.map((layer) => layer.text),
    ].join(' '),
  );
  return query.split(/\s+/).every((token) => haystack.includes(token));
};

export const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  // ── Títulos y Efectos (IText simple o grupos de impacto) ────────────────
  {
    id: 'hero-bold',
    name: 'Hero Bold',
    category: 'titulos',
    tags: ['hero', 'bold', 'impacto', 'titulo', 'moderno', 'fuerte', 'anton'],
    layers: [
      {
        text: 'TÍTULO\nHEROICO',
        fontFamily: 'Anton',
        fontSize: 44,
        fontWeight: 400,
        fill: '#0f172a',
        lineHeight: 0.95,
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'retro-vintage',
    name: 'Retro Vintage',
    category: 'titulos',
    tags: ['retro', 'vintage', 'noventa', 'sombra', 'calido', 'clasico'],
    layers: [
      {
        text: "VINTAGE '98",
        fontFamily: 'Righteous',
        fontSize: 36,
        fontWeight: 400,
        fill: '#b45309',
        stroke: '#fef3c7',
        strokeWidth: 1.2,
        paintFirst: 'stroke',
        shadow: '4 4 0 #7c2d12',
        charSpacing: 60,
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'script-elegant',
    name: 'Script Elegante',
    category: 'titulos',
    tags: ['script', 'cursiva', 'elegante', 'boda', 'romantico', 'suave'],
    layers: [
      {
        text: 'Para siempre',
        fontFamily: 'Great Vibes',
        fontSize: 46,
        fontWeight: 400,
        fill: '#be185d',
        shadow: '2 3 5 rgba(190,24,93,0.35)',
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    category: 'titulos',
    previewBackground: '#0b1021',
    tags: ['neon', 'glow', 'abierto', '24/7', 'nocturno', 'negocio', 'brillo'],
    layers: [
      {
        text: 'OPEN 24/7',
        fontFamily: 'Audiowide',
        fontSize: 30,
        fontWeight: 400,
        fill: '#f0abfc',
        stroke: '#a21caf',
        strokeWidth: 0.8,
        paintFirst: 'stroke',
        shadow: '0 0 16 #22d3ee',
        charSpacing: 80,
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'mono-tech',
    name: 'Monospaced Tech',
    category: 'titulos',
    tags: ['tech', 'codigo', 'mono', 'moderno', 'digital', 'drop'],
    layers: [
      {
        text: '// NUEVO DROP\n// TEMPORADA 2026',
        fontFamily: 'Space Mono',
        fontSize: 20,
        fontWeight: 700,
        fill: '#e2e8f0',
        textBackgroundColor: '#0f172a',
        charSpacing: 120,
        lineHeight: 1.45,
        textAlign: 'center',
        google: { weights: [400, 700] },
      },
    ],
  },
  {
    id: 'minimal-serif',
    name: 'Minimal Serif',
    category: 'titulos',
    tags: ['minimal', 'serif', 'elegante', 'clean', 'boutique', 'moderno'],
    layers: [
      {
        text: 'ESSENCIAL',
        fontFamily: 'Cormorant Garamond',
        fontSize: 40,
        fontWeight: 300,
        fill: '#334155',
        charSpacing: 350,
        textAlign: 'center',
        google: { weights: [300, 400, 600] },
      },
    ],
  },

  {
    id: 'abierto-neon',
    name: '24/7 Abierto Neón',
    category: 'titulos',
    gap: 4,
    align: 'center',
    previewBackground: '#0b1021',
    tags: ['neon', 'glow', 'magenta', 'abierto', '24/7', 'horario', 'negocio', 'script', 'nocturno'],
    layers: [
      {
        text: '24/7 ABIERTO',
        fontFamily: 'Audiowide',
        fontSize: 28,
        fontWeight: 400,
        fill: '#f0abfc',
        stroke: '#e879f9',
        strokeWidth: 0.8,
        paintFirst: 'stroke',
        shadow: '0 0 18 #d946ef',
        charSpacing: 140,
        textAlign: 'center',
        google: { weights: [400] },
      },
      {
        text: 'todos los días del año',
        fontFamily: 'Great Vibes',
        fontSize: 26,
        fontWeight: 400,
        fill: '#a5f3fc',
        shadow: '0 0 12 #22d3ee',
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'salud-neon',
    name: '¡Salud! Distorsión',
    category: 'titulos',
    tags: ['neon', 'verde', 'salud', 'barra', 'bar', 'brindis', 'fiesta', 'noche', 'distorsion'],
    layers: [
      {
        text: '¡SALUD!',
        fontFamily: 'Bungee',
        fontSize: 44,
        fontWeight: 400,
        fill: '#bbf7d0',
        stroke: '#16a34a',
        strokeWidth: 1,
        paintFirst: 'stroke',
        shadow: '0 0 20 #22c55e',
        charSpacing: 160,
        rotation: -6,
        skewX: -8,
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'envio-gratis',
    name: 'Envío Gratis',
    category: 'titulos',
    tags: ['envio', 'gratis', 'delivery', 'promo', 'oferta', 'impacto', 'alto', 'dos lineas'],
    layers: [
      {
        text: 'ENVÍO\nGRATIS',
        fontFamily: 'Anton',
        fontSize: 50,
        fontWeight: 400,
        fill: '#111827',
        shadow: '4 4 0 #facc15',
        lineHeight: 0.92,
        charSpacing: 40,
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'queso-parmesano',
    name: 'Queso Parmesano',
    category: 'titulos',
    gap: 4,
    align: 'center',
    previewBackground: '#f5efe0',
    tags: ['vintage', 'grabado', 'sketch', 'queso', 'parmesano', 'artesanal', 'deli', 'italiano', 'etiqueta', 'comida'],
    layers: [
      {
        text: 'Queso Parmesano',
        fontFamily: 'Rye',
        fontSize: 30,
        fontWeight: 400,
        fill: '#44403c',
        textAlign: 'center',
        google: { weights: [400] },
      },
      {
        text: 'AUTÉNTICO · CURADO 24 MESES',
        fontFamily: 'Cormorant Garamond',
        fontSize: 12,
        fontWeight: 600,
        fill: '#78716c',
        charSpacing: 260,
        textAlign: 'center',
        google: { weights: [300, 400, 600] },
      },
    ],
  },
  {
    id: 'fiesta-tropical',
    name: 'Fiesta Tropical',
    category: 'titulos',
    gap: 2,
    align: 'center',
    tags: ['fiesta', 'tropical', 'verano', 'colorido', 'party', 'musica', 'evento', 'piscina'],
    layers: [
      {
        text: '¡Fiesta!',
        fontFamily: 'Pacifico',
        fontSize: 42,
        fontWeight: 400,
        fill: '#0891b2',
        shadow: '3 3 0 #f472b6',
        textAlign: 'center',
        google: { weights: [400] },
      },
      {
        text: 'TROPICAL',
        fontFamily: 'Montserrat',
        fontSize: 18,
        fontWeight: 800,
        fill: '#be185d',
        charSpacing: 500,
        textAlign: 'center',
        google: { weights: [400, 500, 800] },
      },
    ],
  },
  {
    id: 'flash-sale',
    name: 'Flash Sale',
    category: 'titulos',
    tags: ['flash', 'urgencia', 'ultimas', 'unidades', 'stock', 'alerta', 'liquidacion', 'descuento', 'rapido'],
    layers: [
      {
        text: '⚡ ÚLTIMAS\nUNIDADES',
        fontFamily: 'Space Mono',
        fontSize: 24,
        fontWeight: 700,
        fill: '#fef08a',
        textBackgroundColor: '#dc2626',
        charSpacing: 160,
        lineHeight: 1.5,
        textAlign: 'center',
        google: { weights: [400, 700] },
      },
    ],
  },
  {
    id: 'luxury-gold',
    name: 'Lujo Dorado',
    category: 'titulos',
    gap: 4,
    align: 'center',
    previewBackground: '#141210',
    tags: ['lujo', 'dorado', 'premium', 'boutique', 'elegante', 'marca', 'wedding', 'noche'],
    layers: [
      {
        text: 'MAISON',
        fontFamily: 'Cormorant Garamond',
        fontSize: 40,
        fontWeight: 300,
        fill: '#e9d5a1',
        charSpacing: 500,
        textAlign: 'center',
        google: { weights: [300, 400, 600] },
      },
      {
        text: '· ORFEBRERÍA FINA ·',
        fontFamily: 'Montserrat',
        fontSize: 9,
        fontWeight: 500,
        fill: '#a16207',
        charSpacing: 400,
        textAlign: 'center',
        google: { weights: [400, 500, 800] },
      },
    ],
  },


  // ── Combinaciones y Párrafos (Group de IText) ───────────────────────────
  {
    id: 'header-paragraph',
    name: 'Párrafo con Encabezado',
    category: 'combinaciones',
    gap: 8,
    align: 'center',
    tags: ['encabezado', 'parrafo', 'lanzamiento', 'combo', 'moderno', 'coleccion'],
    layers: [
      {
        text: 'GRAN LANZAMIENTO',
        fontFamily: 'Montserrat',
        fontSize: 24,
        fontWeight: 800,
        fill: '#0f172a',
        charSpacing: 60,
        textAlign: 'center',
        google: { weights: [400, 500, 800] },
      },
      {
        text: 'Descubre la colección\nque estabas esperando.',
        fontFamily: 'Open Sans',
        fontSize: 13,
        fontWeight: 400,
        fill: '#475569',
        lineHeight: 1.4,
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'quote-author',
    name: 'Cita con Autor',
    category: 'combinaciones',
    gap: 10,
    align: 'center',
    tags: ['cita', 'frase', 'autor', 'serif', 'elegante', 'inspiracional'],
    layers: [
      {
        text: '“El diseño es la\ninteligencia que\nse puede ver.”',
        fontFamily: 'Playfair Display',
        fontSize: 18,
        fontWeight: 400,
        fontStyle: 'italic',
        fill: '#1e293b',
        lineHeight: 1.3,
        textAlign: 'center',
        google: { weights: [400], italicWeights: [400] },
      },
      {
        text: '— DIETER RAMS',
        fontFamily: 'Lato',
        fontSize: 11,
        fontWeight: 700,
        fill: '#b45309',
        charSpacing: 250,
        textAlign: 'center',
        google: { weights: [400, 700] },
      },
    ],
  },
  {
    id: 'highlight-block',
    name: 'Bloque de Texto Destacado',
    category: 'combinaciones',
    gap: 10,
    align: 'center',
    tags: ['oferta', 'destacado', 'bloque', 'rojo', 'promo', 'parrafo', 'limitado'],
    layers: [
      {
        text: 'OFERTA ESPECIAL',
        fontFamily: 'Oswald',
        fontSize: 22,
        fontWeight: 600,
        fill: '#ffffff',
        textBackgroundColor: '#dc2626',
        charSpacing: 120,
        textAlign: 'center',
        google: { weights: [400, 600] },
      },
      {
        text: 'Válida por tiempo limitado\nen toda la tienda.',
        fontFamily: 'Open Sans',
        fontSize: 13,
        fontWeight: 400,
        fill: '#334155',
        lineHeight: 1.4,
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'bullet-list',
    name: 'Lista con Bullets',
    category: 'combinaciones',
    gap: 6,
    align: 'left',
    tags: ['lista', 'bullets', 'incluye', 'beneficios', 'parrafo', 'izquierda'],
    layers: [
      {
        text: 'INCLUYE:',
        fontFamily: 'Montserrat',
        fontSize: 16,
        fontWeight: 800,
        fill: '#0f172a',
        charSpacing: 80,
        textAlign: 'left',
        google: { weights: [400, 500, 800] },
      },
      {
        text: '• Envío gratis\n• Garantía de 1 año\n• Soporte 24/7',
        fontFamily: 'Open Sans',
        fontSize: 13,
        fontWeight: 400,
        fill: '#334155',
        lineHeight: 1.5,
        textAlign: 'left',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'signature-script',
    name: 'Firma Cursiva',
    category: 'combinaciones',
    gap: 2,
    align: 'center',
    tags: ['firma', 'script', 'cursiva', 'estudio', 'marca', 'elegante'],
    layers: [
      {
        text: 'Bravo Studio',
        fontFamily: 'Allura',
        fontSize: 40,
        fontWeight: 400,
        fill: '#0f766e',
        textAlign: 'center',
        google: { weights: [400] },
      },
      {
        text: 'DISEÑO & CREATIVIDAD',
        fontFamily: 'Montserrat',
        fontSize: 10,
        fontWeight: 500,
        fill: '#64748b',
        charSpacing: 300,
        textAlign: 'center',
        google: { weights: [400, 500, 800] },
      },
    ],
  },

  {
    id: 'noche-parrilla',
    name: 'Noche a la Parrilla',
    category: 'combinaciones',
    gap: 6,
    align: 'center',
    previewBackground: '#1c1917',
    tags: ['evento', 'noche', 'parrilla', 'carne', 'asador', 'cartelera', 'fecha', 'fiesta', 'condensed', 'restaurante'],
    layers: [
      {
        text: 'VIERNES 12 DE OCTUBRE',
        fontFamily: 'Bebas Neue',
        fontSize: 16,
        fontWeight: 400,
        fill: '#fbbf24',
        charSpacing: 320,
        textAlign: 'center',
        google: { weights: [400] },
      },
      {
        text: 'NOCHE A LA\nPARRILLA',
        fontFamily: 'Oswald',
        fontSize: 40,
        fontWeight: 700,
        fill: '#fafaf9',
        lineHeight: 0.95,
        charSpacing: 40,
        textAlign: 'center',
        google: { weights: [400, 600, 700] },
      },
      {
        text: '20:00 HS · PLAZA CENTRAL',
        fontFamily: 'Open Sans',
        fontSize: 11,
        fontWeight: 700,
        fill: '#fca5a5',
        charSpacing: 200,
        textAlign: 'center',
        google: { weights: [400, 700] },
      },
    ],
  },
  {
    id: 'puente-freundschaft',
    name: 'Puente Freundschaft',
    category: 'combinaciones',
    gap: 10,
    align: 'center',
    tags: ['parrafo', 'serif', 'elegante', 'cultura', 'festival', 'bloque', 'justificado', 'puente'],
    layers: [
      {
        text: 'PUENTE FREUNDSCHAFT',
        fontFamily: 'Playfair Display',
        fontSize: 26,
        fontWeight: 700,
        fill: '#1e293b',
        charSpacing: 80,
        textAlign: 'center',
        google: { weights: [400, 700] },
      },
      {
        text: 'Un festival de cultura,\nmúsica y amistad para\ncompartir sin fronteras.',
        fontFamily: 'Open Sans',
        fontSize: 12,
        fontWeight: 400,
        fill: '#475569',
        lineHeight: 1.6,
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'oferta-badge',
    name: 'Badge Oferta 2x1',
    category: 'combinaciones',
    gap: 6,
    align: 'center',
    tags: ['oferta', 'badge', 'etiqueta', 'rojo', '2x1', 'descuento', 'promo', 'destacado', 'stock'],
    layers: [
      {
        text: 'OFERTA ESPECIAL',
        fontFamily: 'Anton',
        fontSize: 24,
        fontWeight: 400,
        fill: '#ffffff',
        textBackgroundColor: '#dc2626',
        charSpacing: 100,
        rotation: -2,
        textAlign: 'center',
        google: { weights: [400] },
      },
      {
        text: '2 x 1 en toda la tienda',
        fontFamily: 'Montserrat',
        fontSize: 14,
        fontWeight: 600,
        fill: '#b91c1c',
        textAlign: 'center',
        google: { weights: [400, 500, 800] },
      },
      {
        text: 'Válido hasta agotar stock',
        fontFamily: 'Open Sans',
        fontSize: 10,
        fontWeight: 400,
        fill: '#64748b',
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'menu-precio',
    name: 'Precio Destacado',
    category: 'combinaciones',
    gap: 4,
    align: 'center',
    tags: ['precio', 'numero', 'tag', 'oferta', 'descuento', 'comprar', 'menu', 'costo'],
    layers: [
      {
        text: 'SOLO POR HOY',
        fontFamily: 'Montserrat',
        fontSize: 11,
        fontWeight: 500,
        fill: '#dc2626',
        charSpacing: 320,
        textAlign: 'center',
        google: { weights: [400, 500, 800] },
      },
      {
        text: '$19.990',
        fontFamily: 'Anton',
        fontSize: 54,
        fontWeight: 400,
        fill: '#0f172a',
        shadow: '4 4 0 #fde047',
        textAlign: 'center',
        google: { weights: [400] },
      },
      {
        text: 'por unidad · IVA incluido',
        fontFamily: 'Open Sans',
        fontSize: 10,
        fontWeight: 400,
        fontStyle: 'italic',
        fill: '#64748b',
        textAlign: 'center',
        google: { weights: [400] },
      },
    ],
  },
  {
    id: 'gran-apertura',
    name: 'Gran Apertura',
    category: 'combinaciones',
    gap: 2,
    align: 'center',
    tags: ['apertura', 'nuevo', 'inauguracion', 'tienda', 'lanzamiento', 'bienvenida', 'evento'],
    layers: [
      {
        text: 'Gran',
        fontFamily: 'Allura',
        fontSize: 40,
        fontWeight: 400,
        fill: '#7c3aed',
        textAlign: 'center',
        google: { weights: [400] },
      },
      {
        text: 'APERTURA',
        fontFamily: 'Montserrat',
        fontSize: 26,
        fontWeight: 800,
        fill: '#0f172a',
        charSpacing: 200,
        textAlign: 'center',
        google: { weights: [400, 500, 800] },
      },
      {
        text: 'ESTE SÁBADO 18 · 10:00 AM',
        fontFamily: 'Lato',
        fontSize: 11,
        fontWeight: 700,
        fill: '#7c3aed',
        charSpacing: 200,
        textAlign: 'center',
        google: { weights: [400, 700] },
      },
    ],
  },
];


/** Une (por familia) todos los pesos/itálicas que exige un preset. */
export const presetFontRequests = (preset: TypographyPreset): FontRequest[] => {
  const byFamily = new Map<string, FontRequest>();
  for (const layer of preset.layers) {
    const existing = byFamily.get(layer.fontFamily);
    byFamily.set(layer.fontFamily, {
      family: layer.fontFamily,
      weights: [...(existing?.weights ?? []), ...(layer.google?.weights ?? [400])],
      italicWeights: [
        ...(existing?.italicWeights ?? []),
        // Si la capa se dibuja en itálica, su propio peso debe pedirse como
        // cara itálica de la familia (Google no sirve cursivas sintéticas).
        ...(layer.fontStyle === 'italic'
          ? layer.google?.italicWeights ?? layer.google?.weights ?? [400]
          : layer.google?.italicWeights ?? []),
      ],
    });
  }
  return [...byFamily.values()];
};

/** Todas las fuentes del catálogo: se piden al abrir el panel para las tarjetas. */
export const ALL_PRESET_FONTS: FontRequest[] = (() => {
  const byFamily = new Map<string, FontRequest>();
  for (const preset of TYPOGRAPHY_PRESETS) {
    for (const request of presetFontRequests(preset)) {
      const existing = byFamily.get(request.family);
      byFamily.set(request.family, {
        family: request.family,
        weights: [...new Set([...(existing?.weights ?? []), ...(request.weights ?? [])])],
        italicWeights: [
          ...new Set([...(existing?.italicWeights ?? []), ...(request.italicWeights ?? [])]),
        ],
      });
    }
  }
  return [...byFamily.values()];
})();

/**
 * Presets visibles para una consulta de búsqueda, agrupados por categoría y
 * conservando el orden declarado. Con la consulta vacía devuelve el catálogo
 * completo (todas las categorías presentes).
 */
export const searchTypographyPresets = (
  rawQuery: string,
): Record<TypographyPresetCategory, TypographyPreset[]> => ({
  titulos: TYPOGRAPHY_PRESETS.filter(
    (preset) => preset.category === 'titulos' && presetMatchesQuery(preset, rawQuery),
  ),
  combinaciones: TYPOGRAPHY_PRESETS.filter(
    (preset) => preset.category === 'combinaciones' && presetMatchesQuery(preset, rawQuery),
  ),
});

