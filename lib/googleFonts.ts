// ── Cargador dinámico de Google Fonts ───────────────────────────────────────
// Inyecta <link> a fonts.googleapis.com/css2 con los pesos e itálicas exactos
// que cada tipografía necesita (el cargador antiguo de EditorCanvas sólo pedía
// wght@400;700) y expone una promesa que resuelve cuando la fuente ya está
// disponible para <canvas>. Lo usan tanto TypographyPresetsPanel (para que las
// tarjetas se dibujen con la fuente real) como EditorCanvas (para crear los
// objetos fabric.IText sólo DESPUÉS de que la tipografía esté lista, requisito
// de la carga dinámica de fuentes).

export interface FontRequest {
  family: string;
  /** Pesos normales solicitados, ej. [400, 800]. Por defecto [400]. */
  weights?: number[];
  /** Pesos en cursiva, ej. [400] → "ital,wght@0,400;1,400". */
  italicWeights?: number[];
}

/** Familias que el navegador ya provee: pedirlas a Google sería un error 400. */
const SYSTEM_FAMILIES = /^(arial|helvetica|verdana|georgia|times( new roman)?|courier( new)?|tahoma|trebuchet|impact|comic sans|system-ui|sans-serif|serif|monospace|cursive|fantasy)/i;

const linkId = (family: string) => `google-font-${family.replace(/\s+/g, '-').toLowerCase()}`;

/** Parámetro family=... de la API css2 con ejes wght/ital ordenados. */
const css2FamilyParam = ({ family, weights = [400], italicWeights = [] }: FontRequest): string => {
  const slug = family.replace(/\s+/g, '+');
  const normals = [...new Set(weights)].sort((a, b) => a - b);
  const italics = [...new Set(italicWeights)].sort((a, b) => a - b);
  if (italics.length === 0) return `family=${slug}:wght@${normals.join(';')}`;
  // css2 exige declarar cada combinación existente ital,wght; los pesos
  // itálicos también solicitan su versión normal.
  const pairs = [
    ...[...new Set([...normals, ...italics])].sort((a, b) => a - b).map((w) => `0,${w}`),
    ...italics.map((w) => `1,${w}`),
  ];
  return `family=${slug}:ital,wght@${pairs.join(';')}`;
};

/** Promesa pendiente por hoja de estilos inyectada (resuelve en onload/onerror). */
const pendingSheets = new Map<string, Promise<void>>();

/** Inyecta (una sola vez por familia) el stylesheet css2 con sus pesos reales. */
export function injectGoogleFonts(requests: FontRequest[]): void {
  if (typeof document === 'undefined') return;
  for (const request of requests) {
    const family = request.family?.trim();
    if (!family || SYSTEM_FAMILIES.test(family)) continue;
    const id = linkId(family);
    if (document.getElementById(id) || pendingSheets.has(id)) continue;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${css2FamilyParam(request)}&display=swap`;
    const sheetLoaded = new Promise<void>((resolve) => {
      link.onload = () => resolve();
      link.onerror = () => resolve();
    });
    pendingSheets.set(id, sheetLoaded);
    document.head.appendChild(link);
  }
}

/**
 * Inyecta los estilos y espera a que cada cara (peso/estilo) quede lista para
 * dibujarse en el canvas. Si la red cuelga, resuelve por tiempo de espera para
 * que la inserción en el lienzo jamás se bloquee (Fabric redibujará cuando la
 * fuente finalmente llegue, igual que handleFontChange).
 */
export async function loadGoogleFonts(requests: FontRequest[], timeoutMs = 5000): Promise<void> {
  if (typeof document === 'undefined') return;
  injectGoogleFonts(requests);
  const sheets = requests
    .map((request) => pendingSheets.get(linkId(request.family ?? '')))
    .filter((sheet): sheet is Promise<void> => Boolean(sheet));
  await Promise.race([
    Promise.all(sheets).then(async () => {
      if (!('fonts' in document)) return;
      const faces: Promise<unknown>[] = [];
      for (const request of requests) {
        const family = request.family?.trim();
        if (!family || SYSTEM_FAMILIES.test(family)) continue;
        for (const weight of request.weights ?? [400]) {
          faces.push(document.fonts.load(`${weight} 16px "${family}"`, 'AaBbGg'));
        }
        for (const weight of request.italicWeights ?? []) {
          faces.push(document.fonts.load(`italic ${weight} 16px "${family}"`, 'AaBbGg'));
        }
      }
      await Promise.all(faces.map((face) => face.catch(() => undefined)));
      await document.fonts.ready.catch(() => undefined);
    }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
