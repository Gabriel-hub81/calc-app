# CALC — Tu co-piloto financiero en lenguaje natural

CALC es un copiloto financiero en lenguaje natural sobre Solana para la economía informal de mercados emergentes (LatAm primero). Permite a microempresarios, hogares y trabajadores informales calcular, registrar su día y — más adelante — acceder a servicios financieros, en su idioma, con su forma de hablar, sin jerga.

**Principios**: no-custodial siempre · accesible para cualquiera ("mi abuelita puede usarlo") · primero preciso, luego útil, luego transformador · cero tolerancia a errores en cantidades de dinero.

## Pruébalo

**App en vivo:** https://calc-912626857437.us-central1.run.app

Funciona sin registro (calculadora); entrar con correo o teléfono habilita guardar el día. Ejemplos para escribir o dictar:

- `cuánto es el 15% de 800 pesos` → 120, mostrando `800 * 0.15`
- `vendí 3 tortas a 25 pesos y 2 aguas de 12` → 99, guardado como venta
- `¿cómo voy hoy?` → ventas, gastos y balance del día
- 📷 foto de un ticket → renglones leídos y precios guardados

## Qué lo hace distinto

- **El LLM nunca hace aritmética.** Gemini traduce lenguaje natural a una expresión estructurada; el cálculo lo evalúa `mathjs`. Un modelo de lenguaje no es una calculadora, y el dinero no admite alucinaciones.
- **Un JSON de dinero jamás se repara a mano.** Si la respuesta del modelo llega truncada, se vuelve a pedir (con temperatura distinta, porque a temperatura 0 el corte es determinista); nunca se completa por nuestra cuenta.
- **Precisión medida, no prometida.** 0 errores en 30 casos evaluados contra Gemini real (20 de ellos fuera de los ejemplos del prompt), y 0 en los 13 casos de dinero. Con esas muestras, la cota superior al 95% de confianza sobre la tasa de error es ~10% en el conjunto completo y ~23% en dinero: lo honesto es decir *"no detectamos errores"*, no *"100% de precisión"*. Ampliar la muestra es trabajo pendiente y declarado. Ver `backend/scripts/`.
- **Transparencia como interfaz.** Cada resultado muestra la operación que se ejecutó y un nivel de confianza; las correcciones de ortografía se declaran ("corregí: dia → día").
- **No-custodial por diseño.** CALC no recibe, guarda ni mueve dinero. La verificación en Solana registra solo un hash, y solo si el usuario lo pide.

## Los agentes: lo que CALC hace sin que nadie se lo pida

Cinco agentes corren solos, todos los días, como Cloud Run Jobs disparados por
Cloud Scheduler. Sin laptop encendida, sin sesión abierta, con reintentos y con
los logs de cada corrida en Cloud Logging. En todos rige la misma regla: los
números los calcula el código; Gemini solo escoge las palabras.

| Agente | Hora (CDMX) | Qué hace solo |
|---|---|---|
| `market-watch` | 5:30 | Consulta SNIIM (Secretaría de Economía) para 28 productos en la Central de Abasto de Iztapalapa, guarda la foto del día y avisa **una** oportunidad real de la semana |
| `accuracy-guard` | 6:30 | Examen sorpresa contra Gemini real; si la precisión se degrada, falla el job a propósito y suena la alarma |
| `price-watch` | 7:00 | Revisa el historial de cada usuaria y avisa subidas y bajadas **antes** de la próxima compra |
| `cost-watch` | 8:00 | Vigila el gasto en API por usuaria; un pico falla el job y llega el correo |
| `daily-close` | 21:00 | Cierra la cuenta del día antes de dormir |

`market-watch` existe porque `price-watch` tiene un arranque en frío medible:
necesita tres compras del mismo producto para poder decir algo, y sus logs
mostraban `avisos_creados=0` día tras día. Los precios de central de abasto son
públicos y no dependen del historial de nadie: CALC sirve desde el día uno.

Ese dato, además, es el único que nadie más cubre. Brasil (NF-e) y Argentina
(SEPA) construyen sus comparadores de precios sobre **comprobantes fiscales**,
así que el comercio informal les queda estructuralmente fuera. La central de
abasto y el tianguis no emiten factura.

> **Es mayoreo, no el súper.** Todo aviso nombra la central y aclara que es
> precio de central. Prometer un precio de tienda con datos de mayoreo sería
> mentir, y una sola mentira comprobable tira la confianza de todo lo demás.

## Estructura del monorepo

| Carpeta | Contenido | Estado |
|---------|-----------|--------|
| `backend/` | API Node.js: parseo NL + registro del día + recibos (Gemini Vision) + helper de precios | ✅ Sesiones 1 y 1.5 |
| `program/` | Programa Solana (Anchor 1.0.2): calc-registry, verificación opcional | ✅ Sesión 2 |
| `frontend/` | PWA React 19 mobile-first: voz, cámara, wallet embebido (demo/Privy) | ✅ Sesión 3 |

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

## Correr en local

```bash
# Backend (necesita GEMINI_API_KEY en backend/.env — ver .env.example)
cd backend && npm install && npm run dev     # :8080
npx jest                                     # 60 pruebas

# Frontend
cd frontend && npm install && npm run dev    # :5173
```

Sin `PRIVY_APP_ID` la app corre en modo demo (login simulado, almacenamiento en
memoria): todo se puede probar sin credenciales de terceros salvo la de Gemini.

## Despliegue

Un solo servicio en Cloud Run construye la PWA y la sirve junto al API — mismo
origen, sin CORS. La llave de Gemini vive en Secret Manager, nunca en el código.

```bash
gcloud run deploy calc --source . --region us-central1
```

## Privacidad

Aviso completo en [`frontend/public/privacidad.html`](frontend/public/privacidad.html),
escrito sobre el flujo real de datos: sin analítica, sin cookies, sin rastreadores;
las imágenes de tickets no se almacenan; on-chain solo va un hash.

## Licencia

MIT — ver [LICENSE](LICENSE).
