# Node LTS vigente (verifica en nodejs.org antes de actualizar el major)
FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
# El system prompt carga los few-shot desde los casos de prueba
COPY tests/test_cases.json tests/intent_cases.json ./tests/

ENV NODE_ENV=production
EXPOSE 8080

USER node
CMD ["node", "src/index.js"]
