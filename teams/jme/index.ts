// Equipo de ejemplo. Copia esta carpeta, cámbiale el nombre y ¡a jugar!
// Uso en Slack:  /twx ejemplo <lo que quieras>
import type { Module } from "../../core/contract";

export default {
  description: "Te contesta como un profe de idiomas muy dramático",

  // IDs de Slack de vuestro equipo (cada uno lo ve escribiendo /twx yo).
  // Obligatorio para publicar. No podréis votar a vuestro propio equipo.
  miembros: ["U02J3M9RM36", "U04GU04432B", "U029XCGFCN7" ],

  async handle(input, ctx) {
    // 1) La libreta: cuántas veces se ha usado este comando
    const usos = (ctx.store.get<number>("usos") ?? 0) + 1;
    ctx.store.set("usos", usos);

    // 2) Los datos inventados
    const sinEmpezar = ctx.fakeData.alumnos.filter((a) => a.horasConsumidas === 0).length;

    // 3) Claude
    const respuesta = await ctx.claude(input.text || "Hola", {
      system: "Eres un profesor de idiomas exageradamente dramático. Contesta en una o dos frases, en español, con algún emoji.",
    });

    return {
      text: `${respuesta}\n\n_Usado ${usos} ${usos === 1 ? "vez" : "veces"} · ${sinEmpezar} alumno(s) de prueba sin estrenarse_`,
    };
  },
} satisfies Module;
