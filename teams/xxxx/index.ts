// DIXIT para Slack.
//   /twx xxxx start   → abre partida con cuenta atrás; la gente pulsa "Quiero jugar" y recibe 4 cartas en privado
//   El bot cuenta una mini-historia, cada jugador elige (en privado) la carta que mejor encaja,
//   se revelan barajadas y se vota en secreto con botones. Puntos: 1 por cada voto a tu carta,
//   pero si te vota todo el mundo, 0 (demasiado obvia).
import type { Ctx, Input, Module, Output } from "../../core/contract";
import { componerMesa } from "./mesa";

// Las manos son fijas: 21 grupos de 4 cartas, cada uno con una imagen en fila (manos/mano_XX.jpg)
// para que no haya que hacer scroll. En cada partida a cada jugador le toca una mano al azar.
const MANOS: number[][] = [[60, 7, 59, 69], [8, 47, 45, 12], [75, 51, 39, 70], [46, 68, 27, 62], [34, 9, 73, 49], [56, 38, 55, 78], [4, 84, 18, 50], [79, 81, 3, 28], [40, 43, 24, 64], [20, 67, 10, 30], [42, 19, 35, 36], [6, 22, 5, 83], [33, 48, 25, 52], [76, 23, 17, 26], [80, 21, 61, 32], [44, 82, 53, 2], [58, 13, 37, 15], [11, 1, 31, 57], [63, 71, 74, 54], [72, 77, 29, 14], [66, 65, 41, 16]];
const MIN_JUGADORES = 3;
const MAX_JUGADORES = 12;
// DIXIT_RAPIDO=1 acorta los tiempos para probar en local.
const ESCALA = process.env.DIXIT_RAPIDO ? 0.05 : 1;
const SEG = { unirse: 60, elegir: 60, votar: 60 };
const TICK_MS = 5_000 * ESCALA;
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Las imágenes las sirve el propio bot (rápido); si no tiene dirección pública, GitHub.
const GITHUB = "https://raw.githubusercontent.com/Jhonsensf/twx-arcade/main/teams/xxxx";
const url = (ctx: Ctx, path: string) => ctx.fileUrl(path) ?? `${GITHUB}/${path}`;
const img = (ctx: Ctx, n: number) => url(ctx, `cartas/carta_${String(n).padStart(2, "0")}.jpg`);
const imgMano = (ctx: Ctx, m: number) => url(ctx, `manos/mano_${String(m + 1).padStart(2, "0")}.jpg`);

type Fase = "unirse" | "elegir" | "votar" | "fin";
type Partida = {
  id: string;
  canal: string;
  creador: string;
  fase: Fase;
  fin: number; // cuándo acaba la fase actual (ms)
  mazo: number[]; // manos (índices de MANOS) que quedan por repartir
  manos: Record<string, number[]>; // jugador → sus cartas
  mano: Record<string, number>; // jugador → índice de su mano en MANOS
  nombres: Record<string, string>;
  historia?: string;
  elegidas: Record<string, number>; // jugador → carta elegida
  orden: string[]; // jugadores en el orden en que se revelan sus cartas (A, B, C…)
  votos: Record<string, number>; // votante → índice en `orden`
  msg?: string; // mensaje público con la cuenta atrás de la fase actual
};
type Ranking = Record<string, { nombre: string; puntos: number }>;

// ── Utilidades ────────────────────────────────────────────────
const barajar = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const segundos = (p: Partida) => Math.max(0, Math.ceil((p.fin - Date.now()) / 1000 / ESCALA));
const barra = (p: Partida, total: number) => {
  const llenos = Math.round((segundos(p) / total) * 10);
  return `${"🟩".repeat(llenos)}${"⬜".repeat(10 - llenos)} *${segundos(p)} s*`;
};
const jugadores = (p: Partida) => Object.keys(p.manos);
const menciones = (ids: string[]) => ids.map((u) => `<@${u}>`).join(" ") || "_nadie todavía_";

