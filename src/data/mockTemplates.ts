/**
 * Plantillas prediseñadas (mock, sin base de datos).
 *
 * Cada `templateJSON` es un documento compatible con Fabric.js v5
 * (formato `canvas.toObject()`: { version, objects: [...] }) en el sistema de
 * coordenadas lógico del editor (800×800). El mockup del producto NO va en el
 * JSON: el editor preserva `backgroundImage` al aplicar la plantilla.
 *
 * Para conectar una base de datos en el futuro basta reemplazar la importación
 * de MOCK_TEMPLATES por un fetch (mismo shape) — el editor consume el campo
 * `templateJSON.objects` vía el evento 'editor:apply-template'.
 */

export interface MockTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  /**
   * Tipo de producto para el que fue diseñada (ej. 'Funda', 'Termo').
   * Las plantillas mock no lo definen y se consideran universales.
   */
  productType?: string;
  emoji: string;
  /** Clases Tailwind para la miniatura de la tarjeta. */
  accent: string;
  templateJSON: {
    version: string;
    objects: Record<string, unknown>[];
  };
}

const HEART_PATH =
  'M 272.7 51.2 C 226.4 13.7 153.2 27 118 77 C 82.7 27 9.5 13.7 -36.7 51.2 C -96.7 100 -80 180 118 320 C 316 180 332.7 100 272.7 51.2 Z';

export const MOCK_TEMPLATES: MockTemplate[] = [
  {
    id: 'tpl-cumpleanos',
    name: 'Cumpleaños',
    description: 'Texto festivo + globos y confeti',
    category: 'Cumpleaños',
    emoji: '🎂',
    accent: 'from-rose-100 to-amber-100',
    templateJSON: {
      version: '5.3.0',
      objects: [
        {
                    styles: {},
          left: 400,
          top: 270,
          originX: 'center',
          originY: 'center',
          text: '¡Feliz Cumpleaños!',
          fontSize: 44,
          fontWeight: 'bold',
          fontFamily: 'Arial',
          textAlign: 'center',
          fill: '#E11D48',
        },
        {
                    styles: {},
          left: 400,
          top: 330,
          originX: 'center',
          originY: 'center',
          text: 'Que cumplas muchos más',
          fontSize: 22,
          fontFamily: 'Arial',
          textAlign: 'center',
          fill: '#334155',
        },
        // Globos (círculos con triangulito de nudo)
        {
          type: 'Circle',
          left: 320,
          top: 460,
          originX: 'center',
          originY: 'center',
          radius: 48,
          fill: '#F59E0B',
        },
        {
          type: 'Circle',
          left: 480,
          top: 480,
          originX: 'center',
          originY: 'center',
          radius: 40,
          fill: '#38BDF8',
        },
        // Confeti
        { type: 'Rect', left: 260, top: 400, width: 12, height: 12, angle: 25, fill: '#22C55E' },
        { type: 'Rect', left: 540, top: 420, width: 12, height: 12, angle: -15, fill: '#A855F7' },
        { type: 'Rect', left: 400, top: 560, width: 10, height: 10, angle: 40, fill: '#F43F5E' },
      ],
    },
  },
  {
    id: 'tpl-parejas',
    name: 'Parejas / Aniversario',
    description: 'Tú & Yo con corazón vectorial',
    category: 'Parejas / Aniversario',
    emoji: '❤️',
    accent: 'from-pink-100 to-rose-200',
    templateJSON: {
      version: '5.3.0',
      objects: [
        {
                    styles: {},
          left: 400,
          top: 290,
          originX: 'center',
          originY: 'center',
          text: 'Tú & Yo',
          fontSize: 48,
          fontWeight: 'bold',
          fontFamily: 'Georgia',
          textAlign: 'center',
          fill: '#0F172A',
        },
        {
                    styles: {},
          left: 400,
          top: 355,
          originX: 'center',
          originY: 'center',
          text: 'Feliz Aniversario',
          fontSize: 22,
          fontFamily: 'Georgia',
          textAlign: 'center',
          fill: '#475569',
        },
        {
          type: 'Path',
          left: 400,
          top: 500,
          originX: 'center',
          originY: 'center',
          path: HEART_PATH,
          scaleX: 0.45,
          scaleY: 0.45,
          fill: '#EF4444',
          stroke: '#BE123C',
          strokeWidth: 2,
        },
      ],
    },
  },
];
