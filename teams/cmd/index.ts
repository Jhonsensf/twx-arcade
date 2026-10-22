// Buscador de noticias con dos modos: serio (titulares reales) y guasón (¿verdad o bulo?).
// Uso en Slack:
//   /twx cmd <cualquier temática>   → titulares reales (informática, alimentación, finanzas…)
//   /twx cmd <temática> guason      → te enseño un titular… ¿verdad o bulo?
//   /twx cmd verdad | bulo          → respondes al reto
//   /twx cmd puntos                 → tu marcador
import type { Ctx, Module } from "../../core/contract";

type Feed = { nombre: string; emoji: string; url: string };

// Atajos con portada propia en Google News; cualquier otra temática se busca tal cual
const FEEDS: Record<string, Feed> = {
  informatica: {
    nombre: "Informática",
    emoji: "💻",
    url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=es&gl=ES&ceid=ES:es",
  },
  deportes: {
    nombre: "Deportes",
    emoji: "⚽",
    url: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=es&gl=ES&ceid=ES:es",
  },
  actualidad: {
    nombre: "Actualidad",
    emoji: "📰",
    url: "https://news.google.com/rss?hl=es&gl=ES&ceid=ES:es",
  },
};

const ALIAS: Record<string, string> = {
  informatica: "informatica", tecnologia: "informatica", tech: "informatica", it: "informatica",
  deportes: "deportes", deporte: "deportes", futbol: "deportes",
  actualidad: "actualidad", noticias: "actualidad", general: "actualidad",
};

const quitarTildes = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const MODO_GUASON = ["guason", "broma", "juego", "jugar"];

function feedPara(texto: string): Feed {
  const palabras = texto.split(/\s+/).filter((p) => !MODO_GUASON.includes(quitarTildes(p)));
  const atajo = palabras.length === 1 ? ALIAS[quitarTildes(palabras[0])] : undefined;
  if (atajo) return FEEDS[atajo];
  const tema = palabras.join(" ");
  return {
    nombre: tema.charAt(0).toUpperCase() + tema.slice(1),
    emoji: "🔎",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${tema} when:7d`)}&hl=es&gl=ES&ceid=ES:es`,
  };
}

