// EJEMPLO AVANZADO: memes. La carpeta empieza por "_" → el bot NO la carga.
// Para usarlo como punto de partida:  cp -r teams/_memes teams/<vuestro-equipo>
//
// Uso en Slack:
//   /twx memes <tema>       → genera un meme sobre ese tema
//   /twx memes otra vez     → rehace tu último meme con otra plantilla
//   /twx memes historial    → los últimos 5 memes de la sala
//
// Cómo funciona:
//   1. Claude elige plantilla y escribe los textos → devuelve JSON
//   2. El código lo valida (plantilla permitida, textos cortos). Si falla, plan B.
//   3. El código construye la URL de memegen.link escapando bien el texto
//   4. Se guarda en la libreta para "otra vez" e "historial"
import type { Module } from "../../core/contract";

// Plantillas permitidas (id de memegen.link → cuándo usarla)
const PLANTILLAS: Record<string, string> = {
  drake: "rechazar una cosa (arriba) y preferir otra (abajo)",
  fine: "todo está ardiendo pero hacemos como que no pasa nada",
  cmm: "una opinión polémica que retas a rebatir",
  rollsafe: "una 'solución' absurdamente lista",
  mordor: "algo que parece fácil pero no lo es ('No se puede simplemente…')",
  buzz: "algo que está en todas partes ('X, X por todas partes')",
  success: "un pequeño triunfo cotidiano",
};
const IDS = Object.keys(PLANTILLAS);

type Meme = { tema: string; plantilla: string; arriba: string; abajo: string; autor: string };

// memegen.link usa reglas propias para los caracteres especiales en la URL
function escapar(texto: string): string {
  if (!texto.trim()) return "_";
  const t = texto
    .replace(/_/g, "__")
    .replace(/-/g, "--")
    .replace(/ /g, "_")
    .replace(/\?/g, "~q")
    .replace(/&/g, "~a")
    .replace(/%/g, "~p")
    .replace(/#/g, "~h")
    .replace(/\//g, "~s")
    .replace(/\\/g, "~b")
    .replace(/</g, "~l")
    .replace(/>/g, "~g")
    .replace(/"/g, "''")
    .replace(/\n/g, "~n");
  return encodeURIComponent(t).replace(/%7E/gi, "~").replace(/'/g, "%27");
}

function urlMeme(m: Meme): string {
  return `https://api.memegen.link/images/${m.plantilla}/${escapar(m.arriba)}/${escapar(m.abajo)}.png`;
}

function corto(s: unknown, max = 80): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export default {
  description: "Genera memes · /twx memes <tema> · /twx memes otra vez · /twx memes historial",

  async handle(input, ctx) {
    const texto = input.text.trim();
    const claveUltimo = `ultimo:${input.user}`;
    const historial = ctx.store.get<Meme[]>("historial") ?? [];

    // ── Historial ────────────────────────────────────────
    if (texto.toLowerCase() === "historial") {
      if (!historial.length) return { text: "Aún no hay memes. Crea uno con `/twx memes <tema>`" };
      const lineas = historial.slice(-5).reverse().map((m) => `• *${m.autor}* — ${m.tema} → <${urlMeme(m)}|ver meme>`);
      return { text: "🗂️ *Últimos memes*\n" + lineas.join("\n") };
    }

    // ── Otra vez (misma idea, otra plantilla) ───────────
    let tema = texto;
    let evitar: string | undefined;
    if (texto.toLowerCase() === "otra vez") {
      const ultimo = ctx.store.get<Meme>(claveUltimo);
      if (!ultimo) return { text: "No tienes ningún meme anterior. Prueba `/twx memes el deploy del viernes`" };
      tema = ultimo.tema;
      evitar = ultimo.plantilla;
    }
    if (!tema) return { text: "Dime el tema: `/twx memes el café de la oficina`" };

    // ── 1. Claude elige plantilla y textos (JSON) ───────
    const opciones = IDS.filter((id) => id !== evitar);
    const raw = await ctx.claude(`Tema del meme: ${tema}`, {
      system:
        "Eres un creador de memes para un equipo de tecnología de una empresa de idiomas. " +
        "Humor blanco de oficina: nunca te burles de personas concretas, ni temas ofensivos. " +
        "Elige UNA plantilla de esta lista y escribe el texto de arriba y de abajo, en español, máximo 60 caracteres cada uno.\n" +
        opciones.map((id) => `- ${id}: ${PLANTILLAS[id]}`).join("\n") +
        '\nResponde SOLO con JSON: {"plantilla": "id", "arriba": "...", "abajo": "..."}',
    });

    // ── 2. Validar (y plan B si Claude se lía) ──────────
    let meme: Meme;
    try {
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      if (!opciones.includes(j.plantilla)) throw new Error("plantilla no permitida");
      meme = { tema, plantilla: j.plantilla, arriba: corto(j.arriba), abajo: corto(j.abajo), autor: input.userName };
      if (!meme.arriba && !meme.abajo) throw new Error("sin texto");
    } catch {
      meme = { tema, plantilla: evitar === "fine" ? "success" : "fine", arriba: corto(tema), abajo: "Todo bien por aquí", autor: input.userName };
    }

    // ── 3 y 4. Guardar y devolver la imagen ─────────────
    ctx.store.set(claveUltimo, meme);
    ctx.store.set("historial", [...historial, meme].slice(-20));

    return { text: `🖼️ _${meme.tema}_`, image: urlMeme(meme) };
  },
} satisfies Module;
