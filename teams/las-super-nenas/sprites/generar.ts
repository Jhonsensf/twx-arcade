// Genera los GIF de la pantalla del Tamagotchi en esta carpeta.
// Uso:  npx tsx teams/las-super-nenas/sprites/generar.ts
// Los sprites son cuadrículas ASCII: "." vacío, "#" tinta, "o" gris. Retocadlos a mano y volved a generar
// (y subid VERSION en index.ts, que Slack y GitHub cachean las imágenes).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SPRITES } from "../index";

const DIR = dirname(fileURLToPath(import.meta.url));
const ESCALA = 6;
const MAX_BYTES = 200 * 1024;

// ── Paleta (índices del GIF) ─────────────────────────────────

const FUERA = 0; // transparente
const LCD = 1;
const TINTA = 2;
const GRIS = 3;
const CARCASA = 4;
const CARCASA_OSCURA = 5;
const BOTON = 6;
const LCD_OSCURA = 7;

const CARCASAS: Record<string, [string, string]> = {
  // Colores de las barras de tx-levels.gif: seed, early, growth, expansion y el rosa del héroe
  huevo: ["#C9E4F8", "#6C98ED"],
  cria: ["#14C4F0", "#0A7FA0"],
  adolescente: ["#4128D5", "#22127F"],
  adulta: ["#20388F", "#0E1A47"],
  leyenda: ["#FF93DE", "#B8468F"],
  muerta: ["#A3A3A3", "#5E5E5E"],
};

function paleta(etapa: string): string[] {
  const [carcasa, oscura] = CARCASAS[etapa];
  return ["#FFFFFF", "#C7D2A8", "#1F2A1A", "#6E7B5C", carcasa, oscura, "#F4E9CF", "#8F9A74"];
}

// ── Lienzo (en píxeles lógicos, antes de escalar) ────────────

const W = 52;
const H = 62;
const PANTALLA = { x: 11, y: 9, w: 30, h: 33 };
const ICONOS_Y = PANTALLA.y + 2;
const ICONOS_X = PANTALLA.x + 2;
const PASO_ICONO = 7;
const MASCOTA = { x: PANTALLA.x + 7, y: PANTALLA.y + 8 };
const CORAZONES_Y = PANTALLA.y + 26;

type Lienzo = Uint8Array;

const nuevoLienzo = (): Lienzo => new Uint8Array(W * H);

function pintar(l: Lienzo, x: number, y: number, color: number, recorte = false) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (recorte && (x < PANTALLA.x || y < PANTALLA.y || x >= PANTALLA.x + PANTALLA.w || y >= PANTALLA.y + PANTALLA.h)) return;
  l[y * W + x] = color;
}

type Sprite = string[];

function validar(nombre: string, s: Sprite) {
  const ancho = s[0].length;
  s.forEach((fila, i) => {
    if (fila.length !== ancho) throw new Error(`sprite "${nombre}": la fila ${i} mide ${fila.length}, no ${ancho}`);
  });
  return s;
}

// "#" usa `tinta`, "o" usa `gris`. Lo que cae fuera de la pantalla se recorta.
function estampar(l: Lienzo, s: Sprite, x: number, y: number, tinta = TINTA, gris = GRIS) {
  s.forEach((fila, dy) => {
    [...fila].forEach((c, dx) => {
      if (c === "#") pintar(l, x + dx, y + dy, tinta, true);
      else if (c === "o") pintar(l, x + dx, y + dy, gris, true);
    });
  });
}

// ── Sprites ──────────────────────────────────────────────────

const S = (nombre: string, filas: string[]) => validar(nombre, filas);

// Las etapas siguen la evolución del GIF de niveles de Twenix (tx-levels.gif de nx-platform):
// maceta con semillas → brote → planta con corbata → persona en la maceta → superhéroe con capa.
const VACIO = "................";

const MACETA_CON_CARA = [
  "..############..",
  "...#........#...",
  "...#..#..#..#...",
  "....#..##..#....",
  "....#......#....",
  ".....######.....",
];

