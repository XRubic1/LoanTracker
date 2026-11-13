import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { PORTAL_MAX_FILE_BYTES, prepareForPortal } from './shrinkForPortal';

async function bigPdf(pages: number, bytesPerPage: number): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) {
    const page = doc.addPage([612, 792]);
    const junk = new Uint8Array(bytesPerPage);
    for (let j = 0; j < junk.length; j += 1) junk[j] = (j * 31 + i * 7 + ((j >> 3) ^ (j * 13))) & 255;
    const stream = doc.context.stream(junk);
    page.node.set(PDFName.of('Junk'), doc.context.register(stream));
  }
  return new File([await doc.save({ useObjectStreams: false })], 'scan.pdf', { type: 'application/pdf' });
}

describe('prepareForPortal', () => {
  it('does not drag linked pages into a part', async () => {
    const doc = await PDFDocument.create();
    const pages = [];
    for (let i = 0; i < 6; i += 1) {
      const page = doc.addPage([612, 792]);
      const junk = new Uint8Array(500_000);
      for (let j = 0; j < junk.length; j += 1) junk[j] = (j * 31 + i * 7 + ((j >> 3) ^ (j * 13))) & 255;
      page.node.set(PDFName.of('Junk'), doc.context.register(doc.context.stream(junk)));
      pages.push(page);
    }
    // Every page links to the next one, like a chain of "next page" buttons.
    for (let i = 0; i < 5; i += 1) {
      const link = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 10, 10], Dest: [pages[i + 1].ref, 'Fit'] });
      pages[i].node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(link)]));
    }
    const file = new File([await doc.save({ useObjectStreams: false })], 'linked.pdf', { type: 'application/pdf' });
    const out = await prepareForPortal([file]);
    const total = out.files.reduce((sum, part) => sum + part.size, 0);
    expect(total).toBeLessThan(file.size * 1.1);
    for (const part of out.files) expect(part.size).toBeLessThanOrEqual(PORTAL_MAX_FILE_BYTES);
  });

  it('leaves small files alone', async () => {
    const small = new File([new Uint8Array(1000)], 'a.pdf');
    const out = await prepareForPortal([small]);
    expect(out.files).toEqual([small]);
    expect(out.notes).toEqual([]);
  });

  it('splits a big PDF into parts that all fit, keeping every page', async () => {
    const file = await bigPdf(8, 600_000);
    expect(file.size).toBeGreaterThan(4_000_000);
    const out = await prepareForPortal([file]);
    expect(out.files.length).toBeGreaterThan(2);
    let pages = 0;
    for (const part of out.files) {
      expect(part.size).toBeLessThanOrEqual(PORTAL_MAX_FILE_BYTES);
      pages += (await PDFDocument.load(new Uint8Array(await part.arrayBuffer()))).getPageCount();
    }
    expect(pages).toBe(8);
    expect(out.files[0].name).toMatch(/part 1 of/);
  });

  it('fails cleanly when a single page cannot be recompressed (no canvas outside a browser)', async () => {
    const file = await bigPdf(1, 2_000_000);
    await expect(prepareForPortal([file])).rejects.toThrow();
  });
});
