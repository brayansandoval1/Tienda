// ── Biblioteca de familias Google Fonts para el editor ─────────────────────
// Catálogo curado (~60 familias) que alimenta: el selector "Fuente" del
// TextToolbar (vía lib/fonts.ts) y la sección "Todas las fuentes" de la
// galería tipográfica del sidebar. Cada entrada declara los pesos que Google
// REALMENTE sirve para esa familia (css2 responde 400 si se pide un peso
// inexistente en familias monopeso como Anton o Bungee) y etiquetas de estilo
// en minúsculas/sin acentos para el buscador del panel.
// Para añadir una familia nueva basta con agregar una entrada aquí: el
// dropdown del toolbar y la galería la recogen automáticamente.

import type { FontRequest } from './googleFonts';

export type GoogleFontStyle =
  | 'sistema'
  | 'sans'
  | 'serif'
  | 'display'
  | 'script'
  | 'retro'
  | 'mono';

export interface GoogleFontEntry {
  family: string;
  /** Agrupación visual (chip de la tarjeta y orden del dropdown). */
  style: GoogleFontStyle;
  /** Pesos disponibles en Google Fonts que el editor puede solicitar. */
  weights: number[];
  /** Palabras clave de búsqueda (minúsculas, sin acentos). */
  tags: string[];
}

export const FONT_STYLE_LABELS: Record<GoogleFontStyle, string> = {
  sistema: 'Sistema',
  sans: 'Sans',
  serif: 'Serif',
  display: 'Display',
  script: 'Script',
  retro: 'Retro',
  mono: 'Mono',
};

