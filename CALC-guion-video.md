# CALC — Guion y prompts del video (3 minutos)

**Entrega XPRIZE:** lunes 17 de agosto, 1:00 pm PT (2:00 pm CDMX)

## La regla

| Tipo | Para qué | De dónde sale |
|---|---|---|
| **Real** | La evidencia que se califica | Grabación de pantalla del celular y de la Mac |
| **Generado** | Ambiente y contexto | Omni / generador de video |

Nada generado puede mostrar la app, datos, logs ni una usuaria real. Si lo
muestra, deja de ser ambiente y se vuelve evidencia fabricada.

---

## Escaleta

| Tiempo | Tipo | Contenido |
|---|---|---|
| 0:00–0:20 | **REAL** | Cloud Scheduler: los 5 agentes con sus horarios. Nadie oprime nada. |
| 0:20–0:35 | **REAL** | El log de la ejecución: `oportunidad={fresa, -26%} · avisos_creados=1` |
| 0:35–0:50 | **REAL** | El celular: abres CALC y el aviso ya está ahí. Nadie lo pidió. |
| 0:50–1:00 | GENERADO | Clip 1 — la central de abasto al amanecer |
| 1:00–1:50 | **REAL** | La app usada: hablarle, la foto del ticket, el cálculo con la operación a la vista |
| 1:50–2:00 | GENERADO | Clip 2 — cocina económica / puesto de comida |
| 2:00–2:30 | **REAL** | Guardián de precisión y contralor de gastos: los agentes que se vigilan solos |
| 2:30–2:45 | GENERADO | Clip 3 — tiendita, cuaderno de fiados |
| 2:45–3:00 | **REAL/CARDS** | Cierre: los 5 agentes, y lo que falta dicho sin adornos |

Proporción: ~35 segundos generados contra ~2:25 de material real. La evidencia
manda; el ambiente acompaña.

---

## Prompts para el generador

En inglés — estos modelos responden mejor. Cada clip está pensado para ~8-10
segundos. **Ninguno incluye pantallas, texto ni logotipos** a propósito.

### Clip 1 — La central de abasto (0:50–1:00)

```
Documentary handheld shot inside a huge wholesale produce market in Mexico
City at 5 AM. Wooden crates stacked high with red tomatoes, onions, limes and
strawberries under warm hanging bulbs. Vendors in aprons unloading sacks from
a truck, breath visible in the cold air, forklift passing in the background.
Shallow depth of field, natural warm tungsten light mixed with blue pre-dawn
light from the loading doors. Slow push-in toward a crate of strawberries.
Realistic, grainy 35mm documentary look. No text, no signage, no logos,
no screens.
```

### Clip 2 — La cocina económica (1:50–2:00)

```
Documentary shot of a small family-run food kitchen in a Mexican
neighborhood, mid-morning. A woman in her fifties in an apron stirs a large
pot of stew on a gas burner, steam rising. Plastic tablecloths, stacked
plates, a rotating fan. Her phone lies face down on the counter next to a
handwritten notebook and a pen. Warm natural light from an open doorway.
Camera slowly drifts from the pot to the notebook. Realistic documentary
style, shallow depth of field. No text, no readable writing, no screens,
no logos.
```

> El celular **boca abajo** y el cuaderno **sin texto legible** son
> deliberados: ahí es donde cortas a tu grabación real.

### Clip 3 — La tiendita y el cuaderno de fiados (2:30–2:45)

```
Documentary close-up inside a tiny neighborhood corner store in Mexico.
Shelves packed with snacks and canned goods behind a worn wooden counter. An
older woman's hands open a well-used spiral notebook and run a finger down a
column, then close it. Afternoon light through a doorway, dust in the air.
Static camera, shallow depth of field, realistic 35mm documentary look. No
readable text, no logos, no screens, no faces in close-up.
```

### Clip 4 — Opcional, para abrir o cerrar

```
Aerial drone shot rising slowly over a dense Mexico City neighborhood at
sunrise, rooftops with water tanks, a street market setting up below with
colorful tarps. Golden warm light, light morning haze. Smooth cinematic
motion. Realistic, no text, no logos.
```

---

## Texto en pantalla (cards)

Recomendación: **cards en inglés** sobre el material real, sin locución. Los
jueces leen inglés, tú controlas cada palabra, y no dependes de grabar audio
limpio a un día de la entrega. La app en pantalla habla español — eso es
autenticidad, no un problema.

| Momento | Card |
|---|---|
| 0:00 | `Five agents run every day. Nobody starts them.` |
| 0:20 | `5:30 AM — the agent reads wholesale prices from the Mexican government's market data.` |
| 0:35 | `Nobody asked for this. It was waiting when she opened the app.` |
| 1:00 | `CALC speaks real Mexican Spanish. The model never does the arithmetic — the code does.` |
| 1:30 | `Photo of a receipt → structured data. If the JSON comes back broken, it asks again. It never patches money by hand.` |
| 2:00 | `An agent grades the model every morning. If accuracy drops, the job fails on purpose and the alert fires.` |
| 2:15 | `Another agent watches what each user costs. Measured, not guessed: $0.0087 per question.` |
| 2:45 | `What's not done yet: no paying customers, no field interviews. The agents are real. The business is not, yet.` |