const MACETA = [
  "..############..",
  "...#........#...",
  "...#.oooooo.#...",
  "....#......#....",
  "....#......#....",
  ".....######.....",
];

const HUEVO = S("huevo", [
  ...Array(8).fill(VACIO),
  ".......##.......",
  "...ooo#oo#ooo...",
  ...MACETA_CON_CARA,
]);

const BROTECITO = S("brotecito", [
  ...Array(7).fill(VACIO),
  "......oo#.......",
  ".......##.......",
  "...oooo##oooo...",
  ...MACETA_CON_CARA,
]);

const CRIA = S("cria", [
  VACIO,
  VACIO,
  VACIO,
  VACIO,
  "....##....##....",
  "...#oo#..#oo#...",
  "....##.##.##....",
  ".......##.......",
  ".......##.......",
  "...oooo##oooo...",
  ...MACETA_CON_CARA,
]);

const ADOLESCENTE = S("adolescente", [
  ".....##..##.....",
  "....#oo##oo#....",
  ".....##..##.....",
  "....########....",
  "....###..###....",
  "....#.#..#.#....",
  "....#..##..#....",
  "....#.#..#.#....",
  "...##..##..##...",
  "...#...##...#...",
  ...MACETA,
]);

const ADULTA = S("adulta", [
  ".....######.....",
  "....#oooooo#....",
  "...#........#...",
  "...#.##..##.#...",
  "..##........##..",
  "...#.#....#.#...",
  "...#..####..#...",
  "....##....##....",
  "..###.#..#.###..",
  ".#...#.##.#...#.",
  ...MACETA,
]);

const LEYENDA = S("leyenda", [
  ".....######.....",
  "....#oooooo#....",
  "...#........#...",
  "...#.##..##.#...",
  "...#.#....#.#...",
  "...#..####..#...",
  "....##....##....",
  "o.###.#..#.###.o",
  "oo#..#.##.#..#oo",
  "oo.#.#.##.#.#.oo",
  "ooo.##.##.##.ooo",
  ".oo.#......#.oo.",
  ".oo.########.oo.",
  ".oo..#....#..oo.",
  "..o..#....#..o..",
  ".....##..##.....",
]);

const LAPIDA = S("lapida", [
  "................",
  "................",
  "................",
  "................",
  "....########....",
  "..##........##..",
  ".#............#.",
  ".#............#.",
  ".#............#.",
  ".#............#.",
  ".#............#.",
  ".#............#.",
  ".#............#.",
  ".#............#.",
  "################",
  ".o..o..o..o..o..",
]);

const RIP = S("rip", ["##..#.##.", "#.#.#.#.#", "##..#.##.", "#.#.#.#..", "#.#.#.#.."]);

const FANTASMA = S("fantasma", [".ooo.", "o#o#o", "ooooo", "ooooo", "o.o.o"]);

const COMIDA = [
  S("comida0", ["..###..", ".#####.", ".#####.", "..###..", "...#...", "..#.#.."]),
  S("comida1", ["..##...", ".###...", ".####..", "..###..", "...#...", "..#.#.."]),
  S("comida2", ["..#....", ".#.....", ".##....", "..##...", "...#...", "..#.#.."]),
  S("comida3", [".......", ".......", ".......", "...o...", "...#...", "..#.#.."]),
];
const MIGAS = S("migas", ["o.o", ".o.", "o.."]);
const PATITO = S("patito", [".##....", "###o...", ".##..#.", "######.", ".####.."]);
const GOTA = S("gota", ["o", "o"]);
const MANO = S("mano", ["..ooo..", ".ooooo.", "ooooooo", "o.o.o.o", "o.o.o.o"]);
const MINI_CORAZON = S("mini-corazon", ["#.#", "###", ".#."]);
const PELOTA = S("pelota", [".##.", "#o##", "##o#", ".##."]);
const BURBUJA = S("burbuja", [".o.", "o.o", ".o."]);
const ZETA = S("zeta", ["####", "..#.", ".#..", "####"]);
const ZETA_PEQUE = S("zeta-peque", ["###", ".#.", "###"]);
const SUDOR = S("sudor", [".o", "oo", "oo"]);
const NUBE = S("nube", [".oo.oo.", "ooooooo", ".ooooo."]);
const EXCLAMACION = S("exclamacion", ["##", "##", "##", "..", "##"]);
const BRILLO = S("brillo", [".#.", "#o#", ".#."]);