// Una partida por canal: cada canal (o grupo privado donde esté el bot) juega la suya.
const clave = (canal: string) => `partida:${canal}`;
const leer = (ctx: Ctx, canal?: string) => (canal ? ctx.store.get<Partida>(clave(canal)) : undefined);
const guardar = (ctx: Ctx, p: Partida) => ctx.store.set(clave(p.canal), p);
const activa = (ctx: Ctx, canal: string, id: string, fase: Fase) => {
  const p = leer(ctx, canal);
  return p && p.id === id && p.fase === fase ? p : undefined;
};
const enSegundoPlano = (f: () => Promise<unknown>) => void f().catch((e) => console.error("[xxxx]", e));

// ── Cuenta atrás: edita el mensaje de la fase cada pocos segundos y, al llegar a 0, pasa a la siguiente ──
const relojes = new Map<string, ReturnType<typeof setInterval>>();
function cuentaAtras(ctx: Ctx, canal: string, id: string, fase: Fase, pintar: (p: Partida) => Output, alAcabar: () => Promise<void>) {
  clearInterval(relojes.get(id));
  const reloj = setInterval(() => {
    const p = activa(ctx, canal, id, fase);
    if (!p) return void clearInterval(reloj);
    if (Date.now() >= p.fin) {
      clearInterval(reloj);
      return enSegundoPlano(alAcabar);
    }
    if (p.msg) enSegundoPlano(() => ctx.update(p.canal, p.msg!, pintar(p)));
  }, TICK_MS);
  reloj.unref?.();
  relojes.set(id, reloj);
}

// Con muchos clics a la vez, el mensaje público se edita como mucho una vez por segundo
// (en vez de una vez por clic), para no saturar a Slack.
const pendientes = new Set<string>();
function refrescar(ctx: Ctx, p: Partida, fase: Fase, pintar: (p: Partida) => Output) {
  const k = `${p.canal}:${p.id}:${fase}`;
  if (pendientes.has(k)) return;
  pendientes.add(k);
  const { canal, id } = p;
  setTimeout(() => {
    pendientes.delete(k);
    const q = activa(ctx, canal, id, fase);
    if (q?.msg) enSegundoPlano(() => ctx.update(q.canal, q.msg!, pintar(q)));
  }, 1000 * ESCALA).unref?.();
}

// Las cartas a votar, unidas en una sola imagen. Si no se puede (bot sin dirección pública), una por una.
async function imagenesMesa(ctx: Ctx, p: Partida): Promise<Output["images"]> {
  try {
    const png = await componerMesa(p.orden.map((u) => p.elegidas[u]));
    const u = ctx.hostImage(png, "image/png");
    if (u) return [u];
  } catch (e) {
    console.error("[xxxx] mesa:", e);
  }
  return p.orden.map((u, i) => ({ url: img(ctx, p.elegidas[u]), title: LETRAS[i] }));
}

// ── Mensajes públicos de cada fase ────────────────────────────
const msgUnirse = (p: Partida): Output => ({
  text: [
    `🎴 *DIXIT* · partida abierta por <@${p.creador}>`,
    "Pulsa *Quiero jugar* y te daré 4 cartas que solo verás tú. Luego contaré una historia… y empieza el lío.",
    "",
    `⏳ ${barra(p, SEG.unirse)}`,
    `👥 *Jugadores (${jugadores(p).length}):* ${menciones(jugadores(p))}`,
  ].join("\n"),
  buttons: [{ label: "🃏 Quiero jugar", value: `cartas:${p.id}`, style: "primary" }],
});
const msgUnirseCerrado = (p: Partida, motivo: string): Output => ({
  text: `🎴 *DIXIT* · inscripción cerrada\n👥 *Jugadores (${jugadores(p).length}):* ${menciones(jugadores(p))}\n${motivo}`,
});