Ese último card vale más de lo que parece. La honestidad calificada gana sobre
la exageración detectada, y un juez que ve un límite admitido cree el resto.

---

## Notas de producción

- **Grabar pantalla del iPhone:** Ajustes → Centro de Control → agregar
  *Grabación de Pantalla*. Deslizar desde la esquina superior derecha, botón de
  grabar, 3 segundos de cuenta. Se guarda en Fotos.
- **Antes de grabar:** Modo Concentración encendido (que no entren
  notificaciones) y brillo al máximo.
- **Grabar la Mac (logs, Scheduler):** `Cmd + Shift + 5` → *Grabar porción
  seleccionada*. Encuadra solo la ventana.
- **Proporción:** todo en horizontal 16:9. Si grabas el celular en vertical,
  céntralo sobre un fondo neutro en la edición — no lo estires.
- **Gemini anda saturado hoy** (503 intermitentes). Graba las tomas de la app
  con margen; ahora el sistema reintenta solo, pero puede tardar unos segundos.

---

## Dónde entrar para cada toma real

Proyecto `gen-lang-client-0089539356`, región `us-central1`.

### Toma 1 — Cloud Scheduler (0:00)

https://console.cloud.google.com/cloudscheduler?project=gen-lang-client-0089539356

Los cinco agentes con su cron y su zona horaria. Nadie los dispara.

### Toma 2 — Historial de ejecuciones (la más fuerte)

https://console.cloud.google.com/run/jobs?project=gen-lang-client-0089539356

Entrar a un job → pestaña **Ejecuciones**. La columna de palomitas verdes día
tras día es la mejor prueba de "corren continuamente sin intervención humana".

Directo al radar:
https://console.cloud.google.com/run/jobs/details/us-central1/calc-market-watch/executions?project=gen-lang-client-0089539356

### Toma 3 — El log del radar (0:20)

https://console.cloud.google.com/logs/query;query=jsonPayload.agente%3D%22market-watch%22?project=gen-lang-client-0089539356

```json
{ "agente": "market-watch",
  "mercado": "Central de Abasto de Iztapalapa",
  "productos_con_datos": 22, "productos_fallidos": 0,
  "oportunidad": { "producto": "fresa", "variacion_pct": -26, "precio_actual": 30.36 },
  "avisos_creados": 1, "duracion_ms": 66497 }
```

De aquí se corta al celular con el aviso de la fresa: misma corrida, causa y
efecto en dos planos.

### Toma 4 — Guardián y contralor (2:00)

Guardián:
https://console.cloud.google.com/logs/query;query=jsonPayload.agente%3D%22accuracy-guard%22?project=gen-lang-client-0089539356

```json
{ "agente": "accuracy-guard", "casos_intentados": 12, "correctos": 12,
  "acierto_pct": 100, "fallos_dinero": 0, "degradado": false,
  "veredicto": "Sin novedad: 12/12 correctos." }
```

Detalle que vale oro si cabe: en la corrida del 16, con Gemini saturado, dos
casos quedaron sin respuesta y el agente NO gritó degradación — separó "no
pude evaluar" de "contestó mal" y reportó `10/10 correctos, sin_respuesta: 2`.

Contralor:
https://console.cloud.google.com/logs/query;query=jsonPayload.agente%3D%22cost-watch%22?project=gen-lang-client-0089539356

Los cinco agentes en una pantalla:
https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_job%22%0AjsonPayload.agente%3A%2A?project=gen-lang-client-0089539356

### Antes de grabar la pantalla de la Mac

1. Colapsar el menú lateral de la consola (ícono de hamburguesa).
2. Zoom del navegador a **125–150%** (`Cmd` + `+`). A tamaño normal el texto no
   se lee en video comprimido y el juez no va a hacer pausa.
3. Expandir el renglón del log ANTES de grabar. No se ve bien buscar en cámara.

---

## Comandos para las tomas reales

```bash
# Los 5 agentes con sus horarios (toma de 0:00)
gcloud scheduler jobs list --location us-central1 \
  --project gen-lang-client-0089539356 \
  --format="table(name.basename(),schedule,timeZone,state)"

# Disparar el radar en vivo mientras grabas (toma de 0:20)
gcloud run jobs execute calc-market-watch --region us-central1 \
  --project gen-lang-client-0089539356 --wait

# El resultado de la corrida
gcloud logging read 'resource.labels.job_name=calc-market-watch' \
  --project gen-lang-client-0089539356 --limit 3 --format="value(textPayload)"

# Historial de ejecuciones: la prueba de que corren solos, día tras día
gcloud run jobs executions list --region us-central1 \
  --project gen-lang-client-0089539356 --limit 12 \
  --format="table(name,job,status.completionTime,status.succeededCount)"
```