const CORAZON = S("corazon", [".#.#.", "#####", "#####", ".###.", "..#.."]);
const CALAVERA = S("calavera", [".###.", "#####", "#.#.#", "#####", ".#.#."]);

const ICONOS = [
  S("icono-comer", ["...#.", ".##..", "#####", "#####", ".###."]),
  S("icono-jugar", [".###.", "#.#.#", "#####", "#.#.#", ".###."]),
  S("icono-banar", ["..#..", ".###.", ".###.", "#####", ".###."]),
  S("icono-dormir", [".###.", "##...", "#....", "##...", ".###."]),
];

// El reposo de la semilla (huevo) es especial: lo sobrescribe "huevo-reposo" en especiales()
const MASCOTAS: Record<string, Sprite> = { huevo: HUEVO, cria: CRIA, adolescente: ADOLESCENTE, adulta: ADULTA, leyenda: LEYENDA };

// ── Composición de un fotograma ──────────────────────────────

type Capa = { sprite: Sprite; x: number; y: number };

type Fotograma = {
  mascota?: Sprite;
  dx?: number;
  dy?: number;
  capas?: Capa[];
  icono?: number; // índice del icono activo
  corazones: number | "calavera";
  oscura?: boolean;
  ms?: number;
};

function enElipse(x: number, y: number) {
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  return ((x - cx) / (W / 2 - 0.5)) ** 2 + ((y - cy) / (H / 2 - 0.5)) ** 2 <= 1;
}

function carcasa(l: Lienzo) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!enElipse(x, y)) continue;
      const borde = !enElipse(x - 1, y) || !enElipse(x + 1, y) || !enElipse(x, y - 1) || !enElipse(x, y + 1);
      pintar(l, x, y, borde ? CARCASA_OSCURA : CARCASA);
    }
  }
  for (const [x, y] of [[14, 6], [12, 7], [11, 8], [15, 5]]) pintar(l, x, y, BOTON); // brillo de la carcasa

  const { x, y, w, h } = PANTALLA;
  for (let j = y - 1; j <= y + h; j++) {
    for (let i = x - 1; i <= x + w; i++) {
      const esquina = (i === x - 1 || i === x + w) && (j === y - 1 || j === y + h);
      if (!esquina) pintar(l, i, j, CARCASA_OSCURA);
    }
  }

  for (const bx of [W / 2 - 9, W / 2, W / 2 + 9]) {
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        if (i * i + j * j > 5) continue;
        pintar(l, Math.floor(bx) + i, 51 + j, i * i + j * j > 2 ? CARCASA_OSCURA : BOTON);
      }
    }
  }
}

function pantalla(l: Lienzo, f: Fotograma) {
  const { x, y, w, h } = PANTALLA;
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) pintar(l, i, j, f.oscura ? LCD_OSCURA : LCD);

  ICONOS.forEach((icono, i) => {
    const color = f.icono === i ? TINTA : GRIS;
    estampar(l, icono, ICONOS_X + i * PASO_ICONO, ICONOS_Y, color, color);
  });

  if (f.mascota) estampar(l, f.mascota, MASCOTA.x + (f.dx ?? 0), MASCOTA.y + (f.dy ?? 0));
  for (const c of f.capas ?? []) estampar(l, c.sprite, c.x, c.y);

  if (f.corazones === "calavera") {
    estampar(l, CALAVERA, PANTALLA.x + 12, CORAZONES_Y);
  } else {
    for (let i = 0; i < 4; i++) {
      const lleno = i < f.corazones;
      estampar(l, CORAZON, ICONOS_X + i * PASO_ICONO, CORAZONES_Y, lleno ? TINTA : GRIS, lleno ? TINTA : GRIS);
    }
  }
}

