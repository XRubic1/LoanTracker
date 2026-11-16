import { PDFDocument, PDFName } from 'pdf-lib';
import { mergeIntoOnePdf } from './mergeInvoicePdf';

/**
 * The portal reads each upload as base64 inside one JSON request and rejects anything over
 * about 2.1 million characters, so a file must stay under roughly 1.5 MB. Stay a little below.
 */
export const PORTAL_MAX_FILE_BYTES = 1_400_000;

export const TOO_LARGE_MESSAGE =
  'This file is too large for the portal, even after compressing it. Please upload it from Cadence.';

export interface PreparedUploads {
  /** Always exactly one file: the portal repeats earlier files whenever a second one is added. */
  files: File[];
  /** What went in and what came out, for the debug view. */
  trace: unknown;
  /** What was changed, in plain words. */
  notes: string[];
}

const isPdf = (f: File) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
const baseName = (name: string) => name.replace(/\.[^.]+$/, '');
const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/** Pages are redrawn as pictures at these settings, from gentle to the lowest still readable. */
const LEVELS = [
  { long: 1700, quality: 0.8 },
  { long: 1500, quality: 0.7 },
  { long: 1300, quality: 0.6 },
  { long: 1100, quality: 0.5 },
  { long: 900, quality: 0.42 },
];
/** Levels tried on every heavy page together before the largest pages are squeezed one by one. */
const WHOLE_FILE_LEVELS = 3;
/** Pages smaller than this on their own are light (text, vector) and are kept as they are. */
const HEAVY_PAGE_BYTES = 60_000;

/**
 * Links, thumbnails and the like point at other pages, and copying a page drags those pages
 * (and their pictures) along. Drop them so a page carries only itself.
 */
function stripPageLinks(doc: PDFDocument) {
  for (const page of doc.getPages()) {
    for (const key of ['Annots', 'Thumb', 'B', 'StructParents', 'PieceInfo']) page.node.delete(PDFName.of(key));
  }
}

async function standaloneSizes(source: PDFDocument): Promise<number[]> {
  const sizes: number[] = [];
  for (let i = 0; i < source.getPageCount(); i += 1) {
    const one = await PDFDocument.create();
    const [page] = await one.copyPages(source, [i]);
    one.addPage(page);
    sizes.push((await one.save()).length);
  }
  return sizes;
}

interface Renderer {
  jpeg(index: number, level: number): Promise<{ jpeg: Uint8Array; width: number; height: number }>;
  destroy(): Promise<void>;
}

