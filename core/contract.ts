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
  text: string;     // lo que ha escrito después del nombre del equipo (o el `value` del botón pulsado)
  channel?: string; // canal donde se ha usado (para ctx.post)
  action?: boolean; // true si viene de pulsar un botón en vez de escribir
};

/** Un botón bajo el mensaje. Al pulsarlo, se llama a tu `handle` con `text = value` y `action = true`. */
export type Button = { label: string; value: string; style?: "primary" | "danger" };

/** Lo que tiene que devolver tu equipo: un texto (admite formato de Slack: *negrita*, _cursiva_, emojis)
 *  y, si quieres, una imagen (una URL pública https://… — por ejemplo un meme de memegen.link) */
export type Output = {
  text: string;
  image?: string;
  /** Varias imágenes en el mismo mensaje (con título opcional encima de cada una) */
  images?: (string | { url: string; title?: string })[];
  /** true → solo lo ve quien ha usado el comando o pulsado el botón */
  private?: boolean;
  /** Botones bajo el mensaje */
  buttons?: Button[];
  /** Solo al responder a un botón: sustituye el mensaje donde estaba el botón en vez de enviar uno nuevo */
  replace?: boolean;
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
  /** Publica un mensaje en un canal cuando quieras (p. ej. desde un temporizador). Devuelve su id (`ts`) */
  post: (channel: string, out: Output) => Promise<string>;
  /** Edita un mensaje publicado con `post` (p. ej. una cuenta atrás) */
  update: (channel: string, ts: string, out: Output) => Promise<void>;
  /** URL pública y rápida de una imagen de tu carpeta (p. ej. "fotos/gato.jpg"). undefined si el bot no tiene dirección pública */
  fileUrl: (path: string) => string | undefined;
  /** Publica una imagen generada en memoria y devuelve su URL. undefined si el bot no tiene dirección pública */
  hostImage: (data: Uint8Array, type: "image/png" | "image/jpeg") => string | undefined;
};

export type Module = {
  /** Una línea que explica qué hace tu invento (sale en /twx ayuda) */
  description: string;
  /** IDs de Slack de los miembros del equipo (cada uno lo ve con `/twx yo`). No pueden votar a su propio equipo. */
  miembros?: string[];
  /** La función que se ejecuta cada vez que alguien usa tu comando */
  handle: (input: Input, ctx: Ctx) => Promise<Output> | Output;
};

// ── Reglas que comprueba el bot ──────────────────────────────
export const TIMEOUT_MS = 60_000;
export const MAX_TEXT = 3_000;
export const RESERVED = ["ayuda", "help", "votar", "resultados", "equipos", "yo"];
export const NO_VOTABLES = ["ejemplo"];
export const NAME_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;

export function validateModule(mod: unknown): asserts mod is Module {
  const m = mod as Partial<Module> | undefined;
  if (!m || typeof m !== "object") throw new Error("index.ts tiene que hacer `export default { description, handle }`");
  if (typeof m.description !== "string" || !m.description.trim()) throw new Error("falta `description` (un texto)");
  if (typeof m.handle !== "function") throw new Error("falta `handle` (una función)");
  if (m.miembros !== undefined && (!Array.isArray(m.miembros) || m.miembros.some((x) => typeof x !== "string")))
    throw new Error('`miembros` tiene que ser una lista de IDs de Slack, p. ej. ["U0123ABC", "U0456DEF"]');
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
  if (o.images !== undefined) {
    if (!Array.isArray(o.images) || o.images.length > 20) throw new Error("`images` tiene que ser una lista de 20 imágenes como mucho");
    for (const img of o.images) {
      const url = typeof img === "string" ? img : img?.url;
      if (typeof url !== "string" || !/^https:\/\/\S+$/.test(url) || url.length > 2_000) throw new Error("cada imagen de `images` tiene que ser una URL https://");
    }
  }
  if (o.buttons !== undefined) {
    if (!Array.isArray(o.buttons) || o.buttons.length > 25) throw new Error("`buttons` tiene que ser una lista de 25 botones como mucho");
    for (const b of o.buttons)
      if (typeof b?.label !== "string" || !b.label.trim() || b.label.length > 75 || typeof b.value !== "string" || b.value.length > 2_000)
        throw new Error("cada botón necesita `label` (máx. 75 caracteres) y `value` (un texto)");
  }
}

export function withTimeout<T>(p: Promise<T> | T, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`ha tardado más de ${ms / 1000} s`)), ms)),
  ]);
}
