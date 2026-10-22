// Convierte lo que devuelve un equipo (texto, imágenes, botones) en bloques de Slack.
import type { Output } from "./contract";

export type Message = { text: string; blocks: object[] };

/** Prefijo de los botones: "twx:<equipo>:<n>". Así el bot sabe a qué equipo pasar cada clic. */
export const ACTION_PREFIX = "twx:";

export function toMessage(out: Pick<Output, "text" | "image" | "images" | "buttons">, team: string): Message {
  const blocks: object[] = [{ type: "section", text: { type: "mrkdwn", text: out.text.slice(0, 3000) } }];
  const images = [...(out.image ? [out.image] : []), ...(out.images ?? [])];
  for (const img of images) {
    const { url, title } = typeof img === "string" ? { url: img, title: undefined } : img;
    blocks.push({ type: "image", image_url: url, alt_text: title || "imagen", ...(title ? { title: { type: "plain_text", text: title } } : {}) });
  }
  if (out.buttons?.length) {
    blocks.push({
      type: "actions",
      elements: out.buttons.map((b, i) => ({
        type: "button",
        action_id: `${ACTION_PREFIX}${team}:${i}`,
        text: { type: "plain_text", text: b.label, emoji: true },
        value: b.value,
        ...(b.style ? { style: b.style } : {}),
      })),
    });
  }
  return { text: out.text, blocks };
}

/** Plan B si Slack no puede cargar alguna imagen: los enlaces en el texto. */
export function withImageLinks(msg: Message, out: Pick<Output, "image" | "images">): Message {
  const urls = [...(out.image ? [out.image] : []), ...(out.images ?? [])].map((i) => (typeof i === "string" ? i : i.url));
  return {
    text: [msg.text, ...urls.map((u) => `🖼️ ${u}`)].join("\n"),
    blocks: msg.blocks.filter((b) => (b as { type: string }).type !== "image"),
  };
}
