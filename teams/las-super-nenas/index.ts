// Tamagotchi colectivo: una única mascota para todo el canal, que se cuida por turnos.
// Uso en Slack:  /twx las-super-nenas <acción>   (ayuda → lista de acciones)
import type { Ctx, Module } from "../../core/contract";

const COMANDO = "/twx las-super-nenas";

// Pensado para que en la feria (15 min) se note el paso del tiempo
const DESGASTE_POR_MIN = { hambre: 3, limpieza: 2, felicidad: 2.5, energia: 1.5 };
const VALOR_INICIAL = 70;
const UMBRAL_AVISO = 30;
const TIMEOUT_CLAUDE_MS = 20_000;

const ETAPAS = [
  { desde: 50, nombre: "leyenda con capa", slug: "leyenda", emoji: "🦸" },
  { desde: 25, nombre: "adulta en maceta", slug: "adulta", emoji: "👔" },
  { desde: 10, nombre: "planta rebelde con corbata", slug: "adolescente", emoji: "🪴" },
  { desde: 3, nombre: "brote", slug: "cria", emoji: "🌱" },
  { desde: 0, nombre: "semilla", slug: "huevo", emoji: "🫘" },
];

// Los GIF los genera sprites/generar.ts y se sirven desde GitHub (solo tras el merge a main).
// Subid VERSION cada vez que regeneréis los sprites: Slack y GitHub cachean las imágenes.
const SPRITES_URL = "https://raw.githubusercontent.com/Jhonsensf/twx-arcade/main/teams/las-super-nenas/sprites";
const VERSION = 2;
const ESTADOS_SPRITE = ["reposo", "regular", "quejica", "agonizando", "comer", "jugar", "banar", "dormir", "acariciar", "turno"];
export const SPRITES = [
  ...["huevo", "cria", "adolescente", "adulta", "leyenda"].flatMap((e) => ESTADOS_SPRITE.map((s) => `${e}-${s}`)),
  "huevo-eclosion",
  "muerta",
];

const NECESIDADES = [
  { clave: "hambre", emoji: "🍖", aviso: "¡Tiene hambre!", accion: "alimentar" },
  { clave: "felicidad", emoji: "😊", aviso: "¡Está triste!", accion: "jugar" },
  { clave: "limpieza", emoji: "🛁", aviso: "¡Huele fatal!", accion: "bañar" },
  { clave: "energia", emoji: "⚡", aviso: "¡Está agotada!", accion: "dormir" },
] as const;

type Necesidad = (typeof NECESIDADES)[number]["clave"];
type Stats = Record<Necesidad, number>;

type Mascota = Stats & {
  nombre: string;
  especie: string;
  nacidaEn: number;
  ultimaActualizacion: number;
  cuidados: number;
  ultimoCuidador: string | null;
  cuidadores: Record<string, { nombre: string; acciones: number }>;
  viva: boolean;
  epitafio?: string;
};

type Tumba = { nombre: string; especie: string; vivio: number; causa: Necesidad; epitafio: string };

type Cuidado = "alimentar" | "jugar" | "banar" | "dormir" | "acariciar";

const ALIAS: Record<string, Cuidado> = {
  alimentar: "alimentar",
  comer: "alimentar",
  jugar: "jugar",
  banar: "banar",
  dormir: "dormir",
  acariciar: "acariciar",
};

const EFECTOS: Record<Cuidado, Partial<Stats>> = {
  alimentar: { hambre: 35, energia: -5 },
  jugar: { felicidad: 30, energia: -15, hambre: -10 },
  banar: { limpieza: 40, felicidad: -5 },
  dormir: { energia: 40, hambre: -5 },
  acariciar: { felicidad: 10 },
};

const VERBOS: Record<Cuidado, string> = {
  alimentar: "le han dado de comer",
  jugar: "han jugado con ella",
  banar: "la han bañado (odia el agua)",
  dormir: "la han echado a dormir",
  acariciar: "le han hecho caricias",
};

const FRASES_TURNO = [
  "🙅 ¡Otra vez tú! Quiero que me cuide otra persona del canal.",
  "😤 Tú ya has hecho tu parte. Ahora le toca a otra persona.",
  "🫣 Me agobias un poco… ¿y si me cuida otra persona?",
  "📢 ¡Se buscan más cuidadores! Tú ya has cumplido, gracias.",
  "🔁 Turno ocupado. Pásale el relevo a otra persona.",
];

const ESPECIES_RESPALDO = ["croissant con ansiedad", "cactus que quiere abrazos", "tostadora existencialista", "medusa de oficina"];
const NOMBRES_RESPALDO = ["Bombón", "Burbuja", "Bellota", "Mojo Jojo Jr."];

