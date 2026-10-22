// Compone en una sola imagen PNG las cartas que se votan (A, B, C…), sin librerías:
// las cartas están ya "desempaquetadas" en teselas/ (píxeles RGB en crudo, comprimidos con gzip)
// y aquí solo se copian en un lienzo y se empaqueta el PNG con zlib (incluido en Node).
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { deflate, gunzip } from "node:zlib";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "teselas");
const TW = 180; // ancho de carta
const TH = 260; // alto de carta
const LH = 44; // alto de la franja con la letra
const PAD = 7;
const FONDO = [0x1a, 0x1d, 0x21];
const LETRAS = "ABCDEFGHIJKL";

const gunzipAsync = promisify(gunzip);
const deflateAsync = promisify(deflate);
const cache = new Map<string, Promise<Buffer>>();
const tesela = (nombre: string) => {
  let t = cache.get(nombre);
  if (!t) cache.set(nombre, (t = readFile(join(DIR, `${nombre}.rgb.gz`)).then((b) => gunzipAsync(b))));
  return t;
};

/** PNG con las cartas en filas de `porFila`, cada una con su letra debajo. */
export async function componerMesa(cartas: number[], porFila = 6): Promise<Buffer> {
  const n = cartas.length;
  const cols = Math.min(n, porFila);
  const filas = Math.ceil(n / porFila);
  const cw = TW + 2 * PAD;
  const ch = TH + LH + 2 * PAD;
  const W = cols * cw + 2 * PAD;
  const H = filas * ch + 2 * PAD;
  const stride = W * 3 + 1; // +1: byte de filtro PNG al principio de cada fila

  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw.set(FONDO, y * stride + 1 + x * 3);

  const [imgs, letras] = await Promise.all([
    Promise.all(cartas.map((c) => tesela(`carta_${String(c).padStart(2, "0")}`))),
    Promise.all(cartas.map((_, i) => tesela(`letra_${LETRAS[i]}`))),
  ]);
  const pegar = (src: Buffer, w: number, h: number, x0: number, y0: number) => {
    for (let r = 0; r < h; r++) src.copy(raw, (y0 + r) * stride + 1 + x0 * 3, r * w * 3, (r + 1) * w * 3);
  };
  cartas.forEach((_, i) => {
    const fila = Math.floor(i / cols);
    const enFila = Math.min(cols, n - fila * cols);
    const centrado = ((cols - enFila) * cw) / 2; // la última fila, centrada
    const x0 = Math.round(PAD + centrado + (i % cols) * cw + PAD);
    const y0 = PAD + fila * ch + PAD;
    pegar(imgs[i], TW, TH, x0, y0);
    pegar(letras[i], TW, LH, x0, y0 + TH);
  });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await deflateAsync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tipo: string, datos: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
