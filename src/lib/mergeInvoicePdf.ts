import { PDFDocument } from 'pdf-lib';

export interface MergeInput {
  fileName: string;
  blob: Blob;
}

export interface MergeResult {
  blob: Blob;
  pages: number;
  /** Files that could not be added (not a PDF or image). */
  skipped: string[];
}

const isPdf = (name: string) => /\.pdf$/i.test(name);
const isJpg = (name: string) => /\.jpe?g$/i.test(name);
const isPng = (name: string) => /\.png$/i.test(name);

/** Combine PDFs (and JPG / PNG scans) into one PDF, in the order given. */
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
      } else if (isJpg(fileName) || isPng(fileName)) {
        const image = isPng(fileName) ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const page = out.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
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