const AYUDA =
  "*Acciones:* `alimentar` · `jugar` · `bañar` · `dormir` · `acariciar` · `estado` · `ranking` · `cementerio` · `adoptar [nombre]` · `ayuda`\n" +
  `_Ejemplo: ${COMANDO} alimentar_ — no puedes cuidarla dos veces seguidas.`;

// ── Utilidades ───────────────────────────────────────────────

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const recortar = (n: number) => Math.max(0, Math.min(100, n));

const azar = <T>(lista: readonly T[]) => lista[Math.floor(Math.random() * lista.length)];

const minutosDesde = (ms: number, ahora: number) => Math.floor((ahora - ms) / 60_000);

async function preguntar(ctx: Ctx, prompt: string, system: string): Promise<string | null> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    const respuesta = await Promise.race([
      ctx.claude(prompt, { system }),
      new Promise<never>((_, reject) => (temporizador = setTimeout(() => reject(new Error("timeout")), TIMEOUT_CLAUDE_MS))),
    ]);
    return respuesta.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}

// ── Reglas (todo en código, Claude solo pone la voz) ─────────

function etapa(cuidados: number) {
  return ETAPAS.find((e) => cuidados >= e.desde)!;
}

function necesidadMasBaja(m: Mascota) {
  return NECESIDADES.reduce((peor, n) => (m[n.clave] < m[peor.clave] ? n : peor));
}

function animo(m: Mascota): string {
  const minimo = m[necesidadMasBaja(m).clave];
  if (minimo > 70) return "feliz";
  if (minimo >= 40) return "regular";
  if (minimo >= 15) return "quejica";
  return "agonizando";
}

function causaDeMuerte(m: Mascota): Necesidad | null {
  return NECESIDADES.find((n) => m[n.clave] <= 0)?.clave ?? null;
}

function aplicarTiempo(m: Mascota, ahora: number) {
  const minutos = (ahora - m.ultimaActualizacion) / 60_000;
  for (const n of NECESIDADES) m[n.clave] = recortar(m[n.clave] - DESGASTE_POR_MIN[n.clave] * minutos);
  m.ultimaActualizacion = ahora;
}

function aplicarAccion(m: Mascota, accion: Cuidado, user: string, userName: string) {
  const sobrealimentada = accion === "alimentar" && m.hambre > 90;
  for (const [clave, delta] of Object.entries(EFECTOS[accion]) as [Necesidad, number][]) {
    m[clave] = recortar(m[clave] + delta);
  }
  if (sobrealimentada) m.felicidad = recortar(m.felicidad - 10);
  if (accion === "acariciar") return { sobrealimentada };

  m.cuidados++;
  m.ultimoCuidador = user;
  const cuidador = (m.cuidadores[user] ??= { nombre: userName, acciones: 0 });
  cuidador.nombre = userName;
  cuidador.acciones++;
  return { sobrealimentada };
}

// ── Presentación ─────────────────────────────────────────────

function barra(valor: number) {
  const llenos = Math.round(valor / 10);
  return "▓".repeat(llenos) + "░".repeat(10 - llenos);
}

function barras(m: Mascota) {
  return NECESIDADES.map((n) => `${n.emoji} ${barra(m[n.clave])} ${Math.round(m[n.clave])}`).join("  ");
}

function avisos(m: Mascota) {
  return NECESIDADES.filter((n) => m[n.clave] < UMBRAL_AVISO)
    .map((n) => `⚠️ ${n.aviso} Que alguien haga \`${COMANDO} ${n.accion}\``)
    .join("\n");
}

const SPRITE_DE_CUIDADO: Record<Cuidado, string> = {
  alimentar: "comer",
  jugar: "jugar",
  banar: "banar",
  dormir: "dormir",
  acariciar: "acariciar",
};

const SPRITE_DE_ANIMO: Record<string, string> = { feliz: "reposo", regular: "regular", quejica: "quejica", agonizando: "agonizando" };

// Si no hay GIF para esa combinación: el reposo de la etapa y, si tampoco, un avatar de DiceBear
function sprite(etapaSlug: string, estado: string, nombre: string) {
  const archivo = [`${etapaSlug}-${estado}`, estado, `${etapaSlug}-reposo`].find((s) => SPRITES.includes(s));
  if (archivo) return `${SPRITES_URL}/${archivo}.gif?v=${VERSION}`;
  return `https://api.dicebear.com/9.x/fun-emoji/png?seed=${encodeURIComponent(nombre)}`;
}

function imagen(m: Mascota, estado = SPRITE_DE_ANIMO[animo(m)]) {
  return sprite(etapa(m.cuidados).slug, estado, m.nombre);
}

