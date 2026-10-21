# 🕹️ Twenix Arcade — guía para el organizador

Un bot de Slack (`/twx`) al que cada equipo le enchufa un invento. Todo lo que entra, funciona.

```
/twx ayuda                      → lista de equipos y cómo votar
/twx <equipo> <texto>           → usa el invento de un equipo (lo ve todo el canal)
/twx votar <categoría> <equipo> → vota (util · absurdo · ia)
/twx resultados                 → ranking (solo el árbitro, si pones ADMIN_USER_ID)
```

**Qué hay dentro**

| Carpeta | Qué es | ¿Quién lo toca? |
|---|---|---|
| `core/` | El bot, las reglas, Claude, la libreta y la votación | Solo tú |
| `teams/` | Una carpeta por equipo (`teams/ejemplo` es la plantilla) | Los equipos |
| `scripts/check.ts` | La prueba automática (`npm test`) | Nadie |
| `EQUIPOS.md` | La hoja de instrucciones para los equipos | Tú se la pasas |

Necesitas tres claves: dos de Slack y una de Claude. Unas 1-2 horas en total.

---

## Paso 1 · Slack de pruebas (secreto) — 15 min

1. Crea un Slack gratis solo para ti: https://slack.com/get-started → *Create a new workspace*.
2. Ve a https://api.slack.com/apps → **Create New App** → **From a manifest** → elige tu Slack de pruebas.
3. Pega el contenido de `slack-manifest.yml` (pestaña YAML) → **Create**.
4. **Clave 1 (`SLACK_APP_TOKEN`, empieza por `xapp-`)**: menú *Basic Information* → *App-Level Tokens* → **Generate Token and Scopes** → nombre `socket`, añade el permiso `connections:write` → **Generate** → cópiala.
5. **Clave 2 (`SLACK_BOT_TOKEN`, empieza por `xoxb-`)**: menú *Install App* → **Install to Workspace** → **Allow** → copia el *Bot User OAuth Token*.

## Paso 2 · Clave de Claude — 5 min

1. https://console.anthropic.com → *API Keys* → **Create Key** → nombre `offsite-arcade`.
2. **Clave 3 (`ANTHROPIC_API_KEY`, empieza por `sk-ant-`).**
3. Pon un **límite de gasto** bajo (*Limits*), por ejemplo 30 €. Con el modelo por defecto (Haiku), un hackathon entero cuesta unos pocos euros. Esto es una estimación.

## Paso 3 · Probarlo en tu portátil — 15 min (opcional, pero recomendado)

Necesitas Node 20 o superior (`node -v`).

```bash
cd twx-arcade
npm install
cp .env.example .env          # y pega las 3 claves dentro
npm test                      # → ✅ ejemplo
npm run probar -- ejemplo hola  # prueba SIN Slack
npm start                     # → "🕹️ Twenix Arcade conectado a Slack"
```

En tu Slack de pruebas escribe `/twx ejemplo hola` en cualquier canal. Debería contestar un profe muy dramático.

> ⚠️ Cuando termines, para el bot con **Ctrl+C**. Si está encendido a la vez en tu portátil y en Railway, Slack reparte los comandos entre los dos y parece que falla aleatoriamente.

## Paso 4 · Repo privado en GitHub — 10 min

Créalo en **tu cuenta personal** (no en la organización de Twenix, o lo verán): https://github.com/new → privado, vacío.

```bash
cd twx-arcade
git init && git add . && git commit -m "Twenix Arcade"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/twx-arcade.git
git push -u origin main
```

En la pestaña *Actions* del repo verás la "prueba" en verde.

## Paso 5 · Publicarlo en Railway — 15 min

1. https://railway.app → entra con GitHub → **New Project** → **Deploy from GitHub repo** → `twx-arcade`.
2. Pestaña **Variables** → añade `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `ANTHROPIC_API_KEY`.
   - Opcional: `ADMIN_USER_ID` = tu ID de Slack (perfil → ⋮ → *Copy member ID*). Así solo tú sacas los resultados.
3. Pestaña **Settings** → activa **Wait for CI**. Así solo se publica lo que pasa la prueba automática.
4. Mira los **Logs**: tiene que salir `✅ ejemplo` y `🕹️ Twenix Arcade conectado a Slack`.
5. Prueba `/twx ejemplo hola` en Slack.

A partir de aquí, **cada cambio que llegue a `main` y pase la prueba se publica solo** en un par de minutos.

## Paso 6 · El día antes del offsite — 20 min

1. Repite el **Paso 1** pero en el **Slack de Twenix** (si Slack pide aprobación de un admin para instalar apps, apruébala tú o quien tenga permisos).
2. En Railway, cambia `SLACK_BOT_TOKEN` y `SLACK_APP_TOKEN` por las nuevas.
3. Crea un canal, por ejemplo `#offsite-arcade`, y prueba `/twx ejemplo hola`.
4. **Prueba en seco**: alguien (tu cómplice) sigue `EQUIPOS.md` sin ayuda y publica un equipo nuevo en menos de 10 minutos.

## Paso 7 · Durante el hackathon

- **Al empezar**: invita a todos al repo (*Settings → Collaborators*), pásales `EQUIPOS.md` y la clave de Claude por privado.
- **Regla de oro**: cada equipo trabaja en su rama y abre un PR. **Solo se hace merge con la prueba en verde.** Si alguien rompe `main`, el bot sigue funcionando con la última versión buena, pero nadie más publica hasta que se arregle, así que el culpable invita a café.
- **Congelación**: en Railway → Settings, desactiva los despliegues automáticos. Lo que está publicado es lo que se vota.
- **Feria y votación**: todos usan `/twx` en el canal y votan con `/twx votar …`. Al final, `/twx resultados`.

## Paso 8 · Después

- Borra la clave de Claude en la consola de Anthropic.
- Para el proyecto en Railway (o bórralo).
- Desinstala la app del Slack de Twenix si no la vais a usar más.

---

### Si algo falla

| Síntoma | Causa probable |
|---|---|
| Slack dice *"dispatch_failed"* o no contesta | El bot no está encendido. Mira los logs de Railway. |
| Contesta unas veces sí y otras no | Hay dos bots encendidos (portátil + Railway). Apaga el del portátil. |
| *"Claude no está configurado"* | Falta `ANTHROPIC_API_KEY` en Variables. |
| Un equipo sale tachado con 💥 en `/twx ayuda` | Su código tiene un error. El mensaje dice cuál. El resto sigue funcionando. |
| Un cambio no aparece | No ha pasado la prueba (pestaña *Actions* en GitHub) o Railway aún está publicando. |

Los votos se guardan en el servidor y se borran al volver a publicar. Por eso se congela antes de votar.
