# CALC — Tu co-piloto financiero en lenguaje natural

CALC es un copiloto financiero en lenguaje natural sobre Solana para la economía informal de mercados emergentes (LatAm primero). Permite a microempresarios, hogares y trabajadores informales calcular, registrar su día y — más adelante — acceder a servicios financieros, en su idioma, con su forma de hablar, sin jerga.

**Principios**: no-custodial siempre · accesible para cualquiera ("mi abuelita puede usarlo") · primero preciso, luego útil, luego transformador · cero tolerancia a errores en cantidades de dinero.

## Estructura del monorepo

| Carpeta | Contenido | Estado |
|---------|-----------|--------|
| `backend/` | API Node.js: parseo NL + registro del día + recibos (Gemini Vision) + helper de precios | ✅ Sesiones 1 y 1.5 |
| `program/` | Programa Solana (Anchor): registro de verificación opcional | Pendiente (Sesión 2) |
| `frontend/` | PWA React mobile-first con wallet embebido no-custodial | Pendiente (Sesión 3) |

## Arquitectura

```
Usuario (texto · voz · foto de recibo)
        ↓
   React PWA (próximamente: WhatsApp)
        ↓
  Node.js Backend (Cloud Run) — API REST agnóstica de frontend
        ↓               ↓                ↓
  Gemini API        Firestore        Solana
  (parseo NL +      (registro del    (verificación
   Vision)           día, precios)    opcional)
        ↓
   mathjs (el LLM nunca hace la aritmética)
```

## Licencia

MIT — ver [LICENSE](LICENSE).