function tarjeta(m: Mascota, ahora: number, frase: string, extra = "", image = imagen(m)) {
  const e = etapa(m.cuidados);
  const lineas = [
    `${e.emoji} *${m.nombre}* (${m.especie}) · ${e.nombre} · ${minutosDesde(m.nacidaEn, ahora)} min`,
    `_${frase}_`,
    barras(m),
    avisos(m),
    extra,
  ].filter(Boolean);
  return { text: lineas.join("\n"), image };
}

// ── Voz (Claude) ─────────────────────────────────────────────

const SYSTEM_VOZ =
  "Eres una mascota virtual de un canal de Slack, dramática y entrañable. Hablas en español, en primera persona, " +
  "en 1 o 2 frases cortas con algún emoji. Puedes dar las gracias a quien te cuida por su nombre de usuario, " +
  "pero nunca haces bromas ni comentarios sobre personas concretas. Responde solo con la frase.";

async function nacer(ctx: Ctx, nombrePedido: string, ahora: number): Promise<Mascota> {
  const raw = await preguntar(
    ctx,
    nombrePedido ? `Mi nombre es "${nombrePedido}". Invéntame una especie.` : "Invéntame una especie y un nombre.",
    "Inventas mascotas virtuales absurdas y entrañables (p. ej. 'croissant con ansiedad'). " +
      'Responde SOLO con JSON: {"especie": "...", "nombre": "..."}. Especie de máximo 40 caracteres, nombre gracioso de máximo 25.',
  );
  let especie = azar(ESPECIES_RESPALDO);
  let nombre = nombrePedido || azar(NOMBRES_RESPALDO);
  try {
    const j = JSON.parse(raw!.slice(raw!.indexOf("{"), raw!.lastIndexOf("}") + 1));
    if (typeof j.especie === "string" && j.especie.trim()) especie = j.especie.trim().slice(0, 40);
    if (!nombrePedido && typeof j.nombre === "string" && j.nombre.trim()) nombre = j.nombre.trim().slice(0, 25);
  } catch {
    // Se queda con la especie y el nombre de respaldo
  }
  return {
    nombre,
    especie,
    hambre: VALOR_INICIAL,
    felicidad: VALOR_INICIAL,
    limpieza: VALOR_INICIAL,
    energia: VALOR_INICIAL,
    nacidaEn: ahora,
    ultimaActualizacion: ahora,
    cuidados: 0,
    ultimoCuidador: null,
    cuidadores: {},
    viva: true,
  };
}

async function voz(ctx: Ctx, m: Mascota, situacion: string, respaldo: string) {
  const prompt =
    `Eres ${m.nombre}, un/a ${m.especie} en etapa "${etapa(m.cuidados).nombre}". Tu ánimo: ${animo(m)}. ` +
    `Estado (0-100): hambre ${Math.round(m.hambre)}, felicidad ${Math.round(m.felicidad)}, ` +
    `limpieza ${Math.round(m.limpieza)}, energía ${Math.round(m.energia)}. Lo que acaba de pasar: ${situacion}`;
  return (await preguntar(ctx, prompt, SYSTEM_VOZ)) ?? respaldo;
}

async function epitafio(ctx: Ctx, m: Mascota, causa: Necesidad) {
  const respaldo = `Aquí yace ${m.nombre}, que se fue por falta de ${causa}. Nadie lo vio venir (todos lo vieron venir).`;
  return (
    (await preguntar(
      ctx,
      `Escribe el epitafio de ${m.nombre}, un/a ${m.especie}, que ha muerto por falta de ${causa} tras ${m.cuidados} cuidados.`,
      "Escribes epitafios solemnes y absurdos de 1 o 2 frases, en español, para mascotas virtuales. Sin mencionar personas reales. Responde solo con el epitafio.",
    )) ?? respaldo
  );
}

async function morir(ctx: Ctx, m: Mascota, causa: Necesidad, ahora: number) {
  m.viva = false;
  m.epitafio = await epitafio(ctx, m, causa);
  const cementerio = ctx.store.get<Tumba[]>("cementerio") ?? [];
  const tumba = { nombre: m.nombre, especie: m.especie, vivio: minutosDesde(m.nacidaEn, ahora), causa, epitafio: m.epitafio };
  ctx.store.set("cementerio", [...cementerio, tumba].slice(-20));
  ctx.store.set("mascota", m);
  return {
    text: `💀 *${m.nombre}* (${m.especie}) ha muerto por falta de ${causa} tras ${tumba.vivio} min.\n_${m.epitafio}_\n\nAdopta otra con \`${COMANDO} adoptar\``,
    image: imagen(m, "muerta"),
  };
}

// ── Comandos sin mascota viva ────────────────────────────────

