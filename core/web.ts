// Mini servidor web para que Slack descargue imágenes rápido desde el propio bot
// (en vez de desde GitHub): archivos de la carpeta de cada equipo e imágenes generadas al vuelo.
// Solo se activa si hay dirección pública: PUBLIC_URL, o RAILWAY_PUBLIC_DOMAIN (Railway → Settings → Generate Domain).
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { TEAMS_DIR } from "./loader";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
const MAX_BLOBS = 300;
const blobs = new Map<string, { type: string; data: Uint8Array }>();

export function publicBase(): string | undefined {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return undefined;
}

let running = false;

/** URL pública de una imagen de la carpeta del equipo (p. ej. "cartas/carta_01.jpg"), o undefined si no hay servidor. */
export function fileUrl(team: string, path: string): string | undefined {
  const base = publicBase();
  if (!running || !base || !TYPES[extname(path).toLowerCase()]) return undefined;
  return `${base}/f/${team}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Publica una imagen generada en memoria y devuelve su URL, o undefined si no hay servidor. */
export function hostImage(data: Uint8Array, type: "image/png" | "image/jpeg"): string | undefined {
  const base = publicBase();
  if (!running || !base) return undefined;
  const id = randomUUID();
  blobs.set(id, { type, data });
  while (blobs.size > MAX_BLOBS) blobs.delete(blobs.keys().next().value!);
  return `${base}/m/${id}${type === "image/png" ? ".png" : ".jpg"}`;
}

export function startWeb() {
  const port = Number(process.env.PORT);
  if (!port || !publicBase()) {
    console.log("🖼️  Sin dirección pública: las imágenes se sirven desde GitHub (pon PUBLIC_URL o genera un dominio en Railway).");
    return;
  }
  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    try {
      if (url.pathname.startsWith("/m/")) {
        const blob = blobs.get(url.pathname.slice(3).replace(/\.\w+$/, ""));
        if (!blob) return void res.writeHead(404).end();
        res.writeHead(200, { "content-type": blob.type, "cache-control": "public, max-age=86400" });
        return void res.end(blob.data);
      }
      if (url.pathname.startsWith("/f/")) {
        const rel = normalize(decodeURIComponent(url.pathname.slice(3)));
        const file = join(TEAMS_DIR, rel);
        const type = TYPES[extname(file).toLowerCase()];
        if (!type || rel.startsWith("..") || !file.startsWith(TEAMS_DIR + sep)) return void res.writeHead(404).end();
        const data = await readFile(file);
        res.writeHead(200, { "content-type": type, "cache-control": "public, max-age=86400" });
        return void res.end(data);
      }
      res.writeHead(200, { "content-type": "text/plain" }).end("🕹️ Twenix Arcade");
    } catch {
      res.writeHead(404).end();
    }
  }).listen(port, () => {
    running = true;
    console.log(`🖼️  Imágenes servidas desde ${publicBase()}`);
  });
}
