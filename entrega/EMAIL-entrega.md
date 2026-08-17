# Correo de entrega

**El repositorio es PÚBLICO.** No hay que dar acceso a nadie ni invitar
colaboradores — basta con mandar el enlace. Si prefieres dejar constancia
explícita de que lo compartiste, este correo es esa constancia.

**Para:** testing@devpost.com, judging@hacker.fund
**Asunto:** CALC — Repository access · Build with Gemini XPRIZE 2026

---

Hello,

Sharing access to our submission for the Build with Gemini XPRIZE 2026,
category **Money & Financial Access**.

**Project:** CALC — a natural-language financial copilot for Latin America's
informal economy.

**Repository (public, no access request needed):**
https://github.com/Gabriel-hub81/calc-app

**Live application:**
https://calc-912626857437.us-central1.run.app

**Demo video (3 minutes):**
https://youtu.be/AxnG97aaISk

**What to look for in the repository**

- `backend/src/agents/` — the five autonomous agents that run daily on Cloud
  Run Jobs, triggered by Cloud Scheduler with no human involvement.
- `backend/src/services/sniim.js` — integration with SNIIM, the Mexican
  Ministry of Economy's wholesale market price system.
- `backend/src/services/gemini.js` — every call to the model. The model
  structures language; it never performs arithmetic.
- `backend/tests/` — 167 tests, including the real HTML fixture from the
  government site, so we find out the day they change the page.

The agents' execution history is visible in Cloud Logging and shown in the
video: five agents, running every day, with nobody at a keyboard.

Thank you for the opportunity to take part.

Gabriel Vera
Julian Vera

---

## Antes de enviar

- [x] **Los tres enlaces verificados sin sesión el 17/08:**
      repositorio 200 · aplicación 200 · video 200.
      El video está en YouTube como "oculto": `playabilityStatus: OK`,
      `isPrivate: false`, y dura 178 s — exactamente los 2:58 de la
      grabación original. Cualquiera con el enlace lo reproduce sin pedir
      acceso. (Devpost no acepta enlaces de Drive.)
- [ ] Enviar a las dos direcciones en el mismo correo
