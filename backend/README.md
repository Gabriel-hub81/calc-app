# CALC Backend

**ES** — Backend de CALC, un copiloto financiero en lenguaje natural para la economía informal de LatAm. Descentralizado y no-custodial: CALC nunca tiene acceso a las llaves ni a los fondos de los usuarios. Esta capa (Capa 1) convierte lenguaje natural — con errores de ortografía y coloquialismos — en cálculos verificados: Gemini extrae la expresión, [mathjs](https://mathjs.org) la evalúa. El LLM nunca hace la aritmética.

**EN** — Backend for CALC, a natural-language financial copilot for LatAm's informal economy. Decentralized and non-custodial: CALC never has access to users' keys or funds. This layer (Layer 1) turns natural language — including typos and colloquialisms — into verified calculations: Gemini extracts the expression, mathjs evaluates it. The LLM never does the arithmetic.

## Requisitos

- Node.js LTS (24+)
- Una API key de Gemini ([ai.google.dev](https://ai.google.dev))

## Instalación local

```bash
cd backend
npm install
cp .env.example .env     # y llena GEMINI_API_KEY
npm run dev
```

Prueba:

```bash
curl -s -X POST http://localhost:8080/calculate \
  -H "Content-Type: application/json" \
  -d '{"texto": "cuanto es el quinze por ciento de ochosientos varos"}'
# → {"resultado":120,"expresion_parseada":"0.15 * 800",...}
```

## Tests

```bash
npm test          # suite con Gemini mockeado (contrato del endpoint + evaluador)
npm run accuracy  # accuracy contra Gemini REAL (requiere GEMINI_API_KEY)
                  # genera tests/accuracy_report.md
```

Los casos viven en `tests/test_cases.json` y cumplen doble función: test suite y banco de ejemplos few-shot para el system prompt (los marcados `"few_shot": true`). Mejorar uno mejora el otro. La métrica honesta es la accuracy *held-out* (casos fuera del few-shot).

**Política de dinero**: cero tolerancia a errores en casos `es_dinero: true`. El script de accuracy falla (exit ≠ 0) si hay un solo error de dinero.

## Deploy a Cloud Run

1. Guarda la key en Secret Manager (nunca en `.env` de producción):

```bash
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic
printf "TU_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

2. Deploy:

```bash
gcloud run deploy calc-backend --source . --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars GEMINI_MODEL=gemini-3.5-flash,ALLOWED_ORIGINS=https://tu-frontend.vercel.app
```

## API

### POST /calculate

```json
{ "texto": "cuanto es el quinze por ciento de ochosientos varos", "idioma": "es" }
```

`idioma` es opcional (es/en/pt) — Gemini lo detecta solo.

**Éxito**: `{ resultado, expresion_parseada, idioma_detectado, confianza, correcciones, es_dinero }`

**Ambigüedad** (en dinero nunca se adivina): `{ ambiguo: true, mensaje, opciones[] }`

**Error**: `{ error: true, mensaje, sugerencia }`

Rate limiting: 60 req/min y 1000 req/día por dispositivo (header `X-Device-Id`, fallback a IP).

### GET /health

`{ "ok": true }`

## Notas de arquitectura

- **Modelo por env var** (`GEMINI_MODEL`): se cambia sin tocar código. No fijamos versiones viejas.
- **API agnóstica de frontend**: hoy la consume la PWA; en Fase 2, el bot de WhatsApp — misma API.
- **Sin blockchain en el camino del cálculo**: la verificación on-chain (Solana) es una acción opcional aparte que llega en la Sesión 2. El cálculo siempre se entrega.
- Próxima sesión (1.5): Firestore, registro del día, recibos con Gemini Vision, helper de precios.
