import { PDFDocument } from 'pdf-lib';
import UTIF from 'utif';

export interface MergeInput {
  fileName: string;
  blob: Blob;
}

export interface MergeResult {
  blob: Blob;
  pages: number;
  /** Files that could not be added. */
  skipped: string[];
}

const isPdf = (name: string) => /\.pdf$/i.test(name);
const isJpg = (name: string) => /\.jpe?g$/i.test(name);
const isPng = (name: string) => /\.png$/i.test(name);
const isTiff = (name: string) => /\.tiff?$/i.test(name);
/** Other pictures the browser can open itself. */
const isBrowserImage = (name: string) => /\.(gif|bmp|webp)$/i.test(name);

/** Letter size; pictures are scaled down to fit a page, keeping their shape. */
const PAGE_LONG = 792;
const PAGE_SHORT = 612;

const canDraw = () => typeof document !== 'undefined';

async function canvasToJpeg(source: CanvasImageSource, width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  // White behind the picture, so transparent areas do not turn black in the JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not convert the picture');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Every page of a TIFF as a JPEG. */
async function tiffPages(bytes: Uint8Array): Promise<Uint8Array[]> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const pages: Uint8Array[] = [];
  for (const ifd of UTIF.decode(buffer)) {
    UTIF.decodeImage(buffer, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    const raw = document.createElement('canvas');
    raw.width = ifd.width;
    raw.height = ifd.height;
    const ctx = raw.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), ifd.width, ifd.height), 0, 0);
    pages.push(await canvasToJpeg(raw, ifd.width, ifd.height));
  }
  return pages;
}

async function browserImageAsJpeg(blob: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);
  try {
    return await canvasToJpeg(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

async function addPicture(out: PDFDocument, image: Awaited<ReturnType<PDFDocument['embedJpg']>>) {
  const portrait = image.height >= image.width;
  const maxW = portrait ? PAGE_SHORT : PAGE_LONG;
  const maxH = portrait ? PAGE_LONG : PAGE_SHORT;
  const scale = Math.min(1, maxW / image.width, maxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const page = out.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
}

/** Combine PDFs and pictures (JPG, PNG, TIF, GIF, BMP, WebP) into one PDF, in the order given. */
export async function mergeIntoOnePdf(inputs: MergeInput[]): Promise<MergeResult> {
  const out = await PDFDocument.create();
  const skipped: string[] = [];

  for (const { fileName, blob } of inputs) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    try {
      if (isPdf(fileName)) {
        const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(source, source.getPageIndices());
        for (const page of pages) out.addPage(page);
      } else if (isJpg(fileName)) {
        await addPicture(out, await out.embedJpg(bytes));
      } else if (isPng(fileName)) {
        await addPicture(out, await out.embedPng(bytes));
      } else if (isTiff(fileName) && canDraw()) {
        const pages = await tiffPages(bytes);
        if (pages.length === 0) throw new Error('Empty TIFF');
        for (const jpeg of pages) await addPicture(out, await out.embedJpg(jpeg));
      } else if (isBrowserImage(fileName) && canDraw()) {
        await addPicture(out, await out.embedJpg(await browserImageAsJpeg(blob)));
      } else {
        skipped.push(fileName);
      }
    } catch {
      skipped.push(fileName);
    }
  }

  const merged = await out.save();
  return {
    blob: new Blob([merged], { type: 'application/pdf' }),
    pages: out.getPageCount(),
    skipped,
  };
}