const msgHistoria = (p: Partida): Output => ({
  text: [
    "📖 *La historia es…*",
    `> ${p.historia}`,
    "",
    "Elige *en privado* la carta de tu mano que mejor encaje. Si no encuentras tus cartas, pulsa el botón.",
    "",
    `⏳ ${barra(p, SEG.elegir)}`,
    `✅ *Han elegido:* ${Object.keys(p.elegidas).length}/${jugadores(p).length}`,
  ].join("\n"),
  buttons: [{ label: "🃏 Ver mis cartas", value: `cartas:${p.id}` }],
});

const msgVotar = (p: Partida): Output => ({
  text: [
    `🗳️ *Votación* · ¿qué carta encaja mejor con «${p.historia}»?`,
    "Voto secreto con los botones de arriba. No puedes votar tu propia carta.",
    "",
    `⏳ ${barra(p, SEG.votar)}`,
    `🗳️ *Han votado:* ${Object.keys(p.votos).length}/${jugadores(p).length}`,
  ].join("\n"),
});

// ── Mensajes privados ────────────────────────────────────────
function msgMano(ctx: Ctx, p: Partida, user: string): Output {
  const mano = p.manos[user];
  const titulo =
    p.fase === "unirse"
      ? "🤫 *Tus cartas.* Cuando acabe la cuenta atrás contaré una historia y elegirás la que mejor encaje."
      : `📖 «${p.historia ?? "…pensando la historia…"}»\nElige la carta que mejor encaje:`;
  return {
    private: true,
    text: titulo,
    images: [imgMano(ctx, p.mano[user])],
    buttons: p.fase === "elegir" ? mano.map((c, i) => ({ label: `Elegir ${i + 1}`, value: `elegir:${p.id}:${c}` })) : undefined,
  };
}

const privado = (text: string): Output => ({ private: true, text });

// ── Fases ────────────────────────────────────────────────────
async function empezar(input: Input, ctx: Ctx): Promise<Output> {
  const actual = leer(ctx, input.channel);
  if (actual && actual.fase !== "fin")
    return privado("⚠️ Ya hay una partida en marcha en este canal. Si se ha quedado colgada: `/twx xxxx parar`.");
  if (!input.channel) return privado("No sé en qué canal estamos 🤷");

  const p: Partida = {
    id: Date.now().toString(36),
    canal: input.channel,
    creador: input.user,
    fase: "unirse",
    fin: Date.now() + SEG.unirse * 1000 * ESCALA,
    mazo: barajar(MANOS.map((_, i) => i)),
    manos: {},
    mano: {},
    nombres: {},
    elegidas: {},
    orden: [],
    votos: {},
  };
  guardar(ctx, p);
  try {
    p.msg = await ctx.post(p.canal, msgUnirse(p));
  } catch (e) {
    p.fase = "fin";
    guardar(ctx, p);
    console.error("[xxxx]", e);
    return privado("😵 No puedo publicar en este canal. Prueba en un canal público, o invítame con `/invite @twx`.");
  }
  guardar(ctx, p);
  cuentaAtras(ctx, p.canal, p.id, "unirse", msgUnirse, () => cerrarInscripcion(ctx, p.canal, p.id));
  return privado("🎴 ¡Partida creada! Mira el canal.");
}

function pedirCartas(input: Input, ctx: Ctx, id?: string): Output {
  const p = leer(ctx, input.channel);
  if (!p || p.fase === "fin" || (id && p.id !== id)) return privado("No hay ninguna partida abierta en este canal. Empieza una con `/twx xxxx start`.");
  if (p.manos[input.user]) return msgMano(ctx, p, input.user);
  if (p.fase !== "unirse") return privado("⌛ La inscripción ya está cerrada. ¡A la próxima!");
  if (jugadores(p).length >= MAX_JUGADORES) return privado(`🙅 Ya somos ${MAX_JUGADORES}, la mesa está llena.`);

  const m = p.mazo.pop()!;
  p.mano[input.user] = m;
  p.manos[input.user] = MANOS[m];
  p.nombres[input.user] = input.userName;
  guardar(ctx, p);
  refrescar(ctx, p, "unirse", msgUnirse);
  return msgMano(ctx, p, input.user);
}

