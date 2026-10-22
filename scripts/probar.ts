// Prueba un comando en tu portátil SIN Slack:
//   npm run probar -- ejemplo hola qué tal
//   npm run probar -- ayuda
//   npm run probar -- --boton <equipo> <value>   (simula pulsar un botón)
// Si tienes ANTHROPIC_API_KEY en .env, usa Claude de verdad.
import "dotenv/config";
import { loadTeams } from "../core/loader";
import { route, routeAction } from "../core/router";

const teams = await loadTeams();
const args = process.argv.slice(2);
const user = { id: "U_LOCAL", name: "yo" };
const reply =
  args[0] === "--boton"
    ? await routeAction(args[1] ?? "", args.slice(2).join(" "), user, teams, "C_LOCAL")
    : await route(args.join(" "), user, teams, "C_LOCAL");
console.log(`\n[${reply.public ? "público" : "solo para ti"}${reply.replace ? " · sustituye el mensaje del botón" : ""}]\n${reply.text}\n`);
const images = [...(reply.image ? [reply.image] : []), ...(reply.images ?? [])];
if (images.length) console.log(`🖼️  Imágenes (ábrelas en el navegador):\n${images.map((i) => (typeof i === "string" ? i : `${i.title ?? ""} ${i.url}`)).join("\n")}\n`);
for (const b of reply.buttons ?? []) console.log(`🔘 [${b.label}]  →  npm run probar -- --boton ${reply.team} ${b.value}`);
