import { PDFDocument } from 'pdf-lib';
import { mergeIntoOnePdf } from './mergeInvoicePdf';

/**
 * The portal reads each upload as base64 inside one JSON request and rejects anything over
 * about 2.1 million characters, so a file must stay under roughly 1.5 MB. Stay a little below.
 */
export const PORTAL_MAX_FILE_BYTES = 1_400_000;

export interface PreparedUploads {
  files: File[];
  /** What was changed, in plain words. */
  notes: string[];
}

const isPdf = (f: File) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
const isPicture = (f: File) => /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name);
const isTiff = (f: File) => /\.tiff?$/i.test(f.name);

const baseName = (name: string) => name.replace(/\.[^.]+$/, '');

/** Rescale and recompress a picture until it fits. */
async function shrinkPicture(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.7, 0.55]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= PORTAL_MAX_FILE_BYTES) {
          return new File([blob], `${baseName(file.name)}.jpg`, { type: 'image/jpeg' });
        }
      }
      scale *= 0.75;
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`${file.name} could not be made small enough for the portal.`);
}

async function pdfBytes(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save();
}

/**
 * A page that is too big on its own (usually a high-resolution scan) is drawn as a picture
 * and saved again as a one-page PDF at a size that fits.
 */
async function rasterizePage(source: Uint8Array, pageIndex: number, name: string): Promise<Uint8Array> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: source.slice() });
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    let scale = Math.min(2, 1700 / Math.max(base.width, base.height));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      for (const quality of [0.8, 0.65, 0.5]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) continue;
        const out = await PDFDocument.create();
        const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const sheet = out.addPage([base.width, base.height]);
        sheet.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
        const bytes = await out.save();
        if (bytes.length <= PORTAL_MAX_FILE_BYTES) return bytes;
      }
      scale *= 0.75;
    }
  } finally {
    await pdf.destroy();
  }
  throw new Error(`Page ${pageIndex + 1} of ${name} could not be made small enough for the portal.`);
}

interface SplitResult {
  files: File[];
  /** Pages that had to be turned into pictures to fit. */
  flattened: number;
}

/** Split a PDF into parts that each fit, by whole pages. */
async function splitPdf(name: string, blob: Blob): Promise<SplitResult> {
  const sourceBytes = new Uint8Array(await blob.arrayBuffer());
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const total = source.getPageCount();
  const groups: Uint8Array[] = [];
  let flattened = 0;

  let current = await PDFDocument.create();
  let currentCount = 0;
  let currentBytes: Uint8Array | null = null;
  const startOver = async () => {
    current = await PDFDocument.create();
    currentCount = 0;
    currentBytes = null;
  };

  for (let i = 0; i < total; i += 1) {
    const [page] = await current.copyPages(source, [i]);
    current.addPage(page);
    currentCount += 1;
    const bytes = await pdfBytes(current);
    if (bytes.length <= PORTAL_MAX_FILE_BYTES) {
      currentBytes = bytes;
      continue;
    }
    if (currentCount > 1) {
      // That page does not fit: close the part without it and try it on its own.
      if (currentBytes) groups.push(currentBytes);
      await startOver();
      const [again] = await current.copyPages(source, [i]);
      current.addPage(again);
      currentCount = 1;
      const single = await pdfBytes(current);
      if (single.length <= PORTAL_MAX_FILE_BYTES) {
        currentBytes = single;
        continue;
      }
    }
    // Too big even alone.
    groups.push(await rasterizePage(sourceBytes, i, name));
    flattened += 1;
    await startOver();
  }
  if (currentBytes) groups.push(currentBytes);

  const base = baseName(name);
  return {
    flattened,
    files: groups.map(
      (bytes, index) =>
        new File([bytes], `${base} (part ${index + 1} of ${groups.length}).pdf`, { type: 'application/pdf' })
    ),
  };
}

/**
 * Make every file small enough for the portal: pictures are scaled down, PDFs are split by page.
 * Files already under the limit are left alone.
 */
export async function prepareForPortal(input: File[]): Promise<PreparedUploads> {
  const files: File[] = [];
  const notes: string[] = [];

  for (const file of input) {
    if (file.size <= PORTAL_MAX_FILE_BYTES) {
      files.push(file);
      continue;
    }
    if (isPicture(file)) {
      const small = await shrinkPicture(file);
      files.push(small);
      notes.push(`${file.name} was shrunk to ${(small.size / 1_000_000).toFixed(1)} MB`);
    } else if (isPdf(file)) {
      const { files: parts, flattened } = await splitPdf(file.name, file);
      files.push(...parts);
      notes.push(
        `${file.name} was split into ${parts.length} part${parts.length === 1 ? '' : 's'}` +
          (flattened ? `, ${flattened} oversized page${flattened === 1 ? '' : 's'} recompressed` : '')
      );
    } else if (isTiff(file)) {
      const merged = await mergeIntoOnePdf([{ fileName: file.name, blob: file }]);
      if (merged.skipped.length) throw new Error(`${file.name} could not be converted.`);
      const { files: parts } = await splitPdf(`${baseName(file.name)}.pdf`, merged.blob);
      files.push(...parts);
      notes.push(`${file.name} was converted to PDF${parts.length > 1 ? ` in ${parts.length} parts` : ''}`);
    } else {
      throw new Error(
        `${file.name} is over the portal's limit of about 1.5 MB and this file type cannot be shrunk.`
      );
    }
  }
  return { files, notes };
}