function componer(f: Fotograma): Lienzo {
  const l = nuevoLienzo();
  carcasa(l);
  pantalla(l, f);
  return l;
}

function escalar(l: Lienzo): Uint8Array {
  const out = new Uint8Array(W * ESCALA * H * ESCALA);
  for (let y = 0; y < H * ESCALA; y++) {
    for (let x = 0; x < W * ESCALA; x++) out[y * W * ESCALA + x] = l[Math.floor(y / ESCALA) * W + Math.floor(x / ESCALA)];
  }
  return out;
}

// ── Codificador GIF89a ───────────────────────────────────────

const BITS_COLOR = 3; // paleta de 8 colores

function lzw(indices: Uint8Array): number[] {
  const clear = 1 << BITS_COLOR;
  const fin = clear + 1;
  const bytes: number[] = [];
  let acumulado = 0;
  let bitsAcumulados = 0;
  let tamCodigo = BITS_COLOR + 1;
  let siguiente = fin + 1;
  let tabla = new Map<number, number>();

  const emitir = (codigo: number) => {
    acumulado |= codigo << bitsAcumulados;
    bitsAcumulados += tamCodigo;
    while (bitsAcumulados >= 8) {
      bytes.push(acumulado & 0xff);
      acumulado >>= 8;
      bitsAcumulados -= 8;
    }
  };

  emitir(clear);
  let prefijo = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const clave = (prefijo << 8) | k;
    const codigo = tabla.get(clave);
    if (codigo !== undefined) {
      prefijo = codigo;
      continue;
    }
    emitir(prefijo);
    if (siguiente === 4096) {
      emitir(clear);
      tabla = new Map();
      siguiente = fin + 1;
      tamCodigo = BITS_COLOR + 1;
    } else {
      if (siguiente >= 1 << tamCodigo) tamCodigo++;
      tabla.set(clave, siguiente++);
    }
    prefijo = k;
  }
  emitir(prefijo);
  emitir(fin);
  if (bitsAcumulados > 0) bytes.push(acumulado & 0xff);
  return bytes;
}

const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];

function gif(fotogramas: Fotograma[], colores: string[]): Buffer {
  const ancho = W * ESCALA;
  const alto = H * ESCALA;
  const out: number[] = [];
  out.push(...Buffer.from("GIF89a"), ...u16(ancho), ...u16(alto), 0xf0 | (BITS_COLOR - 1), 0, 0);
  for (const c of colores) out.push(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16));
  out.push(0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0"), 0x03, 0x01, ...u16(0), 0x00);

  for (const f of fotogramas) {
    const centesimas = Math.round((f.ms ?? 400) / 10);
    out.push(0x21, 0xf9, 0x04, (2 << 2) | 1, ...u16(centesimas), FUERA, 0x00);
    out.push(0x2c, ...u16(0), ...u16(0), ...u16(ancho), ...u16(alto), 0x00, BITS_COLOR);
    const datos = lzw(escalar(componer(f)));
    for (let i = 0; i < datos.length; i += 255) {
      const bloque = datos.slice(i, i + 255);
      out.push(bloque.length, ...bloque);
    }
    out.push(0x00);
  }
  out.push(0x3b);
  return Buffer.from(out);
}

// ── Animaciones ──────────────────────────────────────────────

const M = MASCOTA;

function brillos(i: number): Capa[] {
  const sitios = [
    { sprite: BRILLO, x: M.x - 5, y: M.y + 1 },
    { sprite: BRILLO, x: M.x + 18, y: M.y + 4 },
    { sprite: BRILLO, x: M.x - 4, y: M.y + 11 },
  ];
  return sitios.filter((_, j) => (i + j) % 2 === 0);
}

