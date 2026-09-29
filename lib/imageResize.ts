/**
 * Shrink a photo in the browser before upload: longest side ≤ maxSide, saved as JPEG.
 * Keeps uploads small (Vercel functions accept at most 4.5 MB) and strips EXIF data such as GPS.
 */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('poster_not_image');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('poster_not_image');
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('poster_not_image');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  for (const q of [quality, 0.72, 0.6]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (blob && blob.size <= 4 * 1024 * 1024) return new File([blob], 'poster.jpg', { type: 'image/jpeg' });
  }
  throw new Error('poster_too_large');
}