/** Draws pages of a PDF to JPEG with pdf.js (loaded only when something needs compressing). */
async function openRenderer(bytes: Uint8Array): Promise<Renderer> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  return {
    async jpeg(index, level) {
      const page = await doc.getPage(index + 1);
      const base = page.getViewport({ scale: 1 });
      const { long, quality } = LEVELS[level];
      const viewport = page.getViewport({ scale: Math.min(3, long / Math.max(base.width, base.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error('Could not convert the page');
      return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: base.width, height: base.height };
    },
    destroy: () => doc.destroy(),
  };
}

/**
 * Make one PDF fit. First every heavy page is redrawn at gentler-to-lower settings together;
 * if it is still too big, the largest pages are squeezed further one at a time.
 * Returns null when even the lowest readable settings do not fit.
 */
async function compressPdf(sourceBytes: Uint8Array): Promise<Uint8Array | null> {
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  stripPageLinks(source);
  const count = source.getPageCount();
  const sizes = await standaloneSizes(source);
  let heavy = sizes.map((_, i) => i).filter((i) => sizes[i] > HEAVY_PAGE_BYTES);
  if (heavy.length === 0) heavy = sizes.map((_, i) => i);

  const renderer = await openRenderer(sourceBytes);
  try {
    const cache = new Map<string, Awaited<ReturnType<Renderer['jpeg']>>>();
    const jpegAt = async (index: number, level: number) => {
      const key = `${index}:${level}`;
      let hit = cache.get(key);
      if (!hit) {
        hit = await renderer.jpeg(index, level);
        cache.set(key, hit);
      }
      return hit;
    };

    const levels = new Map<number, number>();
    const build = async () => {
      const out = await PDFDocument.create();
      for (let i = 0; i < count; i += 1) {
        const level = levels.get(i);
        if (level === undefined) {
          const [page] = await out.copyPages(source, [i]);
          out.addPage(page);
        } else {
          const { jpeg, width, height } = await jpegAt(i, level);
          const image = await out.embedJpg(jpeg);
          out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
        }
      }
      return out.save();
    };

    // 1. The whole file, a little harder each round.
    for (let level = 0; level < WHOLE_FILE_LEVELS; level += 1) {
      for (const i of heavy) levels.set(i, level);
      const bytes = await build();
      if (bytes.length <= PORTAL_MAX_FILE_BYTES) return bytes;
    }

    // 2. The largest page, harder each round, until nothing can go lower.
    const floor = LEVELS.length - 1;
    for (;;) {
      let pick = -1;
      let pickSize = -1;
      for (const i of heavy) {
        const level = levels.get(i) ?? 0;
        if (level >= floor) continue;
        const size = (await jpegAt(i, level)).jpeg.length;
        if (size > pickSize) {
          pick = i;
          pickSize = size;
        }
      }
      if (pick < 0) return null;
      levels.set(pick, (levels.get(pick) ?? 0) + 1);
      const bytes = await build();
      if (bytes.length <= PORTAL_MAX_FILE_BYTES) return bytes;
    }
  } finally {
    await renderer.destroy();
  }
}

/** Names, sizes and page counts before and after, so odd uploads can be traced. */
async function describe(before: File[], after: File[]) {
  const one = async (f: File) => {
    let pages: number | undefined;
    if (isPdf(f)) {
      try {
        pages = (await PDFDocument.load(new Uint8Array(await f.arrayBuffer()), { ignoreEncryption: true })).getPageCount();
      } catch {
        pages = undefined;
      }
    }
    return { name: f.name, bytes: f.size, pages };
  };
  return { input: await Promise.all(before.map(one)), output: await Promise.all(after.map(one)) };
}

/**
 * Turn whatever was chosen into ONE PDF that fits the portal:
 * several files, pictures and TIFFs are combined into a single PDF; if that is over the limit
 * it is compressed. If it still does not fit, an error is thrown and nothing should be uploaded.
 * The portal repeats every earlier file when a further one is added, so never send more than one.
 */
export async function prepareForPortal(input: File[]): Promise<PreparedUploads> {
  if (input.length === 0) throw new Error('Choose at least one file.');
  const notes: string[] = [];

  const only = input.length === 1 ? input[0] : null;
  if (only && isPdf(only) && only.size <= PORTAL_MAX_FILE_BYTES) {
    return { files: [only], notes, trace: await describe(input, [only]) };
  }

  let bytes: Uint8Array;
  if (only && isPdf(only)) {
    bytes = new Uint8Array(await only.arrayBuffer());
  } else {
    const merged = await mergeIntoOnePdf(input.map((f) => ({ fileName: f.name, blob: f })));
    if (merged.skipped.length) {
      throw new Error(
        `${merged.skipped.join(', ')} could not be added to the PDF. Only PDF, JPG, PNG, TIF, GIF, BMP and WebP files can be uploaded.`
      );
    }
    bytes = new Uint8Array(await merged.blob.arrayBuffer());
    if (input.length > 1) notes.push(`${input.length} files were combined into one PDF`);
    else notes.push(`${input[0].name} was converted to PDF`);
  }

  if (bytes.length > PORTAL_MAX_FILE_BYTES) {
    const before = bytes.length;
    let squeezed: Uint8Array | null = null;
    try {
      squeezed = await compressPdf(bytes);
    } catch {
      squeezed = null;
    }
    if (!squeezed) throw new Error(`${TOO_LARGE_MESSAGE} (${mb(before)})`);
    bytes = squeezed;
    notes.push(`compressed from ${mb(before)} to ${mb(bytes.length)}`);
  }

  const name = only ? `${baseName(only.name)}.pdf` : `${baseName(input[0].name)} (combined).pdf`;
  const file = new File([bytes], name, { type: 'application/pdf' });
  return { files: [file], notes, trace: await describe(input, [file]) };
}