type Animacion = (m: Sprite) => Fotograma[];

const cabeza = (m: Sprite) => m.findIndex((fila) => fila.trim().replace(/\./g, "") !== "");

const ANIMACIONES: Record<string, Animacion> = {
  reposo: (m) => [
    { mascota: m, dy: 0, corazones: 4 },
    { mascota: m, dy: -1, corazones: 4 },
  ],
  regular: (m) => [
    { mascota: m, dy: 0, corazones: 3, ms: 500 },
    { mascota: m, dy: -1, corazones: 3, ms: 500 },
  ],
  quejica: (m) => [
    { mascota: m, corazones: 1, capas: [{ sprite: SUDOR, x: M.x + 15, y: M.y + 4 }], ms: 500 },
    { mascota: m, dy: 1, corazones: 1, capas: [{ sprite: SUDOR, x: M.x + 15, y: M.y + 6 }, { sprite: NUBE, x: M.x + 12, y: M.y - 1 }], ms: 500 },
  ],
  agonizando: (m) => [
    { mascota: m, dx: -1, corazones: "calavera", ms: 300 },
    { corazones: "calavera", ms: 200 },
    { mascota: m, dx: 1, dy: 1, corazones: "calavera", ms: 300 },
    { corazones: "calavera", ms: 200 },
  ],
  // Se acerca a la comida en cada mordisco y caen migas
  comer: (m) =>
    COMIDA.map((comida, i) => ({
      mascota: m,
      dx: i % 2 ? 1 : 0,
      icono: 0,
      corazones: i === 3 ? 4 : 3,
      capas: [
        { sprite: comida, x: M.x + 16, y: M.y + 8 },
        ...(i > 0 ? [{ sprite: MIGAS, x: M.x + 15, y: M.y + 14 }] : []),
      ],
    })),
  // La pelota describe un arco por encima y la mascota salta para alcanzarla
  jugar: (m) =>
    [
      { bx: M.x - 6, by: M.y + 10, dy: 0 },
      { bx: M.x - 2, by: M.y - 1, dy: -2 },
      { bx: M.x + 14, by: M.y - 1, dy: -2 },
      { bx: M.x + 18, by: M.y + 10, dy: 0 },
    ].map((p, i) => ({
      mascota: m,
      dy: p.dy,
      icono: 1,
      corazones: i < 2 ? 3 : 4,
      ms: 300,
      capas: [{ sprite: PELOTA, x: p.bx, y: p.by }],
    })),
  // Ducha de gotas, burbujas que suben y un patito que se balancea
  banar: (m) =>
    [0, 1, 2, 3].map((i) => ({
      mascota: m,
      dx: i % 2,
      icono: 2,
      corazones: i < 2 ? 3 : 4,
      ms: 300,
      capas: [
        ...[1, 5, 10, 14].map((x, k) => ({ sprite: GOTA, x: M.x + x, y: M.y - 1 + ((i * 3 + k * 5) % 9) })),
        { sprite: BURBUJA, x: M.x - 4, y: M.y + 12 - i * 3 },
        { sprite: BURBUJA, x: M.x + 17, y: M.y + 9 - i * 2 },
        { sprite: PATITO, x: M.x - 6, y: M.y + 11 - (i % 2) },
      ],
    })),
  // Una mano le acaricia la cabeza y van saliendo corazones
  acariciar: (m) =>
    [0, 1, 2, 3].map((i) => ({
      mascota: m,
      dy: i % 2,
      corazones: i < 2 ? 3 : 4,
      capas: [
        { sprite: MANO, x: M.x + 4, y: M.y + cabeza(m) - (i % 2 ? 4 : 6) },
        { sprite: MINI_CORAZON, x: M.x + 15, y: M.y + 8 - i * 2 },
        ...(i > 1 ? [{ sprite: MINI_CORAZON, x: M.x - 3, y: M.y + 10 - (i - 2) * 3 }] : []),
      ],
    })),
  dormir: (m) =>
    [0, 1, 2].map((i) => ({
      mascota: m,
      dy: i === 1 ? 1 : 0,
      icono: 3,
      oscura: true,
      corazones: i === 2 ? 4 : 3,
      ms: 500,
      capas: [
        { sprite: ZETA_PEQUE, x: M.x + 15, y: M.y + 8 - i * 2 },
        ...(i > 0 ? [{ sprite: ZETA, x: M.x + 17, y: M.y + 3 - i }] : []),
      ],
    })),
  turno: (m) => [
    { mascota: m, dx: -1, corazones: 3, capas: [{ sprite: EXCLAMACION, x: M.x + 16, y: M.y }], ms: 300 },
    { mascota: m, dx: 1, corazones: 3, ms: 300 },
    { mascota: m, dx: -1, corazones: 3, capas: [{ sprite: EXCLAMACION, x: M.x + 16, y: M.y }], ms: 300 },
    { mascota: m, dx: 1, corazones: 3, ms: 600 },
  ],
};

