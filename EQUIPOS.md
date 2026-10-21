# 🕹️ Twenix Arcade — instrucciones para los equipos

Tenéis **90 minutos** para enchufar un invento al bot `/twx` de Slack.
Gana lo que **funciona**, no lo más impresionante.

## Las reglas

1. **Tu invento recibe un texto y devuelve un texto.** Nada más.
2. **Responde en menos de 20 segundos.**
3. **Solo usas lo que te da el bot:** Claude, una libreta para guardar cosas y datos inventados de Twenix. Nada de datos reales.
4. **Solo tocas tu carpeta** `teams/<vuestro-equipo>/`.
5. **Si no pasa la prueba automática, no entra.** Si no está publicado al congelar, no se puede votar.

## Empezar (5 minutos)

```bash
git clone <url-del-repo> && cd twx-arcade
npm install
cp .env.example .env               # pega la clave de Claude que os pasen
git checkout -b equipo-piratas     # vuestra rama
cp -r teams/ejemplo teams/piratas  # vuestra carpeta: minúsculas, números y guiones
```

## Programar

Todo está en `teams/piratas/index.ts`:

```ts
import type { Module } from "../../core/contract";

export default {
  description: "Una línea que explica qué hace",
  async handle(input, ctx) {
    // input.text      → lo que ha escrito la persona
    // input.userName  → quién lo ha escrito
    // ctx.claude("…")  → pregunta a Claude (opcional: { system: "…" })
    // ctx.store.get/set → libreta para guardar cosas entre usos
    // ctx.fakeData    → empresas y alumnos inventados
    return { text: "lo que contesta el bot" };
    // o con imagen:  return { text: "…", image: "https://…png" }
  },
} satisfies Module;
```

**¿Queréis imágenes?** Devolved también `image` con una URL pública `https://…`. Hay un ejemplo completo de memes en `teams/_memes/index.ts` (usa memegen.link: Claude elige plantilla y textos, el código valida y construye la URL). Podéis partir de él: `cp -r teams/_memes teams/vuestro-equipo`.

## Probar en vuestro portátil (sin Slack)

```bash
npm run probar -- piratas hola qué tal   # como si alguien escribiera /twx piratas hola qué tal
npm test                                 # la prueba automática, tiene que salir ✅
```

## Publicar

```bash
git add teams/piratas && git commit -m "piratas" && git push -u origin equipo-piratas
```

Abrid un **Pull Request** en GitHub. Cuando la prueba salga en **verde**, merge. En un par de minutos ya funciona en Slack: `/twx piratas hola`.

Podéis publicar todas las veces que queráis hasta la congelación.

## Votar

```
/twx votar util <equipo>
/twx votar absurdo <equipo>
/twx votar ia <equipo>
```

Un voto por categoría (se puede cambiar). Votar a vuestro propio equipo está feo y lo sabéis.

## Ideas para arrancar (o no)

- Un generador de memes de la vida en Twenix (mirad `teams/_memes`).
- Un trivial de idiomas con puntos, rachas y ranking de la sala.
- Un traductor de mensajes de Slack a "idioma de RRHH".
- Un generador de excusas para no hacer el standup.
- Un oráculo que predice qué alumno de prueba dejará el curso.
- Un juego que guarde puntuaciones en la libreta.
