# CALC Frontend — PWA

PWA mobile-first de CALC: React 19 + Vite 8 + Tailwind 4 + vite-plugin-pwa. Se instala en la pantalla de inicio del celular (sin App Store), con acceso a cámara (tickets) y micrófono (voz).

**Prueba de fuego del diseño: "mi abuelita lo puede usar."** Cero jerga técnica visible; el wallet es invisible; calcular siempre funciona sin login.

## Correr en local

```bash
npm install
cp .env.example .env.local   # apunta VITE_BACKEND_URL a tu backend
npm run dev                  # http://localhost:5173
```

Para el flujo completo, corre también el backend (`cd ../backend && npm run dev`).

## Modos de autenticación

| Modo | Cuándo | Cómo |
|------|--------|------|
| **Demo** | `VITE_PRIVY_APP_ID` vacío | "Entrar" simula una cuenta local (token `dev:demo`); el backend debe estar en `AUTH_MODE=dev`. Todo el flujo funciona end-to-end sin cuenta de Privy. |
| **Privy** | `VITE_PRIVY_APP_ID` configurado | Login real con correo/teléfono → wallet embebido de Solana no-custodial (MPC), sin frases semilla visibles. Backend en `AUTH_MODE=privy`. |

Para activar Privy: crear app en [dashboard.privy.io](https://dashboard.privy.io), copiar el App ID a `.env.local`, y verificar en la doc vigente la config de `PrivyProvider` (marcada con TODO en `src/auth/AuthContext.jsx`). Falta también cablear la verificación del JWT en el backend (`src/middleware/auth.js`).

## Qué incluye

- **Calculadora NL**: texto + voz (Web Speech API con detección de soporte — en iOS Safari sin soporte el botón no aparece; el texto siempre funciona)
- **Registro del día**: "vendí 10 chocolates a 10 pesos" → anotado con margen; "¿cómo voy hoy?" → resumen
- **Foto de ticket**: cámara → compresión en cliente → Gemini Vision → **pantalla de confirmación editable** (nada se guarda sin confirmar; si la suma no cuadra con el total, no se puede confirmar)
- **Avisos de precios**: "lo pagaste 18% más caro que tu promedio reciente"
- **Guardar comprobante**: verificación opcional en Solana, en lenguaje simple, con link al explorer
- **Bilingüe ES/EN** (toggle en el header), modal de ambigüedad, indicador de confianza
- **PWA**: manifest + service worker (cache del shell; los datos siempre frescos)

## Deploy

```bash
vercel --prod
```

Configura en Vercel las env vars de `.env.example`. El `vercel.json` ya incluye los rewrites de SPA.

## Checklist de prueba manual (móvil)

1. "cuanto es 15% de 800" → 120, **sin** iniciar sesión
2. Botón de voz (es-MX) — y que se esconda limpio si no hay soporte
3. Entrar → registrar "vendí 10 chocolates a 10 que compré a 7" → margen 30% + Mi día
4. Foto de un ticket real → confirmar artículos → aviso de precio en la segunda compra
5. "Add to Home Screen" — abre standalone con ícono
6. Verificar que NADA de cripto aparece sin iniciar sesión
