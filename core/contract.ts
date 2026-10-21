// ─────────────────────────────────────────────────────────────
//  EL CONTRATO (el "zócalo")
//  Cada equipo exporta un objeto con esta forma desde
//  teams/<su-equipo>/index.ts. Nada más.
// ─────────────────────────────────────────────────────────────

import type { FakeData } from "./fake-data";

/** Lo que recibe tu equipo cuando alguien escribe `/twx tu-equipo <texto>` */
export type Input = {
  user: string;     // ID de Slack de quien lo usa (p. ej. "U0123ABC")
  userName: string; // nombre de usuario de Slack
  text: string;     // lo que ha escrito después del nombre del equipo
};

/** Lo que tiene que devolver tu equipo: un texto (admite formato de Slack: *negrita*, _cursiva_, emojis)
 *  y, si quieres, una imagen (una URL pública https://… — por ejemplo un meme de memegen.link) */
export type Output = {
  text: string;
  image?: string;
};

/** Lo que el bot te presta. No puedes usar nada más. */
export type Ctx = {
  /** Pregunta a Claude y devuelve su respuesta en texto */
  claude: (prompt: string, opts?: { system?: string }) => Promise<string>;
  /** Una "libreta" para guardar cosas entre usos (solo la ve tu equipo) */
  store: {
    get: <T = unknown>(key: string) => T | undefined;
    set: (key: string, value: unknown) => void;
  };
  /** Datos inventados de Twenix: empresas y alumnos de mentira */
  fakeData: FakeData;
};

export type Module = {
  /** Una línea que explica qué hace tu invento (sale en /twx ayuda) */
  description: string;
  /** La función que se ejecuta cada vez que alguien usa tu comando */
  handle: (input: Input, ctx: Ctx) => Promise<Output> | Output;
};

// ── Reglas que comprueba el bot ──────────────────────────────
export const TIMEOUT_MS = 20_000;
export const MAX_TEXT = 3_000;
export const RESERVED = ["ayuda", "help", "votar", "resultados", "equipos"];
export const NAME_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;

export function validateModule(mod: unknown): asserts mod is Module {
  const m = mod as Partial<Module> | undefined;
  if (!m || typeof m !== "object") throw new Error("index.ts tiene que hacer `export default { description, handle }`");
  if (typeof m.description !== "string" || !m.description.trim()) throw new Error("falta `description` (un texto)");
  if (typeof m.handle !== "function") throw new Error("falta `handle` (una función)");
}

export function validateOutput(out: unknown): asserts out is Output {
  const o = out as Partial<Output> | undefined;
  if (!o || typeof o !== "object" || typeof o.text !== "string") throw new Error("handle tiene que devolver `{ text: \"...\" }`");
  if (!o.text.trim()) throw new Error("handle ha devuelto un texto vacío");
  if (o.text.length > MAX_TEXT) throw new Error(`el texto es demasiado largo (${o.text.length} > ${MAX_TEXT} caracteres)`);
  if (o.image !== undefined) {
    if (typeof o.image !== "string" || !/^https:\/\/\S+$/.test(o.image)) throw new Error("`image` tiene que ser una URL que empiece por https://");
    if (o.image.length > 2_000) throw new Error("la URL de la imagen es demasiado larga (máx. 2000 caracteres)");
  }
}

export function withTimeout<T>(p: Promise<T> | T, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`ha tardado más de ${ms / 1000} s`)), ms)),
  ]);
}
