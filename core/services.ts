// Lo que el bot "presta" a cada equipo: Claude y una libreta.
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Ctx } from "./contract";
import { fakeData } from "./fake-data";

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
      try {
        mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(FILE, JSON.stringify(db, null, 2));
      } catch (e) {
        console.error("No he podido guardar la libreta:", e);
      }
    },
  };
}

export function ctxFor(team: string): Ctx {
  return { claude, store: makeStore(team), fakeData };
}
