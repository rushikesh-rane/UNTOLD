// Turns a chosen photo into a small square avatar in the browser before upload:
// centre-cropped, at most 320px, WebP. GIFs and anything the browser can't process
// are uploaded unchanged.
export async function prepareAvatar(file: File): Promise<{ blob: Blob; ext: string }> {
  const original = { blob: file as Blob, ext: (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg') };
  if (file.type === 'image/gif') return original;
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const size = Math.min(320, side);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return original; }
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (blob && blob.type === 'image/webp') return { blob, ext: 'webp' };
  } catch { /* Fall back to the original file. */ }
  return original;
}
