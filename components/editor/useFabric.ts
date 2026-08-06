'use client';

import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

/**
 * Define el tipo para la función de inicialización que configurará el lienzo.
 * @param canvas La instancia de fabric.Canvas a configurar.
 */
type FabricInitializer = (canvas: fabric.Canvas) => void;

/**
 * Un hook personalizado para administrar una instancia de Fabric.js en un componente de React.
 * Se encarga de la inicialización y la limpieza del lienzo de forma segura para SSR.
 *
 * @param initializer Una función que se ejecuta una vez que el lienzo está listo. Úsala para añadir objetos, eventos, etc.
 * @returns Un objeto que contiene la referencia para el elemento canvas y la instancia del lienzo de Fabric.
 */
export const useFabric = (initializer: FabricInitializer) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    // Asegurarse de que el código se ejecute solo en el cliente y que el lienzo no se reinicialice.
    if (canvasRef.current && !fabricCanvasRef.current) {
      const canvas = new fabric.Canvas(canvasRef.current);
      fabricCanvasRef.current = canvas;

      // Ejecutar la función de configuración proporcionada por el componente.
      initializer(canvas);
    }

    // Función de limpieza para destruir la instancia del lienzo cuando el componente se desmonte.
    return () => {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, [initializer]);

  return { canvasRef, fabricCanvasRef };
};