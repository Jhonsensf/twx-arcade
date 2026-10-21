// Prueba un comando en tu portátil SIN Slack:
//   npm run probar -- ejemplo hola qué tal
//   npm run probar -- ayuda
// Si tienes ANTHROPIC_API_KEY en .env, usa Claude de verdad.
import "dotenv/config";
import { loadTeams } from "../core/loader";
import { route } from "../core/router";

const teams = await loadTeams();
const reply = await route(process.argv.slice(2).join(" "), { id: "U_LOCAL", name: "yo" }, teams);
console.log(`\n[${reply.public ? "público" : "solo para ti"}]\n${reply.text}\n`);
