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

/** Split a PDF into parts that each fit, by whole pages. */
async function splitPdf(name: string, blob: Blob): Promise<File[]> {
  const source = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()), { ignoreEncryption: true });
  const total = source.getPageCount();
  const groups: Uint8Array[] = [];

  let current = await PDFDocument.create();
  let currentCount = 0;
  let currentBytes: Uint8Array | null = null;

  for (let i = 0; i < total; i += 1) {
    const [page] = await current.copyPages(source, [i]);
    current.addPage(page);
    currentCount += 1;
    const bytes = await pdfBytes(current);
    if (bytes.length <= PORTAL_MAX_FILE_BYTES) {
      currentBytes = bytes;
      continue;
    }
    if (currentCount === 1) {
      throw new Error(
        `Page ${i + 1} of ${name} is too large for the portal on its own (${(bytes.length / 1_000_000).toFixed(1)} MB).`
      );
    }
    // That page does not fit: close the part without it and start the next part with it.
    if (!currentBytes) throw new Error(`Could not split ${name}.`);
    groups.push(currentBytes);
    current = await PDFDocument.create();
    const [again] = await current.copyPages(source, [i]);
    current.addPage(again);
    currentCount = 1;
    const single = await pdfBytes(current);
    if (single.length > PORTAL_MAX_FILE_BYTES) {
      throw new Error(
        `Page ${i + 1} of ${name} is too large for the portal on its own (${(single.length / 1_000_000).toFixed(1)} MB).`
      );
    }
    currentBytes = single;
  }
  if (currentBytes) groups.push(currentBytes);

  const base = baseName(name);
  return groups.map(
    (bytes, index) =>
      new File([bytes], `${base} (part ${index + 1} of ${groups.length}).pdf`, { type: 'application/pdf' })
  );
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
      const parts = await splitPdf(file.name, file);
      files.push(...parts);
      notes.push(`${file.name} was split into ${parts.length} parts`);
    } else if (isTiff(file)) {
      const merged = await mergeIntoOnePdf([{ fileName: file.name, blob: file }]);
      if (merged.skipped.length) throw new Error(`${file.name} could not be converted.`);
      const parts = await splitPdf(`${baseName(file.name)}.pdf`, merged.blob);
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
