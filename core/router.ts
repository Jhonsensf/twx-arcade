// Decide qué hacer con cada "/twx ...". No sabe nada de Slack: recibe texto y devuelve texto.
import { validateOutput, withTimeout } from "./contract";
import type { Team } from "./loader";
import { ctxFor } from "./services";
import { CATEGORIES, results, vote } from "./votes";

export type Reply = { text: string; public: boolean };
type User = { id: string; name: string };

export async function route(raw: string, user: User, teams: Team[]): Promise<Reply> {
  const [first = "", ...rest] = raw.trim().split(/\s+/);
  const cmd = first.toLowerCase();
  const text = rest.join(" ");

  if (cmd === "" || cmd === "ayuda" || cmd === "help" || cmd === "equipos") return { public: false, text: help(teams) };

  if (cmd === "votar") return { public: false, text: doVote(user, rest, teams) };

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
    const out = await withTimeout(team.mod.handle({ user: user.id, userName: user.name, text }, ctxFor(team.name)));
    validateOutput(out);
    return { public: true, text: `${header}\n\n${out.text}` };
  } catch (e) {
    console.error(`[${team.name}]`, e);
    return { public: true, text: `${header}\n💥 *${team.name}* ha petado: ${e instanceof Error ? e.message : String(e)}` };
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
  ].join("\n");
}

function doVote(user: User, args: string[], teams: Team[]): string {
  const [cat = "", teamName = ""] = args.map((a) => a.toLowerCase());
  if (!CATEGORIES[cat]) return `Categoría no válida. Usa una de estas: ${Object.keys(CATEGORIES).join(" · ")}\nEjemplo: \`/twx votar absurdo piratas\``;
  const team = teams.find((t) => t.name === teamName && t.mod);
  if (!team) return `No hay ningún equipo funcionando que se llame *${teamName || "?"}*. Mira la lista con \`/twx ayuda\`.`;
  vote(user.id, cat, team.name);
  return `🗳️ Voto guardado: ${CATEGORIES[cat]} → *${team.name}*. (Si vuelves a votar en esta categoría, se cambia.)`;
}
