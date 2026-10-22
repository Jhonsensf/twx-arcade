// Lo que el bot "presta" a cada equipo: Claude y una libreta.
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Ctx, validateOutput } from "./contract";
import { fakeData } from "./fake-data";
import { fileUrl, hostImage } from "./web";

// ── Claude ───────────────────────────────────────────────────
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5";
let client: Anthropic | null = null;

export async function claude(prompt: string, opts: { system?: string } = {}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "(Claude no está configurado: falta ANTHROPIC_API_KEY)";
  client ??= new Anthropic();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
}

// ── Libreta (se guarda en data/store.json) ───────────────────
const DATA_DIR = process.env.DATA_DIR || "data";
const FILE = join(DATA_DIR, "store.json");
let db: Record<string, Record<string, unknown>> = {};
try {
  if (existsSync(FILE)) db = JSON.parse(readFileSync(FILE, "utf8"));
} catch {
  db = {};
}

export function makeStore(namespace: string): Ctx["store"] {
  return {
    get: <T>(key: string) => db[namespace]?.[key] as T | undefined,
    set: (key, value) => {
      (db[namespace] ??= {})[key] = value;
      saveSoon();
    },
  };
}

// Guardar en disco sin bloquear el bot: como mucho una escritura cada 300 ms, aunque haya muchos clics a la vez.
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> = Promise.resolve();
function saveSoon() {
  saveTimer ??= setTimeout(() => {
    saveTimer = undefined;
    const json = JSON.stringify(db);
    saving = saving
      .then(() => mkdirSync(DATA_DIR, { recursive: true }))
      .then(() => writeFile(FILE, json))
      .catch((e) => console.error("No he podido guardar la libreta:", e));
  }, 300);
  saveTimer.unref?.();
}
// Si el proceso termina con una escritura pendiente (p. ej. npm run probar), se guarda antes de salir.
process.on("beforeExit", () => {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(db));
  } catch (e) {
    console.error("No he podido guardar la libreta:", e);
  }
});

// ── Publicar y editar mensajes por iniciativa propia ─────────
// En Slack lo conecta bot.ts. Sin Slack (npm run probar / npm test) se escribe en la consola.
type Out = Parameters<Ctx["post"]>[1];
export type Poster = {
  post: (team: string, channel: string, out: Out) => Promise<string>;
  update: (team: string, channel: string, ts: string, out: Out) => Promise<void>;
};
let poster: Poster = {
  post: async (_team, channel, out) => {
    console.log(`\n[post en ${channel}]\n${out.text}${describe(out)}`);
    return String(Date.now());
  },
  update: async (_team, channel, ts, out) => console.log(`\n[edita ${ts} en ${channel}]\n${out.text}${describe(out)}`),
};
export function setPoster(p: Poster) {
  poster = p;
}
function describe(out: Out): string {
  const imgs = [...(out.image ? [out.image] : []), ...(out.images ?? [])].map((i) => (typeof i === "string" ? i : `${i.title ?? ""} ${i.url}`));
  return [...imgs.map((i) => `\n🖼️  ${i}`), ...(out.buttons ?? []).map((b) => `\n🔘 [${b.label}] → ${b.value}`)].join("");
}

export function ctxFor(team: string): Ctx {
  return {
    claude,
    store: makeStore(team),
    fakeData,
    fileUrl: (path) => fileUrl(team, path),
    hostImage,
    post: async (channel, out) => {
      validateOutput(out);
      return poster.post(team, channel, out);
    },
    update: async (channel, ts, out) => {
      validateOutput(out);
      await poster.update(team, channel, ts, out);
    },
  };
}
