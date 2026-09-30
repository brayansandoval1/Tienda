'use client';

/**
 * Especificación del fondo impreso del producto.
 *
 * El valor viaja por los eventos del editor (`editor:design-background`) y por
 * el ref de vistas como una cadena: un hex («#a1b2c3») para fondos sólidos,
 * 'transparent', o el JSON serializado de un degradado. Así el formato es 100%
 * compatible hacia atrás con los emisores antiguos (TextToolbar) y permite
 * agregar degradados lineales/radiales sin migrar nada.
 */
export interface DesignBackgroundStop {
  /** Posición del degradado (0 = primer color, 1 = último). */
  offset: number;
  color: string;
}

export type DesignBackground =
  | { kind: 'transparent' }
  | { kind: 'solid'; color: string }
  /** `angle` sigue la convención CSS (0deg = hacia arriba, 180deg = hacia abajo). */
  | { kind: 'linear'; angle: number; stops: DesignBackgroundStop[] }
  | { kind: 'radial'; stops: DesignBackgroundStop[] };

/** Construye un degradado lineal repartiendo los colores en partes iguales. */
export const makeLinearBackground = (
  angle: number,
  colors: string[],
): DesignBackground => {
  const palette = colors.length > 0 ? colors : ['#ffffff'];
  const stops: DesignBackgroundStop[] =
    palette.length === 1
      ? [
          { offset: 0, color: palette[0] },
          { offset: 1, color: palette[0] },
        ]
      : palette.map((color, index) => ({
          offset: index / (palette.length - 1),
          color,
        }));
  return { kind: 'linear', angle, stops };
};

/** Construye un degradado radial (efecto "foco" / desvanecido circular). */
export const makeRadialBackground = (colors: string[]): DesignBackground => {
  const palette = colors.length > 0 ? colors : ['#ffffff'];
  const stops: DesignBackgroundStop[] =
    palette.length === 1
      ? [
          { offset: 0, color: palette[0] },
          { offset: 1, color: palette[0] },
        ]
      : palette.map((color, index) => ({
          offset: index / (palette.length - 1),
          color,
        }));
  return { kind: 'radial', stops };
};

/** Convierte la especificación al formato de cadena que viaja por el editor. */
export const encodeDesignBackground = (background: DesignBackground): string => {
  if (background.kind === 'transparent') return 'transparent';
  if (background.kind === 'solid') return background.color;
  return JSON.stringify(background);
};

const SOLID_PATTERN = /^(#[0-9a-f]{3,9}|rgba?\(|hsla?\()/i;

/**
 * Lee cualquier valor aceptado por el editor (hex, 'transparent' o JSON de
 * degradado). Todo lo irreconocible cae en 'transparent' (comportamiento
 * histórico ante datos corruptos).
 */
export const decodeDesignBackground = (
  raw: string | null | undefined,
): DesignBackground => {
  if (!raw || raw === 'transparent') return { kind: 'transparent' };
  if (SOLID_PATTERN.test(raw)) return { kind: 'solid', color: raw };
  try {
    const parsed = JSON.parse(raw) as
      | { kind?: string; color?: string; angle?: number; stops?: DesignBackgroundStop[] }
      | null;
    if (parsed?.kind === 'solid' && typeof parsed.color === 'string') {
      return { kind: 'solid', color: parsed.color };
    }
    const stops = Array.isArray(parsed?.stops)
      ? (parsed.stops as DesignBackgroundStop[]).filter(
          (stop) => typeof stop?.color === 'string',
        )
      : [];
    if (parsed?.kind === 'linear' && stops.length > 0) {
      return {
        kind: 'linear',
        angle: Number.isFinite(Number(parsed.angle)) ? Number(parsed.angle) : 180,
        stops,
      };
    }
    if (parsed?.kind === 'radial' && stops.length > 0) {
      return { kind: 'radial', stops };
    }
  } catch {
    // Valor no-JSON (por ejemplo un nombre de color suelto): se ignora.
  }
  return { kind: 'transparent' };
};

const clampOffset = (offset: number) => Math.min(1, Math.max(0, Number(offset) || 0));

/** Cadena CSS equivalente, usada para pintar las muestras de la interfaz. */
export const designBackgroundToCss = (background: DesignBackground): string => {
  if (background.kind === 'transparent') return 'transparent';
  if (background.kind === 'solid') return background.color;
  const stops = background.stops
    .map((stop) => `${stop.color} ${(clampOffset(stop.offset) * 100).toFixed(0)}%`)
    .join(', ');
  return background.kind === 'radial'
    ? `radial-gradient(circle at 50% 40%, ${stops})`
    : `linear-gradient(${background.angle}deg, ${stops})`;
};

/** Paleta sólida de la barra "Fondo impreso" (panel de EditorCanvas). */
export const SOLID_BACKGROUND_SWATCHES = [
  '#000000',
  '#ffffff',
  '#2d4a3e',
  '#1e3a8a',
  '#e11d48',
  '#7c2d12',
];

export interface GradientBackgroundPreset {
  id: string;
  name: string;
  /** Degradado radial (efecto foco) en lugar de lineal. */
  radial?: boolean;
  angle: number;
  colors: string[];
}

/**
 * Degradados "aesthetic" preconfigurados: tonos pastel desvanecidos que las
 * variantes sólidas del producto no pueden lograr. Se aplican con un clic y
 * se comparan por su código serializado para marcar la selección activa.
 */
export const GRADIENT_BACKGROUND_PRESETS: GradientBackgroundPreset[] = [
  { id: 'atardecer', name: 'Atardecer', angle: 180, colors: ['#ffd6a5', '#ff8fab', '#cdb4db'] },
  { id: 'pastel', name: 'Pastel', angle: 180, colors: ['#fbc2eb', '#a6c1ee'] },
  { id: 'lavanda', name: 'Lavanda', angle: 180, colors: ['#e0c3fc', '#8ec5fc'] },
  { id: 'melocoton', name: 'Melocotón', angle: 180, colors: ['#ffecd2', '#fcb69f'] },
  { id: 'menta', name: 'Menta', angle: 180, colors: ['#a8edea', '#fed6e3'] },
  { id: 'oceano', name: 'Océano', angle: 180, colors: ['#84fab0', '#8fd3f4'] },
  { id: 'fresa', name: 'Fresa', angle: 180, colors: ['#ff9a9e', '#fecfef'] },
  { id: 'medianoche', name: 'Medianoche', angle: 180, colors: ['#30cfd0', '#330867'] },
  { id: 'foco', name: 'Foco', angle: 0, radial: true, colors: ['#fdfbff', '#d8b4fe'] },
];

export const gradientPresetToBackground = (
  preset: GradientBackgroundPreset,
): DesignBackground =>
  preset.radial
    ? makeRadialBackground(preset.colors)
    : makeLinearBackground(preset.angle, preset.colors);

/** Direcciones del degradado personalizado (ángulos CSS). */
export const GRADIENT_DIRECTIONS = [
  { label: '↓ Vertical', angle: 180 },
  { label: '→ Horizontal', angle: 90 },
  { label: '↘ Diagonal', angle: 135 },
  { label: '↗ Diagonal', angle: 45 },
] as const;

