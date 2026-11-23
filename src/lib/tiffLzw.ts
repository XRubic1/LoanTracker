/**
 * TIFF LZW decoder (compression 5, MSB-first, "early change" code widths).
 *
 * Replaces UTIF's built-in LZW routine: that one keeps its string table in a fixed 2 MB buffer, which
 * mostly-white scans overflow before the encoder sends a clear code. The picture then decodes correctly
 * for a few rows and turns to garbage. This table is the standard prefix/suffix one (at most 4096 entries).
 *
 * Decodes the strip starting at `off` in `data` into `tgt` from `toff`, stopping at the end-of-information
 * code, the end of the data or the end of `tgt`. Returns the position after the last byte written.
 */
export function decodeTiffLzw(data: Uint8Array, off: number, tgt: Uint8Array, toff: number): number {
  const CLEAR = 256;
  const EOI = 257;
  const prefix = new Uint16Array(4096);
  const suffix = new Uint8Array(4096);
  const first = new Uint8Array(4096);
  const length = new Uint16Array(4096);
  for (let i = 0; i < 256; i += 1) {
    suffix[i] = i;
    first[i] = i;
    length[i] = 1;
  }

  let next = 258;
  let bits = 9;
  let old = -1;
  let buf = 0;
  let have = 0;
  let pos = off;
  let out = toff;

  /** Write the string for `code` at `out`, clipped to the target. */
  const emit = (code: number) => {
    const len = length[code];
    let c = code;
    for (let i = len - 1; i >= 0; i -= 1) {
      if (out + i < tgt.length) tgt[out + i] = suffix[c];
      c = prefix[c];
    }
    out += len;
  };

  for (;;) {
    while (have < bits) {
      if (pos >= data.length) return Math.min(out, tgt.length);
      buf = (buf << 8) | data[pos];
      pos += 1;
      have += 8;
    }
    const code = (buf >>> (have - bits)) & ((1 << bits) - 1);
    have -= bits;
    buf &= (1 << have) - 1;

    if (code === EOI) break;
    if (code === CLEAR) {
      next = 258;
      bits = 9;
      old = -1;
      continue;
    }

    if (old === -1) {
      // First code after a clear is always a literal.
      if (code < 256) emit(code);
      old = code;
      continue;
    }

    // New entry: the previous string plus the first byte of this one. When the code is the entry being
    // defined right now, that first byte is the previous string's own first byte.
    if (next < 4096) {
      prefix[next] = old;
      suffix[next] = first[code < next ? code : old];
      first[next] = first[old];
      length[next] = length[old] + 1;
    }
    if (code <= next) emit(code);
    if (next < 4096) next += 1;
    old = code;

    if (next + 1 >= 1 << bits && bits < 12) bits += 1;
    if (out >= tgt.length) break;
  }
  return Math.min(out, tgt.length);
}