function especiales(): Record<string, { carcasa: string; fotogramas: Fotograma[] }> {
  return {
    "huevo-reposo": {
      carcasa: "huevo",
      fotogramas: [
        { mascota: HUEVO, dx: -1, corazones: 4, ms: 300 },
        { mascota: HUEVO, dx: 1, corazones: 4, ms: 300 },
        { mascota: HUEVO, dx: -1, corazones: 4, ms: 300 },
        { mascota: HUEVO, corazones: 4, ms: 800 },
      ],
    },
    "huevo-eclosion": {
      carcasa: "cria",
      fotogramas: [
        { mascota: HUEVO, dx: -1, corazones: 4, ms: 300 },
        { mascota: HUEVO, dx: 1, corazones: 4, ms: 300 },
        { mascota: BROTECITO, corazones: 4, capas: [{ sprite: BRILLO, x: M.x - 4, y: M.y + 4 }], ms: 500 },
        { mascota: CRIA, corazones: 4, capas: brillos(0), ms: 900 },
      ],
    },
    muerta: {
      carcasa: "muerta",
      fotogramas: [0, 1, 2, 3].map((i) => ({
        mascota: LAPIDA,
        corazones: "calavera" as const,
        ms: 500,
        capas: [
          { sprite: RIP, x: M.x + 3, y: M.y + 8 },
          { sprite: FANTASMA, x: M.x + 10 + (i % 2), y: M.y + 5 - i * 2 },
        ],
      })),
    },
  };
}

// ── Generación ───────────────────────────────────────────────

const generados = new Map<string, Buffer>();

for (const [etapa, sprite] of Object.entries(MASCOTAS)) {
  for (const [estado, animar] of Object.entries(ANIMACIONES)) {
    const fotogramas = animar(sprite).map((f, i) =>
      etapa === "leyenda" ? { ...f, capas: [...(f.capas ?? []), ...brillos(i)] } : f,
    );
    generados.set(`${etapa}-${estado}`, gif(fotogramas, paleta(etapa)));
  }
}
for (const [nombre, e] of Object.entries(especiales())) generados.set(nombre, gif(e.fotogramas, paleta(e.carcasa)));

const faltan = SPRITES.filter((s) => !generados.has(s));
const sobran = [...generados.keys()].filter((s) => !SPRITES.includes(s));
if (faltan.length || sobran.length) {
  throw new Error(`SPRITES en index.ts no coincide con lo generado. Faltan: [${faltan}] · Sobran: [${sobran}]`);
}

for (const [nombre, datos] of generados) {
  if (datos.length > MAX_BYTES) throw new Error(`${nombre}.gif pesa ${datos.length} bytes (máx. ${MAX_BYTES})`);
  writeFileSync(join(DIR, `${nombre}.gif`), datos);
  console.log(`${nombre}.gif`.padEnd(26), `${(datos.length / 1024).toFixed(1)} KB`);
}