async function cerrarInscripcion(ctx: Ctx, canal: string, id: string) {
  const p = activa(ctx, canal, id, "unirse");
  if (!p) return;
  if (jugadores(p).length < MIN_JUGADORES) {
    p.fase = "fin";
    guardar(ctx, p);
    if (p.msg) await ctx.update(p.canal, p.msg, msgUnirseCerrado(p, `😢 Hacen falta al menos ${MIN_JUGADORES} jugadores. Partida cancelada.`));
    return;
  }
  p.fase = "elegir";
  p.fin = Date.now() + 3_600_000; // se fija de verdad cuando la historia esté publicada
  guardar(ctx, p);
  if (p.msg) await ctx.update(p.canal, p.msg, msgUnirseCerrado(p, "🧠 Pensando una historia…"));

  const historia = await inventarHistoria(ctx);
  const q = activa(ctx, canal, id, "elegir");
  if (!q) return;
  q.historia = historia;
  q.fin = Date.now() + SEG.elegir * 1000 * ESCALA;
  guardar(ctx, q);
  q.msg = await ctx.post(q.canal, msgHistoria(q));
  guardar(ctx, q);
  cuentaAtras(ctx, canal, id, "elegir", msgHistoria, () => revelar(ctx, canal, id));
}

function elegir(input: Input, ctx: Ctx, id: string, carta: number): Output {
  const p = leer(ctx, input.channel);
  if (!p || p.id !== id) return privado("Esa partida ya no existe.");
  if (p.fase === "unirse" || (p.fase === "elegir" && !p.historia)) return privado("✋ Espera a que cuente la historia.");
  if (p.fase !== "elegir") return privado("⌛ Ya no se pueden elegir cartas.");
  if (!p.manos[input.user]?.includes(carta)) return privado("Esa carta no es tuya 🧐");

  p.elegidas[input.user] = carta;
  guardar(ctx, p);
  refrescar(ctx, p, "elegir", msgHistoria);
  if (Object.keys(p.elegidas).length === jugadores(p).length) enSegundoPlano(() => revelar(ctx, p.canal, id));
  return { private: true, replace: true, text: `✅ Has elegido esta carta para «${p.historia}». ¡Ahora a esperar la votación!`, images: [img(ctx, carta)] };
}

async function revelar(ctx: Ctx, canal: string, id: string) {
  const p = activa(ctx, canal, id, "elegir");
  if (!p) return;
  clearInterval(relojes.get(id));
  const quienes = Object.keys(p.elegidas);
  if (quienes.length < 2) {
    p.fase = "fin";
    guardar(ctx, p);
    await ctx.post(p.canal, { text: "😴 Casi nadie ha elegido carta. Partida cancelada. `/twx xxxx start` para otra." });
    return;
  }
  p.fase = "votar";
  p.orden = barajar(quienes);
  p.fin = Date.now() + SEG.votar * 1000 * ESCALA;
  const msgAnterior = p.msg;
  guardar(ctx, p);
  if (msgAnterior) await ctx.update(p.canal, msgAnterior, { text: `📖 *La historia era…*\n> ${p.historia}\n\n✅ Cartas elegidas: ${quienes.length}` });

  await ctx.post(p.canal, {
    text: `🃏 *Las cartas elegidas para «${p.historia}»*`,
    images: await imagenesMesa(ctx, p),
    buttons: p.orden.map((_, i) => ({ label: `Votar ${LETRAS[i]}`, value: `votar:${id}:${i}` })),
  });
  p.msg = await ctx.post(p.canal, msgVotar(p));
  guardar(ctx, p);
  cuentaAtras(ctx, canal, id, "votar", msgVotar, () => resultados(ctx, canal, id));
}

