/**
 * Define la estructura de PRODUCTOS personalizables con múltiples vistas.
 * Cada producto expone una o varias vistas (frente, espalda, vista panorámica...)
 * con su imagen de overlay (el propio artículo) y su zona de diseño activa.
 */

export interface ColorVariant {
  id: string;
  name: string;
  hexColor: string;
  mockupUrl: string;
  /** Mockup específico por vista, p. ej. { front: '/frente-negro.png' }. */
  mockupUrls?: Record<string, string>;
}

export interface ProductView {
  id: string;
  /** Nombre visible de la cara: Frente, Espalda, Lateral, etc. */
  name: string;
  /** Alias heredado para los productos persistidos antes de `name`. */
  label?: string;
  /** Imagen base del mockup que se muestra en el editor. */
  mockupUrl: string;
  /** Variantes visuales del mismo producto para esta vista. */
  colorVariants?: ColorVariant[];
  /** Capa opcional para composiciones de mockup más complejas. */
  overlayUrl?: string;
  printArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Las áreas creadas desde el panel actual se guardan relativas al mockup. */
  printAreaUnit?: 'pixels' | 'percent';
}

export interface ProductOptionValue {
  id: string;
  label: string;
  priceModifier: number;
  mockupUrl?: string;
  /** Mockup opcional por vista para una variante de opción. */
  mockupUrls?: Record<string, string>;
  /** Configuración visual por cada vista del producto para esta variante. */
  views?: ProductOptionView[];
  thumbnailUrl?: string;
  /** Zona segura opcional que sustituye la zona base al elegir este valor. */
  printArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ProductOptionView {
  viewId: string;
  name: string;
  mockupUrl?: string | null;
  printArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ProductOption {
  id: string;
  name: string;
  /** Nombre explícito usado por el formulario administrativo. */
  displayType?: 'thumbnails' | 'radio' | 'select';
  /** Alias de compatibilidad para opciones existentes. */
  type: 'thumbnails' | 'radio' | 'select';
  values: ProductOptionValue[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  canvasWidth: number;
  canvasHeight: number;
  /** Tamaño físico del arte final; permite calcular la salida a 300 DPI. */
  printWidthCm?: number;
  printHeightCm?: number;
  /** Variantes globales reutilizables por todas las vistas del producto. */
  colors?: ColorVariant[];
  /** Configuraciones vendibles que pueden modificar el precio final. */
  options?: ProductOption[];
  views: ProductView[];
}

/** Alias temporal para los componentes existentes del editor. */
export type ProductConfig = Product;

const STANDARD_OPTIONS: ProductOption[] = [
  {
    id: 'estilo', name: 'Estilo', type: 'thumbnails', values: [
      { id: 'clasico', label: 'Clásico', priceModifier: 0 },
      { id: 'premium', label: 'Premium', priceModifier: 2 },
    ],
  },
  {
    id: 'tamano', name: 'Tamaño', type: 'radio', values: [
      { id: 'estandar', label: 'Estándar', priceModifier: 0 },
      { id: 'grande', label: 'Grande', priceModifier: 3 },
    ],
  },
];

/**
 * Catálogo de productos personalizables disponibles en la tienda.
 */
export const PRODUCTS: Product[] = [
  {
    id: 'playera-algodon-unisex',
    name: 'Playera Personalizada',
    category: 'Ropa',
    price: 24.99,
    canvasWidth: 800,
    canvasHeight: 800,
    colors: [
      { id: 'blanco', name: 'Blanco', hexColor: '#FFFFFF', mockupUrl: 'https://picsum.photos/id/10/800/800', mockupUrls: { front: 'https://picsum.photos/id/10/800/800', back: 'https://picsum.photos/id/11/800/800' } },
      { id: 'negro', name: 'Negro', hexColor: '#18181b', mockupUrl: 'https://picsum.photos/id/11/800/800', mockupUrls: { front: 'https://picsum.photos/id/12/800/800', back: 'https://picsum.photos/id/13/800/800' } },
      { id: 'azul', name: 'Azul', hexColor: '#1d4ed8', mockupUrl: 'https://picsum.photos/id/12/800/800', mockupUrls: { front: 'https://picsum.photos/id/14/800/800', back: 'https://picsum.photos/id/15/800/800' } },
    ],
    options: STANDARD_OPTIONS,
    views: [
      {
        id: 'front',
        name: 'Frente',
        label: 'Frente',
        mockupUrl: 'https://picsum.photos/id/10/800/800',
        printArea: { x: 250, y: 200, width: 300, height: 400 },
      },
      {
        id: 'back',
        name: 'Espalda',
        label: 'Espalda',
        mockupUrl: 'https://picsum.photos/id/11/800/800',
        printArea: { x: 250, y: 200, width: 300, height: 400 },
      },
    ],
  },
  {
    id: 'phone-case',
    name: 'Funda para iPhone',
    category: 'Tecnología',
    price: 19.99,
    canvasWidth: 800,
    canvasHeight: 800,
    colors: [
      { id: 'blanco', name: 'Blanco', hexColor: '#FFFFFF', mockupUrl: 'https://placehold.co/800x800/ffffff/0f172a?text=Funda+Blanca' },
      { id: 'negro', name: 'Negro', hexColor: '#18181b', mockupUrl: 'https://placehold.co/800x800/18181b/ffffff?text=Funda+Negra' },
      { id: 'azul', name: 'Azul', hexColor: '#1d4ed8', mockupUrl: 'https://placehold.co/800x800/1d4ed8/ffffff?text=Funda+Azul' },
    ],
    options: STANDARD_OPTIONS,
    views: [
      {
        id: 'back',
        name: 'Reverso',
        label: 'Reverso',
        mockupUrl: 'https://placehold.co/800x800/png?text=Funda+iPhone',
        printArea: { x: 200, y: 100, width: 300, height: 600 },
      },
    ],
  },
  {
    id: 'mug-11oz',
    name: 'Taza Blanca 11oz',
    category: 'Hogar',
    price: 14.99,
    canvasWidth: 800,
    canvasHeight: 800,
    colors: [
      { id: 'blanco', name: 'Blanco', hexColor: '#FFFFFF', mockupUrl: 'https://placehold.co/800x800/ffffff/0f172a?text=Taza+Blanca' },
      { id: 'negro', name: 'Negro', hexColor: '#18181b', mockupUrl: 'https://placehold.co/800x800/18181b/ffffff?text=Taza+Negra' },
      { id: 'azul', name: 'Azul', hexColor: '#1d4ed8', mockupUrl: 'https://placehold.co/800x800/1d4ed8/ffffff?text=Taza+Azul' },
    ],
    options: [
      { id: 'capacidad', name: 'Capacidad', type: 'select', values: [
        { id: '11oz', label: '11 oz', priceModifier: 0 }, { id: '15oz', label: '15 oz', priceModifier: 2 },
      ] },
    ],
    views: [
      {
        id: 'front',
        name: 'Vista Panorámica',
        label: 'Vista Panorámica',
        mockupUrl: 'https://placehold.co/800x800/png?text=Taza+11oz',
        printArea: { x: 150, y: 180, width: 500, height: 250 },
      },
    ],
  },
  {
    id: 'taza-ceramica-11oz',
    name: 'Taza de Cerámica 11oz',
    category: 'Hogar',
    price: 14.99,
    canvasWidth: 800,
    canvasHeight: 800,
    colors: [
      { id: 'blanco', name: 'Blanco', hexColor: '#FFFFFF', mockupUrl: 'https://picsum.photos/id/20/800/800' },
      { id: 'negro', name: 'Negro Matte', hexColor: '#18181b', mockupUrl: 'https://picsum.photos/id/21/800/800' },
      { id: 'azul', name: 'Azul', hexColor: '#1d4ed8', mockupUrl: 'https://picsum.photos/id/22/800/800' },
    ],
    options: STANDARD_OPTIONS,
    views: [
      {
        id: 'front',
        name: 'Vista Principal',
        label: 'Vista Principal',
        mockupUrl: 'https://picsum.photos/id/20/800/800',
        printArea: { x: 150, y: 250, width: 500, height: 300 },
      },
    ],
  },
  {
    id: 'termo-acero-inoxidable',
    name: 'Termo de Acero Inoxidable',
    category: 'Accesorios',
    price: 29.99,
    canvasWidth: 800,
    canvasHeight: 800,
    colors: [
      { id: 'blanco', name: 'Blanco', hexColor: '#FFFFFF', mockupUrl: 'https://picsum.photos/id/30/800/800' },
      { id: 'negro', name: 'Negro Matte', hexColor: '#18181b', mockupUrl: 'https://picsum.photos/id/31/800/800' },
      { id: 'azul', name: 'Azul', hexColor: '#1d4ed8', mockupUrl: 'https://picsum.photos/id/32/800/800' },
    ],
    options: [
      { id: 'capacidad', name: 'Capacidad', type: 'radio', values: [
        { id: '10oz', label: '10 oz', priceModifier: 0 }, { id: '20oz', label: '20 oz', priceModifier: 4 },
      ] },
    ],
    views: [
      {
        id: 'front',
        name: 'Vista Principal',
        label: 'Vista Principal',
        mockupUrl: 'https://picsum.photos/id/30/800/800',
        colorVariants: [
          { id: 'acero', name: 'Acero', hexColor: '#d1d5db', mockupUrl: 'https://picsum.photos/id/30/800/800' },
          { id: 'negro', name: 'Negro', hexColor: '#111827', mockupUrl: 'https://picsum.photos/id/31/800/800' },
          { id: 'azul', name: 'Azul', hexColor: '#1d4ed8', mockupUrl: 'https://picsum.photos/id/32/800/800' },
        ],
        printArea: { x: 300, y: 175, width: 200, height: 450 },
      },
    ],
  },
  {
    id: 'funda-smartphone-generica',
    name: 'Funda para Smartphone',
    category: 'Accesorios',
    price: 19.99,
    canvasWidth: 800,
    canvasHeight: 800,
    colors: [
      { id: 'blanco', name: 'Blanco', hexColor: '#FFFFFF', mockupUrl: 'https://picsum.photos/id/40/800/800' },
      { id: 'negro', name: 'Negro', hexColor: '#18181b', mockupUrl: 'https://picsum.photos/id/41/800/800' },
      { id: 'azul', name: 'Azul', hexColor: '#1d4ed8', mockupUrl: 'https://picsum.photos/id/42/800/800' },
    ],
    options: STANDARD_OPTIONS,
    views: [
      {
        id: 'front',
        name: 'Vista Principal',
        label: 'Vista Principal',
        mockupUrl: 'https://picsum.photos/id/40/800/800',
        printArea: { x: 275, y: 100, width: 250, height: 600 },
      },
    ],
  },
];
