// Reduce una foto antes de enviarla: las del iPhone pesan 3-5 MB y para leer una lista basta con ~1600 px.
// Menos datos = más rápido con mala cobertura en el súper y dentro de los límites de la IA.

/** Devuelve la imagen como JPEG en base64 (sin el prefijo "data:"), con el lado mayor ≤ maxSide. */
export async function shrinkImage(
  file: Blob,
  maxSide = 1600,
  quality = 0.8,
): Promise<{ base64: string; mimeType: string }> {
  // createImageBitmap respeta la orientación de la foto (EXIF): no sale girada.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' };
}