type Noticia = { titulo: string; medio: string; link: string; fecha: number };
type Reto = { titulo: string; esVerdad: boolean; link?: string; medio?: string; tema: string };
type Marcador = { aciertos: number; fallos: number; racha: number };

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function leerNoticias(url: string): Promise<Noticia[]> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Google News ha respondido ${res.status}`);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.map((it) => {
    const completo = decode(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const link = decode(it.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const fecha = Date.parse(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "") || 0;
    const corte = completo.lastIndexOf(" - ");
    const [titulo, medio] = corte > 0 ? [completo.slice(0, corte), completo.slice(corte + 3)] : [completo, ""];
    // Quitamos colas tipo "| El Medio" para que no delaten la noticia en el modo guasón
    return { titulo: titulo.replace(/\s+\|\s+[^|]+$/, "").trim(), medio, link, fecha };
  }).filter((n) => n.titulo && n.link).sort((a, b) => b.fecha - a.fecha);
}

const azar = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function ayuda(): string {
  return [
    "*🗞️ Buscador de noticias* — elige temática y modo:",
    "• `/twx cmd <temática>` → titulares reales de lo que quieras: `informatica`, `alimentacion`, `finanzas`, `formula 1`… (modo serio)",
    "• `/twx cmd <temática> guason` → te enseño un titular… ¿es *verdad* o un *bulo*?",
    "• `/twx cmd verdad` / `/twx cmd bulo` → respondes al reto",
    "• `/twx cmd puntos` → tu marcador",
  ].join("\n");
}

async function modoSerio(feed: Feed): Promise<string> {
  const noticias = (await leerNoticias(feed.url)).slice(0, 5);
  if (!noticias.length) return `No he encontrado noticias de ${feed.nombre} ahora mismo 😕`;
  // Los enlaces de Google News son muy largos: los ponemos mientras quepan en el límite de Slack
  let texto = `${feed.emoji} *Últimas noticias de ${feed.nombre}*`;
  noticias.forEach((n, i) => {
    const medio = n.medio ? ` _(${n.medio})_` : "";
    const conLink = `\n${i + 1}. <${n.link}|${n.titulo}>${medio}`;
    texto += texto.length + conLink.length < 2_900 ? conLink : `\n${i + 1}. ${n.titulo}${medio}`;
  });
  return texto;
}

async function inventarBulo(feed: Feed, reales: Noticia[], ctx: Ctx): Promise<string | null> {
  const ejemplos = reales.slice(0, 6).map((n) => `- ${n.titulo}`).join("\n");
  const r = await ctx.claude(
    `Titulares reales de hoy sobre ${feed.nombre}:\n${ejemplos}\n\nInventa UN titular FALSO sobre ${feed.nombre} con el mismo estilo y longitud, que sea absurdo pero creíble a primera vista, para un juego de "¿verdad o bulo?". No menciones personas privadas. Devuelve SOLO el titular, sin comillas ni medio.`,
    { system: "Eres un redactor de titulares en español de España. Respondes solo con el titular." },
  );
  let titulo = r.split("\n")[0].replace(/^[-\s]+/, "").trim();
  if (/^["“«].*["”»]$/.test(titulo)) titulo = titulo.slice(1, -1).trim();
  return titulo && !titulo.startsWith("(Claude no está configurado") ? titulo : null;
}

async function modoGuason(input: { user: string }, feed: Feed, ctx: Ctx): Promise<string> {
  const reales = await leerNoticias(feed.url);
  if (!reales.length) return `No he encontrado noticias de ${feed.nombre} para jugar 😕`;

  let reto: Reto;
  const bulo = Math.random() < 0.5 ? await inventarBulo(feed, reales, ctx) : null;
  if (bulo) {
    reto = { titulo: bulo, esVerdad: false, tema: feed.nombre };
  } else {
    const n = azar(reales.slice(0, 15));
    reto = { titulo: n.titulo, esVerdad: true, link: n.link, medio: n.medio, tema: feed.nombre };
  }
  ctx.store.set(`reto:${input.user}`, reto);

  return [
    `🃏 *¿Verdad o bulo?* — ${feed.emoji} ${feed.nombre}`,
    `> ${reto.titulo}`,
    "Responde con `/twx cmd verdad` o `/twx cmd bulo`",
  ].join("\n");
}

function responder(input: { user: string; userName: string }, dice: boolean, ctx: Ctx): string {
  const reto = ctx.store.get<Reto>(`reto:${input.user}`);
  if (!reto) return "No tienes ningún reto pendiente. Empieza uno con `/twx cmd deportes guason` 🃏";
  ctx.store.set(`reto:${input.user}`, undefined);

  const m = ctx.store.get<Marcador>(`puntos:${input.user}`) ?? { aciertos: 0, fallos: 0, racha: 0 };
  const acierto = dice === reto.esVerdad;
  if (acierto) { m.aciertos++; m.racha++; } else { m.fallos++; m.racha = 0; }
  ctx.store.set(`puntos:${input.user}`, m);

  const veredicto = reto.esVerdad
    ? `Era *VERDAD* ✅ → <${reto.link}|${reto.titulo}>${reto.medio ? ` _(${reto.medio})_` : ""}`
    : "Era un *BULO* 🤡, me lo he inventado yo.";
  const titular = acierto ? `🎉 ¡Bien visto, ${input.userName}!` : `😬 Te la he colado, ${input.userName}.`;
  const racha = m.racha >= 3 ? ` · 🔥 racha de ${m.racha}` : "";
  return `${titular}\n${veredicto}\n_Marcador: ${m.aciertos} aciertos · ${m.fallos} fallos${racha}_`;
}

export default {
  description: "Buscador de noticias de la temática que quieras, en modo serio o guasón: ¿verdad o bulo?",

  miembros: ["U01AM611S83", "U07V2SXBGCR", "U061VAZE622"],

  async handle(input, ctx) {
    const palabras = quitarTildes(input.text).split(/\s+/).filter(Boolean);
    if (!palabras.length) return { text: ayuda() };

    if (palabras[0] === "verdad" || palabras[0] === "bulo" || palabras[0] === "falso" || palabras[0] === "mentira")
      return { text: responder(input, palabras[0] === "verdad", ctx) };

    if (palabras[0] === "puntos" || palabras[0] === "marcador") {
      const m = ctx.store.get<Marcador>(`puntos:${input.user}`);
      return { text: m ? `📊 ${input.userName}: ${m.aciertos} aciertos · ${m.fallos} fallos · racha ${m.racha}` : "Aún no has jugado. Prueba `/twx cmd actualidad guason` 🃏" };
    }

    const guason = palabras.some((p) => MODO_GUASON.includes(p));
    if (guason && palabras.length === 1) return { text: `Dime de qué temática, p. ej. \`/twx cmd finanzas guason\` 🃏` };
    const feed = feedPara(input.text.trim());

    try {
      return { text: guason ? await modoGuason(input, feed, ctx) : await modoSerio(feed) };
    } catch (e) {
      return { text: `No he podido traer las noticias ahora mismo 📡 (${e instanceof Error ? e.message : String(e)})` };
    }
  },
} satisfies Module;
