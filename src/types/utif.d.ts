declare module 'utif' {
  interface Ifd {
    width: number;
    height: number;
    [key: string]: unknown;
  }
  const UTIF: {
    decode: ((buffer: ArrayBuffer) => Ifd[]) & {
      /** UTIF's LZW routine; replaced with ours (see lib/tiffLzw.ts). */
      _decodeLZW: (data: Uint8Array, off: number, tgt: Uint8Array, toff: number) => void;
    };
    decodeImage(buffer: ArrayBuffer, ifd: Ifd): void;
    toRGBA8(ifd: Ifd): Uint8Array;
  };
  export default UTIF;
}
