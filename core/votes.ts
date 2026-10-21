// Votación: un voto por persona y categoría (se puede cambiar). Recuento con código, sin IA.
import { makeStore } from "./services";

export const CATEGORIES: Record<string, string> = {
  util: "🛠️ Más útil",
  absurdo: "🤡 Más absurdo",
  ia: "🤖 Mejor uso de IA",
};

type Votes = Record<string, Record<string, string>>; // categoria -> userId -> equipo
const store = makeStore("_votos");

export function vote(userId: string, category: string, team: string): void {
  const votes = store.get<Votes>("votos") ?? {};
  (votes[category] ??= {})[userId] = team;
  store.set("votos", votes);
}

export function results(): string {
  const votes = store.get<Votes>("votos") ?? {};
  const lines: string[] = ["*🏆 Resultados*"];
  for (const [cat, label] of Object.entries(CATEGORIES)) {
    const counts: Record<string, number> = {};
    for (const team of Object.values(votes[cat] ?? {})) counts[team] = (counts[team] ?? 0) + 1;
    const ranking = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    lines.push("", `*${label}*`);
    if (!ranking.length) lines.push("_sin votos_");
    ranking.forEach(([team, n], i) => {
      const medal = ["🥇", "🥈", "🥉"][i] ?? "  ";
      lines.push(`${medal} ${team} — ${n} voto${n === 1 ? "" : "s"}`);
    });
  }
  return lines.join("\n");
}
