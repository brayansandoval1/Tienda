/** Valida la cabecera binaria mínima de un archivo glTF 2.0 (.glb). */
export function validateGLBArrayBuffer(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength < 12) return 'El archivo es demasiado pequeño para ser un GLB válido.';

  const header = new DataView(buffer);
  if (header.getUint32(0, true) !== 0x46546c67) {
    return 'El archivo no tiene la firma binaria «glTF». Puede haberse exportado con extensión .glb sin ser un GLB real. Vuelve a exportarlo desde el generador actualizado.';
  }
  if (header.getUint32(4, true) !== 2) return 'El archivo usa una versión GLB no compatible.';
  if (header.getUint32(8, true) !== buffer.byteLength) return 'La longitud declarada del GLB no coincide con el tamaño del archivo. Vuelve a exportarlo.';
  return null;
}