function votar(input: Input, ctx: Ctx, id: string, i: number): Output {
  const p = leer(ctx, input.channel);
  if (!p || p.id !== id || p.fase !== "votar") return privado("⌛ La votación ya está cerrada.");
  if (!p.manos[input.user]) return privado("👀 Solo votan quienes juegan. ¡Apúntate a la siguiente!");
  if (!(i in p.orden)) return privado("Esa carta no existe 🤨");
  if (p.orden[i] === input.user) return privado("😏 Buen intento, pero esa es *tu* carta.");

  p.votos[input.user] = i;
  guardar(ctx, p);
  refrescar(ctx, p, "votar", msgVotar);
  if (Object.keys(p.votos).length === jugadores(p).length) enSegundoPlano(() => resultados(ctx, p.canal, id));
  return privado(`🗳️ Voto secreto guardado: *${LETRAS[i]}*. Puedes cambiarlo mientras dure la votación.`);
}

async function resultados(ctx: Ctx, canal: string, id: string) {
  const p = activa(ctx, canal, id, "votar");
  if (!p) return;
  clearInterval(relojes.get(id));
  p.fase = "fin";
  guardar(ctx, p);

  const votantes = Object.keys(p.votos);
  const filas = p.orden.map((dueno, i) => {
    const recibidos = votantes.filter((v) => p.votos[v] === i);
    const posibles = votantes.filter((v) => v !== dueno).length;
    const obvia = recibidos.length > 0 && recibidos.length === posibles && posibles >= 2;
    return { dueno, letra: LETRAS[i], recibidos, obvia, puntos: obvia ? 0 : recibidos.length };
  });

  const ranking = ctx.store.get<Ranking>("ranking") ?? {};
  for (const f of filas) {
    const r = (ranking[f.dueno] ??= { nombre: p.nombres[f.dueno], puntos: 0 });
    r.puntos += f.puntos;
  }
  ctx.store.set("ranking", ranking);
  if (p.msg) await ctx.update(p.canal, p.msg, { text: `🗳️ *Votación cerrada* · han votado ${votantes.length}/${jugadores(p).length}` });

  const narracion = await narrar(ctx, p, filas);
  const lineas = filas
    .sort((a, b) => b.puntos - a.puntos)
    .map((f) => {
      const votos = f.recibidos.length ? ` (${menciones(f.recibidos)})` : "";
      const nota = f.obvia ? " → *0* 🙄 ¡demasiado obvia!" : ` → *+${f.puntos}*`;
      return `*${f.letra}* · <@${f.dueno}> — ${f.recibidos.length} voto${f.recibidos.length === 1 ? "" : "s"}${votos}${nota}`;
    });

  await ctx.post(p.canal, {
    text: [`🏁 *Resultados de «${p.historia}»*`, "", ...lineas, "", `🎙️ ${narracion}`, "", textoRanking(ranking)].join("\n"),
    buttons: [{ label: "🔁 Otra partida", value: "start", style: "primary" }],
  });
}

// ── Claude ───────────────────────────────────────────────────
const TEMAS = ["los lunes", "el café de la oficina", "aprender idiomas", "una reunión que podía ser un email", "los verbos irregulares", "el wifi", "las vacaciones", "un examen oral", "el frigorífico compartido", "los acentos", "un viaje en tren", "la nostalgia"];
const HISTORIAS_DE_RESERVA = ["Cuando el lunes por fin entendió el subjuntivo", "Lo que el café sabe y no cuenta", "Un viaje sin billete de vuelta", "La reunión que nunca terminó", "El silencio después del examen oral"];

