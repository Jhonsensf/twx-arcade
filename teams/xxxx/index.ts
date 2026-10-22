// Equipo xxxx (nombre provisional).
// Uso en Slack:  /twx xxxx hello
import type { Module } from "../../core/contract";

export default {
  description: "Invento del equipo xxxx (en construcción 🚧)",

  // IDs de Slack del equipo (cada uno lo ve escribiendo /twx yo). Obligatorio para publicar.
  miembros: ["U03TL0D08EA", "U0617KKBK7W", "U01KHM2BJ22"],

  async handle(input) {
    if (input.text.trim().toLowerCase() === "hello") return { text: "world" };
    return { text: "🚧 En construcción. Prueba `/twx xxxx hello`." };
  },
} satisfies Module;
