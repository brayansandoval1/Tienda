export interface Dimensiones {
  anchoMm: number;
  altoMm: number;
  profundoMm: number;
}

export interface Variante {
  id: string;
  nombre: string;
  color: string;
  imageUrl: string;
  sku: string;
}

export interface ZonaEdicion {
  id: string;
  nombre: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TextOptions {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  imagenUrl: string;
  precio: number;
  variantes: Variante[];
  zonasEdicion: ZonaEdicion[];
  pesoGramos?: number;
  dimensiones?: Dimensiones;
}