function ranking(m: Mascota | undefined) {
  const top = Object.values(m?.cuidadores ?? {})
    .sort((a, b) => b.acciones - a.acciones)
    .slice(0, 5);
  if (!top.length) return { text: "🏆 Aún no la ha cuidado nadie. ¡Estrénate!" };
  const medallas = ["🥇", "🥈", "🥉", "4.", "5."];
  return { text: "🏆 *Mejores cuidadores*\n" + top.map((c, i) => `${medallas[i]} ${c.nombre} — ${c.acciones}`).join("\n") };
}

function cementerio(ctx: Ctx) {
  const tumbas = (ctx.store.get<Tumba[]>("cementerio") ?? []).slice(-5).reverse();
  if (!tumbas.length) return { text: "🪦 El cementerio está vacío. De momento." };
  return {
    text:
      "🪦 *Cementerio*\n" +
      tumbas.map((t) => `• *${t.nombre}* (${t.especie}) · ${t.vivio} min · falta de ${t.causa}\n   _${t.epitafio}_`).join("\n"),
    image: sprite("muerta", "muerta", tumbas[0].nombre),
  };
}

// ── Entrada ──────────────────────────────────────────────────

export default {
  description: "Una mascota de todo el canal que cuidamos entre todos. Si nadie la cuida… 💀",

  // IDs de Slack de vuestro equipo (cada uno lo ve con /twx yo). Obligatorio para publicar.
  miembros: ["U06UUKTHZGC","U07V2SX5GUR", "U016C92D0RZ" ],

  async handle(input, ctx) {
    const ahora = Date.now();
    const [primera = "", ...resto] = input.text.trim().split(/\s+/);
    const accion = normalizar(primera) || "estado";
    let m = ctx.store.get<Mascota>("mascota");

    if (accion === "ayuda") return { text: AYUDA };
    if (accion === "ranking") return ranking(m);
    if (accion === "cementerio") return cementerio(ctx);

    if (m?.viva) {
      aplicarTiempo(m, ahora);
      const causa = causaDeMuerte(m);
      if (causa) return morir(ctx, m, causa, ahora);
      ctx.store.set("mascota", m);
    }

    if (accion === "adoptar") {
      if (m?.viva) return tarjeta(m, ahora, `¡Ya tengo dueños! Cuidadme a mí primero.`);
      m = await nacer(ctx, resto.join(" ").slice(0, 25), ahora);
      ctx.store.set("mascota", m);
      const frase = await voz(ctx, m, `acabas de nacer y ${input.userName} te ha adoptado.`, "¡Hola, mundo! Ya estoy aquí 🌱✨");
      return tarjeta(m, ahora, frase, `🎉 ¡Ha nacido! Cuidadla con \`${COMANDO} ayuda\``);
    }

    if (!m) return { text: `🫘 Todavía no hay mascota. Adopta una con \`${COMANDO} adoptar [nombre]\`` };

    if (!m.viva) {
      return {
        text: `🪦 _${m.epitafio}_\n\n${m.nombre} ya no está entre nosotros. Adopta otra con \`${COMANDO} adoptar\``,
        image: imagen(m, "muerta"),
      };
    }

    if (accion === "estado") return tarjeta(m, ahora, `Me siento ${animo(m)}.`);

    const cuidado = ALIAS[accion];
    if (!cuidado) {
      return { text: `🤨 ${m.nombre} te mira sin entender qué es «${primera}». Prueba otra cosa.\n\n${AYUDA}` };
    }

    if (cuidado !== "acariciar" && m.ultimoCuidador === input.user) {
      return tarjeta(m, ahora, azar(FRASES_TURNO), "", imagen(m, "turno"));
    }

    const etapaAntes = etapa(m.cuidados);
    const { sobrealimentada } = aplicarAccion(m, cuidado, input.user, input.userName);
    const causa = causaDeMuerte(m);
    if (causa) return morir(ctx, m, causa, ahora);
    ctx.store.set("mascota", m);

    const etapaAhora = etapa(m.cuidados);
    const subida = etapaAhora !== etapaAntes ? `🌟 *¡${m.nombre} ha evolucionado a ${etapaAhora.nombre}!* ${etapaAhora.emoji}` : "";
    const situacion = `${input.userName} ${VERBOS[cuidado]}.` + (sobrealimentada ? " Estabas ya a reventar." : "");
    const frase = await voz(ctx, m, situacion, sobrealimentada ? "Estoy a reventar… 🤢" : "¡Gracias! 💖");
    const eclosiona = etapaAntes.slug === "huevo" && etapaAhora !== etapaAntes;
    const image = eclosiona ? sprite("huevo", "eclosion", m.nombre) : imagen(m, SPRITE_DE_CUIDADO[cuidado]);
    return tarjeta(m, ahora, frase, subida, image);
  },
} satisfies Module;
