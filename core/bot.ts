// El bot: se conecta a Slack y pasa cada "/twx ..." al router.
import "dotenv/config";
import { App, LogLevel } from "@slack/bolt";
import { loadTeams } from "./loader";
import { route } from "./router";

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

app.command("/twx", async ({ command, ack, respond }) => {
  await ack("⏳ Un momento…"); // Slack exige contestar en menos de 3 s
  const reply = await route(command.text, { id: command.user_id, name: command.user_name }, teams);
  const response_type = reply.public ? "in_channel" : "ephemeral";
  try {
    if (reply.image) {
      // Texto + imagen. Slack descarga la imagen de la URL.
      await respond({
        response_type,
        text: reply.text,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: reply.text.slice(0, 3000) } },
          { type: "image", image_url: reply.image, alt_text: "imagen" },
        ],
      });
    } else {
      await respond({ response_type, text: reply.text });
    }
  } catch (e) {
    console.error("No he podido responder en Slack:", e);
    // Plan B: si Slack no puede cargar la imagen, publicamos el enlace.
    if (reply.image) {
      try {
        await respond({ response_type, text: `${reply.text}\n🖼️ ${reply.image}` });
      } catch (e2) {
        console.error("Tampoco con el enlace:", e2);
      }
    }
  }
});

await app.start();
console.log("🕹️  Twenix Arcade conectado a Slack");
