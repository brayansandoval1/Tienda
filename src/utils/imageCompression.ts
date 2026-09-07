/**
 * Comprime una imagen seleccionada por el usuario antes de persistirla en
 * localStorage como Base64 (data URL). localStorage tiene una cuota de ~5MB,
 * por lo que guardar fotos originales en Base64 provoca QuotaExceededError.
 *
 * - Redimensiona a un máximo de `maxDim` px por el lado mayor.
 * - Exporta a WebP (conserva transparencia y comprime mucho); si el navegador
 *   no soporta WebP en canvas, hace fallback a JPEG (fondo blanco).
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDim = 800,
  quality = 0.85,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('No se pudo leer el archivo'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Imagen inválida'));
      img.src = dataUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return dataUrl;

    // JPEG no soporta transparencia: fondo blanco para que no salga negro.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    // WebP conserva el canal alfa y comprime mucho mejor que PNG.
    const webp = canvas.toDataURL('image/webp', quality);
    if (webp.startsWith('data:image/webp')) return webp;
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    // Si el navegador no puede procesar la imagen, se guarda el original.
    return dataUrl;
  }
}
