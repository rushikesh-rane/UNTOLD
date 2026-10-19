// Prepares a photo picked in the browser for upload to the story-images bucket.
//
// Phones are the reason this exists: gallery photos often arrive with an empty or unusual
// MIME type (image/heic, image/heif, "" on some Android pickers), and they are usually far
// bigger than 5 MB straight off the camera. So instead of trusting file.type and file.size
// up front, we:
//   1. sniff the real format from the file's first bytes,
//   2. decode it in the browser (createImageBitmap, then <img> as a fallback),
//   3. resize and re-encode it to JPEG (accepted by every bucket configuration),
//   4. only then check the result against the bucket's 5 MB limit.
// GIFs are passed through untouched so animation survives.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // matches the story-images bucket limit
const MAX_INPUT_BYTES = 60 * 1024 * 1024; // refuse absurdly large originals before decoding

export type PreparedImage = { blob: Blob; ext: string; type: string };
export type PrepareOptions = {
  /** Longest edge (or the side length when `square`) of the output, in pixels. */
  maxSide: number;
  /** Centre-crop to a square (avatars). */
  square?: boolean;
  quality?: number;
};

type Kind = 'jpeg' | 'png' | 'gif' | 'webp' | 'heic' | 'avif' | null;

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'];
const EXT_TO_KIND: Record<string, Kind> = {
  jpg: 'jpeg', jpeg: 'jpeg', jpe: 'jpeg', jfif: 'jpeg', png: 'png', gif: 'gif', webp: 'webp',
  heic: 'heic', heif: 'heic', avif: 'avif',
};
const KIND_INFO: Record<Exclude<Kind, null>, { type: string; ext: string }> = {
  jpeg: { type: 'image/jpeg', ext: 'jpg' },
  png: { type: 'image/png', ext: 'png' },
  gif: { type: 'image/gif', ext: 'gif' },
  webp: { type: 'image/webp', ext: 'webp' },
  heic: { type: 'image/heic', ext: 'heic' },
  avif: { type: 'image/avif', ext: 'avif' },
};

async function sniffKind(file: File): Promise<Kind> {
  try {
    const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
    if (ascii(0, 3) === 'GIF') return 'gif';
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
    if (ascii(4, 8) === 'ftyp') {
      const brand = ascii(8, 12);
      if (brand === 'avif' || brand === 'avis') return 'avif';
      if (HEIC_BRANDS.includes(brand)) return 'heic';
    }
  } catch { /* Fall through to the name / MIME type. */ }
  const fromName = EXT_TO_KIND[(file.name.split('.').pop() || '').toLowerCase()];
  if (fromName) return fromName;
  const fromType = EXT_TO_KIND[(file.type.split('/')[1] || '').toLowerCase()];
  return fromType ?? null;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded | null> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch { /* Try the <img> route next. */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('empty');
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, options: PrepareOptions): Promise<PreparedImage> {
  if (!file.size) throw new Error('That file is empty. Please pick a different photo.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That file is too large. Please pick a photo under 60 MB.');

  const kind = await sniffKind(file);
  if (!kind) throw new Error('That doesn’t look like an image. Please pick a photo from your gallery.');

  // Animated GIFs are uploaded as they are.
  if (kind === 'gif') {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('That GIF is over 5 MB. Please pick a smaller one.');
    return { blob: file, ext: 'gif', type: 'image/gif' };
  }

  const decoded = await decode(file);
  if (!decoded) {
    // Couldn't draw it, but a JPEG/PNG that already fits can still be uploaded as-is.
    if ((kind === 'jpeg' || kind === 'png') && file.size <= MAX_UPLOAD_BYTES) {
      const info = KIND_INFO[kind];
      return { blob: file.slice(0, file.size, info.type), ext: info.ext, type: info.type };
    }
    if (kind === 'heic') {
      throw new Error('This browser can’t open HEIC photos. Try Safari, or save the photo as JPG first (iPhone: Settings › Camera › Formats › Most Compatible).');
    }
    throw new Error('Couldn’t read that image. Please try a different photo.');
  }

  try {
    const { width, height } = decoded;
    const side = Math.min(width, height);
    const target = options.square ? Math.min(options.maxSide, side) : Math.min(1, options.maxSide / Math.max(width, height));
    const outW = options.square ? target : Math.max(1, Math.round(width * target));
    const outH = options.square ? target : Math.max(1, Math.round(height * target));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Couldn’t process that image in this browser.');
    if (options.square) {
      ctx.drawImage(decoded.source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, outW, outH);
    } else {
      ctx.drawImage(decoded.source, 0, 0, outW, outH);
    }

    // Always output JPEG: every Storage bucket accepts it (a bucket's allowed-types list may not
    // include WebP, which is what caused "mime type image/webp is not supported"). Transparent
    // areas are flattened onto white.
    const quality = options.quality ?? 0.86;
    const flat = document.createElement('canvas');
    flat.width = outW;
    flat.height = outH;
    const flatCtx = flat.getContext('2d');
    if (!flatCtx) throw new Error('Couldn’t process that image in this browser.');
    flatCtx.fillStyle = '#ffffff';
    flatCtx.fillRect(0, 0, outW, outH);
    flatCtx.drawImage(canvas, 0, 0);
    const blob = await toBlob(flat, 'image/jpeg', quality);
    const type = 'image/jpeg';
    const ext = 'jpg';
    if (!blob) throw new Error('Couldn’t process that image. Please try a different photo.');
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('That image is still over 5 MB after resizing. Please pick a smaller one.');
    return { blob, ext, type };
  } finally {
    decoded.release();
  }
}

// crypto.randomUUID() only exists on secure pages (https or localhost), so opening the site from a
// phone over a local http:// address would crash uploads. This works everywhere.
export function randomFileId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Pulls a readable message out of Error objects and Supabase's plain error objects alike. */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message || fallback;
  }
  return fallback;
}
