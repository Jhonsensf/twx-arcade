// Decide qué hacer con cada "/twx ...". No sabe nada de Slack: recibe texto y devuelve texto.
import { NO_VOTABLES, type Output, validateOutput, withTimeout } from "./contract";
import type { Team } from "./loader";
import { ctxFor } from "./services";
import { CATEGORIES, results, vote } from "./votes";

export type Reply = Pick<Output, "text" | "image" | "images" | "buttons" | "replace"> & { public: boolean; team?: string };
type User = { id: string; name: string };

export async function route(raw: string, user: User, teams: Team[], channel?: string): Promise<Reply> {
  const [first = "", ...rest] = raw.trim().split(/\s+/);
  const cmd = first.toLowerCase();
  const text = rest.join(" ");

  if (cmd === "" || cmd === "ayuda" || cmd === "help") return { public: false, text: help(teams) };

  if (cmd === "equipos") return { public: true, text: equipos(teams) };

  if (cmd === "votar") return { public: false, text: doVote(user, rest, teams) };

  if (cmd === "yo") return { public: false, text: `Tu ID de Slack es \`${user.id}\`. Añádelo a \`miembros\` en el archivo de tu equipo.` };

  if (cmd === "resultados") {
    const admin = process.env.ADMIN_USER_ID;
    if (admin && user.id !== admin) return { public: false, text: "🤫 Los resultados solo los puede sacar el árbitro." };
    return { public: true, text: results() };
  }

  const team = teams.find((t) => t.name === cmd);
  if (!team) return { public: false, text: `🤔 No conozco el equipo *${cmd}*. Escribe \`/twx ayuda\` para ver los que hay.` };

  const header = `<@${user.id}> → *${team.name}*${text ? `: _${text}_` : ""}`;
  if (!team.mod) return { public: true, text: `${header}\n💥 *${team.name}* no ha arrancado: ${team.error}` };

  try {
    const out = await withTimeout(team.mod.handle({ user: user.id, userName: user.name, text, channel }, ctxFor(team.name)));
    validateOutput(out);
    return { ...out, public: !out.private, replace: false, team: team.name, text: `${header}\n\n${out.text}` };
  } catch (e) {
    console.error(`[${team.name}]`, e);
    return { public: true, text: `${header}\n💥 *${team.name}* ha petado: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Alguien ha pulsado un botón de un equipo: se llama a su `handle` con el `value` del botón. */
export async function routeAction(teamName: string, value: string, user: User, teams: Team[], channel?: string): Promise<Reply> {
  const team = teams.find((t) => t.name === teamName && t.mod);
  if (!team?.mod) return { public: false, text: `🤔 El equipo *${teamName}* ya no está disponible.` };
  try {
    const out = await withTimeout(team.mod.handle({ user: user.id, userName: user.name, text: value, channel, action: true }, ctxFor(team.name)));
    validateOutput(out);
    return { ...out, public: !out.private, team: team.name };
  } catch (e) {
    console.error(`[${team.name}]`, e);
    return { public: false, text: `💥 *${team.name}* ha petado: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function help(teams: Team[]): string {
  const list = teams.length
    ? teams.map((t) => (t.mod ? `• *${t.name}* — ${t.mod.description}` : `• ~${t.name}~ 💥 ${t.error}`)).join("\n")
    : "_Todavía no hay equipos._";
  const cats = Object.keys(CATEGORIES).join(" · ");
  return [
    "*🕹️ Twenix Arcade*",
    "",
    list,
    "",
    "*Cómo se usa:* `/twx <equipo> <lo que quieras>`",
    `*Cómo se vota:* \`/twx votar <categoría> <equipo>\` — categorías: ${cats}`,
    "*Tu ID de Slack:* `/twx yo`  ·  *Lista de equipos en el canal:* `/twx equipos`",
  ].join("\n");
}

function equipos(teams: Team[]): string {
  const participantes = teams.filter((t) => !NO_VOTABLES.includes(t.name));
  if (!participantes.length) return "*🕹️ Equipos*\n_Todavía no hay equipos publicados._";
  const lines = participantes.map((t) => {
    if (!t.mod) return `• ~${t.name}~ 💥 ${t.error}`;
    const miembros = (t.mod.miembros ?? []).map((id) => `<@${id}>`).join(" ");
    return `• *${t.name}* — ${t.mod.description}${miembros ? ` · ${miembros}` : ""}`;
  });
  return [`*🕹️ Equipos (${participantes.length})*`, "", ...lines, "", "Pruébalos con `/twx <equipo> <texto>`"].join("\n");
}

function doVote(user: User, args: string[], teams: Team[]): string {
  const [cat = "", teamName = ""] = args.map((a) => a.toLowerCase());
  if (!CATEGORIES[cat]) return `Categoría no válida. Usa una de estas: ${Object.keys(CATEGORIES).join(" · ")}\nEjemplo: \`/twx votar absurdo piratas\``;
  const team = teams.find((t) => t.name === teamName && t.mod);
  if (!team) return `No hay ningún equipo funcionando que se llame *${teamName || "?"}*. Mira la lista con \`/twx ayuda\`.`;
  if (NO_VOTABLES.includes(team.name)) return `*${team.name}* es solo un ejemplo y no participa en la votación.`;
  if (team.mod?.miembros?.includes(user.id)) return `No puedes votar a tu propio equipo (*${team.name}*).`;
  vote(user.id, cat, team.name);
  return `🗳️ Voto guardado: ${CATEGORIES[cat]} → *${team.name}*. (Si vuelves a votar en esta categoría, se cambia.)`;
}
