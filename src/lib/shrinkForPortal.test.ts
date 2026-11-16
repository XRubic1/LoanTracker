import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { PORTAL_MAX_FILE_BYTES, prepareForPortal } from './shrinkForPortal';

async function pdf(name: string, pages: number, junkBytes = 0): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${name} page ${i + 1}`);
    if (junkBytes) {
      const junk = new Uint8Array(junkBytes);
      for (let j = 0; j < junk.length; j += 1) junk[j] = (j * 31 + i * 7 + ((j >> 3) ^ (j * 13))) & 255;
      page.node.set(PDFName.of('Junk'), doc.context.register(doc.context.stream(junk)));
    }
  }
  return new File([await doc.save({ useObjectStreams: false })], name, { type: 'application/pdf' });
}

const pageCount = async (file: File) =>
  (await PDFDocument.load(new Uint8Array(await file.arrayBuffer()))).getPageCount();

describe('prepareForPortal', () => {
  it('leaves one small PDF alone', async () => {
    const one = await pdf('BOL1.pdf', 1);
    const out = await prepareForPortal([one]);
    expect(out.files).toEqual([one]);
    expect(out.notes).toEqual([]);
  });

  it('combines several files into exactly one PDF', async () => {
    const out = await prepareForPortal([await pdf('BOL1.pdf', 1), await pdf('BOL2.pdf', 2)]);
    expect(out.files).toHaveLength(1);
    expect(out.files[0].name).toBe('BOL1 (combined).pdf');
    expect(await pageCount(out.files[0])).toBe(3);
    expect(out.notes[0]).toMatch(/combined/);
  });

  it('never splits: a file that cannot be compressed is an error, not several parts', async () => {
    const big = await pdf('scan.pdf', 8, 600_000);
    expect(big.size).toBeGreaterThan(PORTAL_MAX_FILE_BYTES);
    // No canvas outside a browser, so compression cannot run here and the upload is refused.
    await expect(prepareForPortal([big])).rejects.toThrow(/too large.*Cadence/);
  });

  it('refuses files that are not PDFs or pictures', async () => {
    const sheet = new File([new Uint8Array(10)], 'sheet.xlsx');
    await expect(prepareForPortal([await pdf('a.pdf', 1), sheet])).rejects.toThrow(/sheet\.xlsx/);
  });
});
