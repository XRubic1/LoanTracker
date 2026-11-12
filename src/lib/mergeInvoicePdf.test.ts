import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergeIntoOnePdf } from '@/lib/mergeInvoicePdf';

async function pdfWithPages(count: number): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i += 1) doc.addPage([200, 200]);
  return new Blob([await doc.save()], { type: 'application/pdf' });
}

describe('mergeIntoOnePdf', () => {
  it('puts every PDF page into one document, in order', async () => {
    const result = await mergeIntoOnePdf([
      { fileName: 'a_1.pdf', blob: await pdfWithPages(2) },
      { fileName: 'a_2.pdf', blob: await pdfWithPages(3) },
    ]);
    expect(result.pages).toBe(5);
    expect(result.skipped).toEqual([]);
    const merged = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()));
    expect(merged.getPageCount()).toBe(5);
  });

  it('leaves out files that are not PDFs or images', async () => {
    const result = await mergeIntoOnePdf([
      { fileName: 'a_1.pdf', blob: await pdfWithPages(1) },
      { fileName: 'sheet.xlsx', blob: new Blob(['x']) },
      { fileName: 'broken.pdf', blob: new Blob(['not a pdf']) },
    ]);
    expect(result.pages).toBe(1);
    expect(result.skipped).toEqual(['sheet.xlsx', 'broken.pdf']);
  });
});
