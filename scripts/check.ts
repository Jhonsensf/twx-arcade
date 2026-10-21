// LA PRUEBA AUTOMÁTICA. Se ejecuta en cada cambio (npm test).
// Para cada equipo: ¿carga?, ¿cumple el contrato?, ¿responde a tiempo con un texto válido?
// No llama a Claude de verdad: usa una respuesta simulada (gratis y rápido).
import { type Ctx, NO_VOTABLES, validateOutput, withTimeout } from "../core/contract";
import { fakeData } from "../core/fake-data";
import { loadTeams } from "../core/loader";

function fakeCtx(): Ctx {
  const mem: Record<string, unknown> = {};
  return {
    claude: async (prompt) => `[respuesta simulada de Claude a: ${prompt.slice(0, 40)}]`,
    store: { get: <T>(k: string) => mem[k] as T | undefined, set: (k, v) => void (mem[k] = v) },
    fakeData: structuredClone(fakeData),
  };
}

const inputs = ["hola, esto es una prueba", ""];
const teams = await loadTeams();
let failed = 0;

for (const t of teams) {
  try {
    if (!t.mod) throw new Error(t.error);
    if (!NO_VOTABLES.includes(t.name)) {
      const m = t.mod.miembros;
      if (!m || !m.length) throw new Error("falta `miembros` con los IDs de Slack del equipo (cada uno lo ve con `/twx yo`)");
      const malos = m.filter((id) => !/^[UW][A-Z0-9]{6,}$/.test(id));
      if (malos.length) throw new Error(`estos miembros no parecen IDs de Slack: ${malos.join(", ")} (son tipo "U0123ABC"; usad /twx yo)`);
    }
    for (const text of inputs) {
      const out = await withTimeout(t.mod.handle({ user: "U_TEST", userName: "test", text }, fakeCtx()));
      validateOutput(out);
    }
    console.log(`✅ ${t.name}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${t.name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (!teams.length) console.log("(no hay equipos)");
console.log(failed ? `\n${failed} equipo(s) no pasan la prueba. No se puede publicar.` : "\nTodo en orden ✨");
process.exit(failed ? 1 : 0);
