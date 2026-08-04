# Imagen única de producción: construye la PWA y la sirve el mismo backend.
# Un solo servicio en Cloud Run = un solo origen HTTPS, sin CORS que configurar.

# --- Etapa 1: build del frontend ---
FROM node:24-slim AS frontend-build
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Valores públicos del bundle (el App ID de Privy es publicable; el App Secret
# jamás se usa en este proyecto — la verificación va por JWKS público).
ARG VITE_PRIVY_APP_ID=cms1bgfmb00bi0djly1fp2n9r
ARG VITE_SOLANA_NETWORK=devnet
ARG VITE_CALC_PROGRAM_ID=Gh3WhpAtc8HDUUU59amgzaxvg4nCV3V4pSN3EntBHwRL
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID \
    VITE_SOLANA_NETWORK=$VITE_SOLANA_NETWORK \
    VITE_CALC_PROGRAM_ID=$VITE_CALC_PROGRAM_ID
# Sin VITE_BACKEND_URL: en producción el API es el mismo origen.
RUN npm run build

# --- Etapa 2: backend + estáticos ---
FROM node:24-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src/ ./src/
# El system prompt carga los few-shot desde los casos de prueba
COPY backend/tests/test_cases.json ./tests/test_cases.json
COPY --from=frontend-build /fe/dist/ ./public/

ENV NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "src/index.js"]