/** Quita acentos/mayúsculas para comparar consultas de búsqueda. */
export const normalizeFontSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const FONT_LIBRARY: GoogleFontEntry[] = [
  // ── Sistema (no se pide a Google: la provee el navegador) ──────────────
  { family: 'Arial', style: 'sistema', weights: [400, 700], tags: ['sistema', 'basica', 'neutra'] },

  // ── Sans (versátiles para cuerpo y títulos) ─────────────────────────────
  { family: 'Inter', style: 'sans', weights: [400, 700], tags: ['moderno', 'tecnologia', 'ui', 'limpio', 'startup'] },
  { family: 'Roboto', style: 'sans', weights: [400, 700], tags: ['android', 'neutra', 'moderno', 'google'] },
  { family: 'Montserrat', style: 'sans', weights: [400, 700], tags: ['geometrica', 'moderno', 'elegante', 'marca'] },
  { family: 'Poppins', style: 'sans', weights: [400, 700], tags: ['geometrica', 'redonda', 'moderno', 'juventud'] },
  { family: 'Open Sans', style: 'sans', weights: [400, 700], tags: ['cuerpo', 'legible', 'neutra', 'parrafo'] },
  { family: 'Lato', style: 'sans', weights: [400, 700], tags: ['humana', 'calida', 'corporativo'] },
  { family: 'Raleway', style: 'sans', weights: [400, 700], tags: ['elegante', 'fina', 'moda', 'minimal'] },
  { family: 'Nunito', style: 'sans', weights: [400, 700], tags: ['redonda', 'amigable', 'suave', 'kids'] },
  { family: 'Work Sans', style: 'sans', weights: [400, 700], tags: ['corporativo', 'solido', 'web'] },
  { family: 'Rubik', style: 'sans', weights: [400, 700], tags: ['redondeada', 'amigable', 'marca'] },
  { family: 'Manrope', style: 'sans', weights: [400, 700], tags: ['tecnologia', 'fintech', 'moderno'] },
  { family: 'DM Sans', style: 'sans', weights: [400, 700], tags: ['geometrica', 'clean', 'web'] },
  { family: 'Space Grotesk', style: 'sans', weights: [400, 700], tags: ['tecnologia', 'futurista', 'diseno'] },
  { family: 'Jost', style: 'sans', weights: [400, 700], tags: ['futurista', 'geometrica', 'bauhaus', 'moderno'] },

  // ── Display (alto impacto para titulares) ───────────────────────────────
  { family: 'Anton', style: 'display', weights: [400], tags: ['impacto', 'fuerte', 'condensada', 'poster', 'oferta'] },
  { family: 'Bebas Neue', style: 'display', weights: [400], tags: ['condensada', 'cartelera', 'evento', 'fuerte'] },
  { family: 'Oswald', style: 'display', weights: [400, 700], tags: ['condensada', 'titular', 'noticia', 'deporte'] },
  { family: 'Archivo Black', style: 'display', weights: [400], tags: ['pesada', 'impacto', 'poster', 'grafico'] },
  { family: 'Bungee', style: 'display', weights: [400], tags: ['urbano', 'letrero', 'neon', 'signo', 'fiesta'] },
  { family: 'Audiowide', style: 'display', weights: [400], tags: ['neon', 'retro-tech', 'gamer', 'nocturno'] },
  { family: 'Righteous', style: 'display', weights: [400], tags: ['retro', 'marca', 'noventa', 'curva'] },
  { family: 'Bangers', style: 'display', weights: [400], tags: ['comic', 'cartoon', 'explosion', 'humor'] },
  { family: 'Luckiest Guy', style: 'display', weights: [400], tags: ['comic', 'divertido', 'infantil', 'cartoon'] },
  { family: 'Monoton', style: 'display', weights: [400], tags: ['neon', 'luces', '80s', 'disco', 'nocturno'] },
  { family: 'Titan One', style: 'display', weights: [400], tags: ['gordita', 'cartoon', 'kids', 'divertido'] },
  { family: 'Baloo 2', style: 'display', weights: [400, 700], tags: ['redonda', 'kids', 'amigable', 'jugueton'] },
  { family: 'Fredoka', style: 'display', weights: [400, 700], tags: ['redonda', 'kids', 'suave', 'juguete'] },

  // ── Serif (elegancia y tradición) ───────────────────────────────────────
  { family: 'Playfair Display', style: 'serif', weights: [400, 700], tags: ['elegante', 'moda', 'boda', 'revista'] },
  { family: 'Cormorant Garamond', style: 'serif', weights: [400, 700], tags: ['clasica', 'fina', 'lujo', 'poesia'] },
  { family: 'EB Garamond', style: 'serif', weights: [400, 700], tags: ['clasica', 'libro', 'humanista'] },
  { family: 'Lora', style: 'serif', weights: [400, 700], tags: ['cuerpo', 'blog', 'calida', 'lectura'] },
  { family: 'Merriweather', style: 'serif', weights: [400, 700], tags: ['lectura', 'web', 'solida'] },
  { family: 'Libre Baskerville', style: 'serif', weights: [400, 700], tags: ['periodistico', 'clasico', 'serio'] },
  { family: 'DM Serif Display', style: 'serif', weights: [400], tags: ['titular', 'alto contraste', 'elegante'] },
  { family: 'DM Serif Text', style: 'serif', weights: [400], tags: ['parrafo', 'libro', 'editorial'] },
  { family: 'Abril Fatface', style: 'serif', weights: [400], tags: ['fat', 'poster', 'impacto', 'revista'] },
  { family: 'Bodoni Moda', style: 'serif', weights: [400, 700], tags: ['moda', 'lujo', 'alta costura', 'elegante'] },

  // ── Script / manuscritas ────────────────────────────────────────────────
  { family: 'Great Vibes', style: 'script', weights: [400], tags: ['cursiva', 'boda', 'elegante', 'firma'] },
  { family: 'Pacifico', style: 'script', weights: [400], tags: ['playero', 'surf', 'retro', 'fiesta'] },
  { family: 'Lobster', style: 'script', weights: [400], tags: ['logo', ' marca', 'suave', 'bar'] },
  { family: 'Dancing Script', style: 'script', weights: [400, 700], tags: ['manuscrita', 'informal', 'invitacion'] },
  { family: 'Satisfy', style: 'script', weights: [400], tags: ['retro', 'diner', 'bar', 'heladeria'] },
  { family: 'Allura', style: 'script', weights: [400], tags: ['fina', 'firma', 'boda', 'delicada'] },
  { family: 'Sacramento', style: 'script', weights: [400], tags: ['fina', 'minimal', 'invitacion'] },
  { family: 'Yellowtail', style: 'script', weights: [400], tags: ['brush', 'pincel', 'retro', 'neon'] },
  { family: 'Caveat', style: 'script', weights: [400, 700], tags: ['apunte', 'manuscrita', 'notas', 'casual'] },
  { family: 'Permanent Marker', style: 'script', weights: [400], tags: ['marcador', 'graffiti', 'urbano', 'protesta'] },
  { family: 'Shadows Into Light', style: 'script', weights: [400], tags: ['manuscrita', 'suave', 'personal', 'carta'] },


  // ── Retro / vintage ─────────────────────────────────────────────────────
  { family: 'Rye', style: 'retro', weights: [400], tags: ['grabado', 'western', 'vintage', 'deli', 'whiskey'] },
  { family: 'Old Standard TT', style: 'retro', weights: [400, 700], tags: ['antigua', 'plomo', 'periodico', 'vintage'] },
  { family: 'IM Fell English', style: 'retro', weights: [400], tags: ['antigua', 'tinta', 'siglo 18', 'libro'] },
  { family: 'Special Elite', style: 'retro', weights: [400], tags: ['maquina de escribir', 'misterio', 'expediente'] },
  { family: 'MedievalSharp', style: 'retro', weights: [400], tags: ['medieval', 'fantasia', 'reino', 'escudo'] },
  { family: 'UnifrakturMaguntia', style: 'retro', weights: [400], tags: ['gotica', 'blackletter', 'cerveza', 'banda'] },
  { family: 'Ewert', style: 'retro', weights: [400], tags: ['fair', 'carnaval', 'vintage', 'western'] },

  // ── Mono / tech ─────────────────────────────────────────────────────────
  { family: 'Space Mono', style: 'mono', weights: [400, 700], tags: ['codigo', 'terminal', 'retro-tech', 'drop'] },
  { family: 'IBM Plex Mono', style: 'mono', weights: [400, 700], tags: ['codigo', 'corporativo', 'data'] },
  { family: 'JetBrains Mono', style: 'mono', weights: [400, 700], tags: ['codigo', 'developer', 'dev'] },
  { family: 'Share Tech Mono', style: 'mono', weights: [400], tags: ['tech', 'HUD', 'ciencia', 'futurista'] },
  { family: 'VT323', style: 'mono', weights: [400], tags: ['terminal', 'arcade', 'pixel', 'retro', '8-bit'] },
  { family: 'Press Start 2P', style: 'mono', weights: [400], tags: ['arcade', 'pixel', 'gamer', 'retro', '8-bit'] },
];

/** Pesos que deben solicitarse a Google para una familia del catálogo. */
export const libraryFontWeights = (family: string): number[] =>
  FONT_LIBRARY.find((entry) => entry.family === family)?.weights ?? [400];

/**
 * Peticiones ligeras (sólo peso 400) para dibujar las miniaturas de la
 * galería: cada familia del catálogo se inyecta una sola vez por sesión.
 */
export const LIBRARY_PREVIEW_FONTS: FontRequest[] = FONT_LIBRARY.map((entry) => ({
  family: entry.family,
  weights: [400],
}));

/** Familias que coinciden con la consulta (nombre, estilo o etiquetas). */
export const searchFontLibrary = (rawQuery: string): GoogleFontEntry[] => {
  const query = normalizeFontSearch(rawQuery);
  if (!query) return FONT_LIBRARY;
  return FONT_LIBRARY.filter((entry) => {
    const haystack = normalizeFontSearch(
      [entry.family, FONT_STYLE_LABELS[entry.style], entry.style, ...entry.tags].join(' '),
    );
    return query.split(/\s+/).every((token) => haystack.includes(token));
  });
};

