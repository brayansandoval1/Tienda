/**
 * Define la estructura para la configuración de un producto personalizable.
 */
export interface ProductConfig {
  id: string;
  name: string;
  category: string;
  price: number;
  mockupUrl: string;
  /** Imagen de mockup opcional para la cara trasera (si el producto es de doble cara) */
  mockupBackUrl?: string;
  canvasWidth: number;
  canvasHeight: number;
  printArea: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * Catálogo de productos personalizables disponibles en la tienda.
 */
export const PRODUCTS: ProductConfig[] = [
  {
    id: 'playera-algodon-unisex',
    name: 'Playera Personalizada',
    category: 'Ropa',
    price: 24.99,
    mockupUrl: 'https://picsum.photos/id/10/800/800', // Playera genérica (frente)
    mockupBackUrl: 'https://picsum.photos/id/11/800/800', // Playera genérica (espalda)
    canvasWidth: 800,
    canvasHeight: 800,
    printArea: {
      left: 250,
      top: 200,
      width: 300,
      height: 400,
    },
  },
  {
    id: 'taza-ceramica-11oz',
    name: 'Taza de Cerámica 11oz',
    category: 'Hogar',
    price: 14.99,
    mockupUrl: 'https://picsum.photos/id/20/800/800', // Taza genérica
    canvasWidth: 800,
    canvasHeight: 800,
    printArea: {
      left: 150,
      top: 250,
      width: 500,
      height: 300,
    },
  },
  {
    id: 'termo-acero-inoxidable',
    name: 'Termo de Acero Inoxidable',
    category: 'Accesorios',
    price: 29.99,
    mockupUrl: 'https://picsum.photos/id/30/800/800', // Termo genérico
    canvasWidth: 800,
    canvasHeight: 800,
    printArea: {
      left: 300,
      top: 175,
      width: 200,
      height: 450,
    },
  },
  {
    id: 'funda-smartphone-generica',
    name: 'Funda para Smartphone',
    category: 'Accesorios',
    price: 19.99,
    mockupUrl: 'https://picsum.photos/id/40/800/800', // Funda genérica
    canvasWidth: 800,
    canvasHeight: 800,
    printArea: {
      left: 275,
      top: 100,
      width: 250,
      height: 600,
    },
  },
];