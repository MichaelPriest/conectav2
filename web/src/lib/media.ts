/**
 * Compresses large static photos before uploading to private object storage.
 * Does not re-encode animated GIFs or videos. Image optimization is best effort;
 * upload still works in browsers without createImageBitmap/canvas APIs.
 */
export async function optimizeImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  if (file.size < 350_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const longest = Math.max(bitmap.width, bitmap.height);
      const scale = Math.min(1, 1800 / longest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
      if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
      const basename = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], basename + '.webp', { type: 'image/webp', lastModified: Date.now() });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
