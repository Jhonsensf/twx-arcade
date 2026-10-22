// El bot: se conecta a Slack y pasa cada "/twx ..." (y cada clic en un botón) al router.
import "dotenv/config";
import { App, type BlockAction, type ButtonAction, LogLevel, type RespondFn } from "@slack/bolt";
import { ACTION_PREFIX, toMessage, withImageLinks } from "./blocks";
import { loadTeams } from "./loader";
import { type Reply, route, routeAction } from "./router";
import { setPoster } from "./services";

for (const key of ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"]) {
  if (!process.env[key]) {
    console.error(`❌ Falta la variable ${key}. Mira el README.`);
    process.exit(1);
  }
}

const teams = await loadTeams();
console.log("Equipos cargados:");
for (const t of teams) console.log(t.mod ? `  ✅ ${t.name}` : `  💥 ${t.name}: ${t.error}`);

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.WARN,
});

/** Contesta a un comando o a un clic. `replace` solo vale para clics: sustituye el mensaje del botón. */
async function send(respond: RespondFn, reply: Reply, replace = false) {
  const response_type = reply.public ? "in_channel" : "ephemeral";
  const rich = !!(reply.image || reply.images?.length || reply.buttons?.length);
  const msg = rich ? toMessage(reply, reply.team ?? "") : { text: reply.text };
  try {
    await respond({ response_type, replace_original: replace, ...msg });
  } catch (e) {
    console.error("No he podido responder en Slack:", e);
    // Plan B: si Slack no puede cargar alguna imagen, publicamos los enlaces.
    if (rich && "blocks" in msg) {
      try {
        await respond({ response_type, replace_original: replace, ...withImageLinks(msg, reply) });
      } catch (e2) {
        console.error("Tampoco con los enlaces:", e2);
      }
    }
  }
}

app.command("/twx", async ({ command, ack, respond }) => {
  await ack("⏳ Un momento…"); // Slack exige contestar en menos de 3 s
  const reply = await route(command.text, { id: command.user_id, name: command.user_name }, teams, command.channel_id);
  await send(respond, reply);
});

// Botones de los equipos: action_id = "twx:<equipo>:<n>", value = lo que se pasa a su handle.
app.action<BlockAction<ButtonAction>>(new RegExp(`^${ACTION_PREFIX}`), async ({ ack, body, action, respond }) => {
  await ack();
  const team = action.action_id.slice(ACTION_PREFIX.length).split(":")[0];
  const user = { id: body.user.id, name: body.user.username ?? body.user.name ?? body.user.id };
  const reply = await routeAction(team, action.value ?? "", user, teams, body.channel?.id);
  await send(respond, reply, !!reply.replace);
});

// Los equipos pueden publicar y editar mensajes cuando quieran (ctx.post / ctx.update).
setPoster({
  post: async (team, channel, out) => {
    const msg = toMessage(out, team);
    try {
      const res = await app.client.chat.postMessage({ channel, ...msg });
      return res.ts ?? "";
    } catch (e) {
      if (!out.image && !out.images?.length) throw e;
      const res = await app.client.chat.postMessage({ channel, ...withImageLinks(msg, out) });
      return res.ts ?? "";
    }
  },
  update: async (team, channel, ts, out) => {
    const msg = toMessage(out, team);
    try {
      await app.client.chat.update({ channel, ts, ...msg });
    } catch (e) {
      if (!out.image && !out.images?.length) throw e;
      await app.client.chat.update({ channel, ts, ...withImageLinks(msg, out) });
    }
  },
});

await app.start();
console.log("🕹️  Twenix Arcade conectado a Slack");
