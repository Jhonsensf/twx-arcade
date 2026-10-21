# 🕹️ Twenix Arcade — instrucciones para los equipos

**El reto:** enseñadle un truco nuevo al bot `/twx` de Slack. Útil, absurdo, un juego, una herramienta… lo que queráis.
Tenéis **50 minutos**. Gana lo que **funciona**, no lo más impresionante.

## Las reglas

1. **Recibe un texto y devuelve un texto** (y, si queréis, una imagen). Es lo único fijo.
2. **Podéis usar cualquier API pública que no pida clave ni registro** (el tiempo, chistes, GIFs, Wikipedia…), además de lo que os da el bot: Claude, una libreta y datos inventados de Twenix.
3. **Nada de datos reales** de Twenix ni de clientes, y **nada de claves propias** en el código (el repo es público).
4. **No instaléis paquetes nuevos de npm.** Si de verdad necesitáis uno, pedídselo al árbitro.
5. **Solo tocáis vuestra carpeta** `teams/<vuestro-equipo>/`.
6. **Declarad vuestros miembros** (ver Paso 1). No se puede votar al propio equipo.
7. **Primera versión publicada antes del minuto 30.** Si no está publicado al congelar, no se vota.
8. **Nada sobre personas concretas.**

## Paso 1 · Preparar (5 min)

Una persona del equipo (la que programa), con el repo ya clonado e instalado:

```bash
cd twx-arcade
git pull
open -e .env                          # pega la clave de Claude que os pasan y guarda
git checkout -b equipo-<nombre>       # vuestra rama
cp -r teams/ejemplo teams/<nombre>    # vuestra carpeta (minúsculas, números y guiones)
```

El `<nombre>` será vuestro comando en Slack: `/twx <nombre>`.

**Miembros (obligatorio):** cada persona del equipo escribe `/twx yo` en Slack y os pasa su ID (tipo `U0123ABC`). Ponedlos en vuestro `index.ts`:

```ts
miembros: ["U0123ABC", "U0456DEF", "U0789GHI"],
```

Sin esto, la prueba automática no os deja publicar, y el bot no os dejará votaros a vosotros mismos.

¿Queréis partir de algo más completo? Mirad `teams/_memes` (genera memes con imagen) para ver cómo se usan Claude, la libreta y las imágenes juntos. Inspiraos, pero no lo presentéis tal cual.

## Paso 2 · Programar

Todo está en `teams/<nombre>/index.ts`:

```ts
import type { Module } from "../../core/contract";

export default {
  description: "Una línea que explica qué hace (sale en /twx ayuda)",
  miembros: ["U0123ABC", "U0456DEF"],   // vuestros IDs (/twx yo)

  async handle(input, ctx) {
    // input.text       → lo que ha escrito la persona después de /twx <nombre>
    // input.userName   → quién lo ha escrito  ·  input.user → su ID (para guardar cosas por persona)
    // ctx.claude("…", { system: "…" }) → pregunta a Claude
    // ctx.store.get("x") / ctx.store.set("x", valor) → libreta compartida por todos los usos
    // ctx.fakeData     → empresas y alumnos inventados de Twenix
    // fetch("https://…") → cualquier API pública sin clave

    return { text: "lo que contesta el bot" };
    // o con imagen:  return { text: "…", image: "https://….png" }
  },
} satisfies Module;
```

Lo más rápido: abrid Claude Code en la carpeta (`claude`) y pedidle lo que queréis, por ejemplo:

> Lee EQUIPOS.md y teams/ejemplo/index.ts. En teams/<nombre>/index.ts quiero que…

Consejos:
- Si una persona escribe varias cosas (`/twx trivial B`, `/twx trivial ranking`), separad `input.text` en palabras y decidid qué hacer con cada una.
- Usad Claude para **generar o entender texto**. Las cuentas, puntuaciones y reglas, mejor con código.
- Si pedís a Claude un JSON, comprobadlo antes de usarlo y tened un plan B si viene mal.

## Paso 3 · Probar en vuestro portátil (segundos)

```bash
npm run probar -- <nombre> lo que escribiría alguien en Slack
```

Sale exactamente el mensaje que se publicaría en el canal. Si devolvéis una imagen, abrid la URL en el navegador.
Repetidlo todas las veces que queráis. La libreta en local es solo vuestra: en Slack empieza de cero.

Antes de publicar:

```bash
npm test     # la prueba automática: tiene que salir ✅ <nombre>
```

## Paso 4 · Publicar (3 min)

```bash
git add teams/<nombre>
git commit -m "<nombre> v1"
git push -u origin equipo-<nombre>
```

En GitHub: **Compare & pull request** → **Create pull request** → esperad la prueba (~30 s):
- 🟢 **Verde** → **Merge**. En ~2 minutos funciona en Slack: `/twx <nombre> …`
- 🔴 **Roja** → leed el error, arregladlo en local y volved a hacer `git push` (el PR se actualiza solo).

## Paso 5 · Mejorar y repetir

Una vez publicado, cada mejora sigue el mismo ciclo:

**cambiar → `npm run probar` → `npm test` → push → PR en verde → merge → comprobar en Slack**

Para seguir en la misma rama después de un merge: `git pull origin main` y a seguir.

Repartíos: una persona programa, otra prueba ideas y frases, otra vigila Slack (y lo que hacen los demás) y prepara la presentación.

## Paso 6 · Congelación, feria y votación

- **Congelación:** el árbitro bloquea el repo. Lo publicado es lo que hay.
- **Feria:** todos en `#offsite-arcade` probando lo de todos. Cada equipo tiene **30 segundos** para presentar: qué hace y qué escribir para probarlo.
- **Votación:**
  ```
  /twx votar util <equipo>
  /twx votar absurdo <equipo>
  /twx votar ia <equipo>
  ```
  Un voto por categoría (se puede cambiar). No se puede votar al propio equipo ni a `ejemplo`.

## Si algo falla

| Problema | Solución |
|---|---|
| `❌ <nombre>: …` en `npm test` | El mensaje dice qué falla. Lo más típico: no devolver `{ text: "…" }`. |
| "Claude no está configurado" | Falta la clave en `.env`. |
| "ha tardado más de 60 s" | Una API lenta o demasiadas llamadas a Claude. Simplificad. |
| `falta miembros` / "no parecen IDs de Slack" | Poned vuestros IDs (los da `/twx yo`), no vuestros nombres. |
| En Slack sale 💥 vuestro equipo | Vuestro código ha fallado con ese texto. Probad lo mismo con `npm run probar` para ver el error. |
| No veis vuestro cambio en Slack | ¿Hicisteis merge? ¿La prueba salió verde? Esperad 2 minutos. |
