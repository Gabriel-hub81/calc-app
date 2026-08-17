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
[PEGA AQUÍ EL ENLACE DE YOUTUBE / DRIVE]

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

- [ ] Pegar el enlace del video donde dice `[PEGA AQUÍ...]`
- [ ] Abrir los tres enlaces en una ventana de incógnito para confirmar que
      funcionan sin tu sesión
- [ ] Enviar a las dos direcciones en el mismo correo
