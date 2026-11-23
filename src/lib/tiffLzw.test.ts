import { describe, expect, it } from 'vitest';
import { decodeTiffLzw } from '@/lib/tiffLzw';

/** Minimal TIFF-style LZW encoder (MSB first, early change) used only to round-trip the decoder. */
function encode(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let buf = 0;
  let have = 0;
  let bits = 9;
  const put = (code: number) => {
    buf = (buf << bits) | code;
    have += bits;
    while (have >= 8) {
      out.push((buf >>> (have - 8)) & 255);
      have -= 8;
    }
    buf &= (1 << have) - 1;
  };
  let table = new Map<string, number>();
  let next = 258;
  put(256);
  let cur = '';
  for (const byte of input) {
    const key = cur + String.fromCharCode(byte);
    if (key.length === 1 || table.has(key)) {
      cur = key;
      continue;
    }
    put(cur.length === 1 ? cur.charCodeAt(0) : table.get(cur)!);
    table.set(key, next);
    next += 1;
    if (next + 1 > 1 << bits && bits < 12) bits += 1;
    if (next >= 4094) {
      put(256);
      table = new Map();
      next = 258;
      bits = 9;
    }
    cur = String.fromCharCode(byte);
  }
  if (cur) put(cur.length === 1 ? cur.charCodeAt(0) : table.get(cur)!);
  put(257);
  if (have > 0) out.push((buf << (8 - have)) & 255);
  return Uint8Array.from(out);
}

describe('decodeTiffLzw', () => {
  it('round-trips a mostly-white page with a few dark marks', () => {
    const page = new Uint8Array(1200 * 400);
    for (let i = 0; i < page.length; i += 997) page[i] = 255;
    const out = new Uint8Array(page.length);
    decodeTiffLzw(encode(page), 0, out, 0);
    expect(out).toEqual(page);
  });

  it('round-trips noisy data across clear codes', () => {
    const noisy = new Uint8Array(60_000);
    let seed = 7;
    for (let i = 0; i < noisy.length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noisy[i] = (seed >> 16) & 15;
    }
    const out = new Uint8Array(noisy.length);
    decodeTiffLzw(encode(noisy), 0, out, 0);
    expect(out).toEqual(noisy);
  });
});
