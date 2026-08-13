/**
 * Define la estructura de PRODUCTOS personalizables con múltiples vistas.
 * Cada producto expone una o varias vistas (frente, espalda, vista panorámica...)
 * con su imagen de overlay (el propio artículo) y su zona de diseño activa.
 */

export interface ProductView {
  id: string;
  /** Nombre visible de la cara: Frente, Espalda, Lateral, etc. */
  name: string;
  /** Alias heredado para los productos persistidos antes de `name`. */
  label?: string;
  /** Imagen base del mockup que se muestra en el editor. */
  mockupUrl: string;
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
  views: ProductView[];
}

/** Alias temporal para los componentes existentes del editor. */
export type ProductConfig = Product;

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
    views: [
      {
        id: 'front',
        name: 'Vista Principal',
        label: 'Vista Principal',
        mockupUrl: 'https://picsum.photos/id/30/800/800',
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
