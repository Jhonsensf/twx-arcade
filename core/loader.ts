// Busca todas las carpetas de teams/ y carga su index.ts.
// Si un equipo tiene un error, se marca como roto pero el bot sigue.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Module, NAME_RE, RESERVED, validateModule } from "./contract";

export const TEAMS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "teams");

export type Team = { name: string; mod?: Module; error?: string };

export async function loadTeams(): Promise<Team[]> {
  const folders = readdirSync(TEAMS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  const teams: Team[] = [];
  for (const name of folders) {
    try {
      if (!NAME_RE.test(name)) throw new Error("el nombre de la carpeta solo puede tener minúsculas, números y guiones (2-30 caracteres)");
      if (RESERVED.includes(name)) throw new Error(`"${name}" es una palabra reservada del bot, elige otro nombre`);
      const file = join(TEAMS_DIR, name, "index.ts");
      if (!existsSync(file)) throw new Error("falta el archivo index.ts");
      const mod = (await import(pathToFileURL(file).href)).default;
      validateModule(mod);
      teams.push({ name, mod });
    } catch (e) {
      teams.push({ name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return teams;
}