async function inventarHistoria(ctx: Ctx): Promise<string> {
  const tema = TEMAS[Math.floor(Math.random() * TEMAS.length)];
  try {
    const r = await ctx.claude(`Inventa una pista de Dixit inspirada (de lejos) en: ${tema}.`, {
      system:
        "Eres el narrador de una partida de Dixit en el Slack de una academia de idiomas. Escribe UNA sola frase en español, de 4 a 12 palabras, poética, ambigua y con un toque de humor, que pueda encajar con muchas ilustraciones surrealistas distintas. Sin nombres de personas reales. Responde solo con la frase, sin comillas.",
    });
    const frase = r.split("\n")[0].replace(/^["«“']+|["»”'.]+$/g, "").trim();
    if (frase && frase.length <= 120 && !frase.startsWith("(")) return frase;
  } catch (e) {
    console.error("[xxxx] Claude:", e);
  }
  return HISTORIAS_DE_RESERVA[Math.floor(Math.random() * HISTORIAS_DE_RESERVA.length)];
}

async function narrar(ctx: Ctx, p: Partida, filas: { dueno: string; letra: string; recibidos: string[]; obvia: boolean; puntos: number }[]) {
  const resumen = filas
    .map((f) => `${p.nombres[f.dueno]}: ${f.recibidos.length} votos, ${f.puntos} puntos${f.obvia ? " (le votaron todos: demasiado obvia, 0 puntos)" : ""}`)
    .join("\n");
  try {
    const r = await ctx.claude(`Historia: «${p.historia}»\nResultados:\n${resumen}`, {
      system:
        "Eres un comentarista deportivo exageradísimo narrando el final de una ronda de Dixit en el Slack de la empresa. Dos frases como mucho, en español, con emoción desbordada y algún emoji. Menciona al ganador por su nombre tal cual aparece. Si alguien sacó 0 por obvio, búrlate con cariño. Nada ofensivo.",
    });
    if (r && !r.startsWith("(")) return r;
  } catch (e) {
    console.error("[xxxx] Claude:", e);
  }
  const ganador = [...filas].sort((a, b) => b.puntos - a.puntos)[0];
  return `¡Increíble! ${p.nombres[ganador.dueno]} se lleva la ronda. ¡Qué nivel, señores!`;
}

function textoRanking(ranking: Ranking) {
  const top = Object.entries(ranking)
    .sort(([, a], [, b]) => b.puntos - a.puntos)
    .slice(0, 5);
  if (!top.length) return "🏆 _Todavía no hay puntos._";
  const medallas = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  return `🏆 *Ranking general*\n${top.map(([u, r], i) => `${medallas[i]} <@${u}> · ${r.puntos} pts`).join("\n")}`;
}

function parar(input: Input, ctx: Ctx): Output {
  const p = leer(ctx, input.channel);
  if (!p || p.fase === "fin") return privado("No hay ninguna partida en marcha en este canal.");
  p.fase = "fin";
  guardar(ctx, p);
  clearInterval(relojes.get(p.id));
  if (p.msg) enSegundoPlano(() => ctx.update(p.canal, p.msg!, { text: `🛑 Partida cancelada por <@${input.user}>.` }));
  return { text: "🛑 Partida cancelada." };
}

const AYUDA = [
  "🎴 *DIXIT* · el juego de las cartas raras y las historias más raras aún",
  "• `/twx xxxx start` → abre una partida (1 min para apuntarse con el botón)",
  "• Te llegan 4 cartas en privado, cuento una historia y eliges la que mejor encaja",
  "• Se revelan barajadas y se vota en secreto. +1 por cada voto a tu carta… pero si te vota todo el mundo, 0 🙄",
  "• `/twx xxxx ranking` → clasificación  ·  `/twx xxxx parar` → cancelar la partida",
].join("\n");

export default {
  description: "Dixit: cartas surrealistas, una historia y votos secretos. Empieza con /twx xxxx start",

  // IDs de Slack del equipo (cada uno lo ve escribiendo /twx yo). Obligatorio para publicar.
  miembros: ["U03TL0D08EA", "U0617KKBK7W", "U01KHM2BJ22"],

  async handle(input, ctx) {
    const [cmd = "", id, arg] = input.text.trim().toLowerCase().split(/[\s:]+/);
    switch (cmd) {
      case "start":
      case "empezar":
        return empezar(input, ctx);
      case "cartas":
        return pedirCartas(input, ctx, id);
      case "elegir":
        return elegir(input, ctx, id ?? "", Number(arg));
      case "votar":
        return votar(input, ctx, id ?? "", Number(arg));
      case "parar":
        return parar(input, ctx);
      case "ranking":
        return { text: textoRanking(ctx.store.get<Ranking>("ranking") ?? {}) };
      default:
        return { text: AYUDA };
    }
  },
} satisfies Module;
