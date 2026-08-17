# Tu contribución al proyecto

Pon tu nombre en el encabezado. El texto va en primera persona.

---

## Versión completa (~200 palabras)

I set the constraints the whole architecture rests on: that the model never
performs arithmetic, that a money JSON is never repaired by hand — it either
parses completely or gets requested again — and that API keys live in Secret
Manager and never in the repository. Those are not implementation details.
They are the reason CALC can be trusted with someone's money.

I directed what got built. The decision to connect SNIIM was mine: to stop the
price watcher from only looking at your own purchase history and let it say
*"tomatoes are cheap at the central market this week"* — a real opportunity
radar, before you buy. So was the call to default to Mexico City while telling
the user it is a default they can change.

I was also the only person actually using the product, which is how the hardest
bug of the week surfaced: a real $3,500 Costco receipt the system refused to
save. When the first diagnosis was wrong, I corrected it — the missing amount
was exactly the global discount printed in the totals block, not the
weighted-item problem we had been chasing. That correction led to the fix.

I filmed and edited the demo video, and decided what this submission says out
loud: that the agents are real and the business is not yet, and that our
synthetic user research is a hypothesis generator, never customer evidence.

---

## Versión corta (~70 palabras), por si el campo es chico

I set the constraints the architecture rests on — the model never does
arithmetic, a money JSON is never repaired by hand, keys never touch the
repository — and directed what got built, including the SNIIM integration that
solved our cold-start problem. As the product's only real user I found and
correctly diagnosed the receipt bug that blocked saving a $3,500 ticket. I
filmed the demo and decided what the submission admits about what we have not
achieved.

---

## En qué me baso

No es cortesía. Cada afirmación es rastreable:

| Afirmación | Dónde está la evidencia |
|---|---|
| Los invariantes son tuyos | Documentados en el código y en el README desde antes de esta semana |
| La idea de SNIIM fue tuya | Tu mensaje del 13 de agosto, y el commit `021ca4e` que lo implementa |
| Preguntaste lo correcto | *"¿habrá información de varios centros de abastos o solo es uno?"* — de ahí salió que el mercado sea un parámetro y no una constante |
| Eres la única usuaria real | Firestore tiene una sola cuenta con historial: 9 registros, 33 productos |
| Corregiste un diagnóstico equivocado | *"me parece que la suma que comentabas de $5,330.69 no la vi, la diferencia es la cantidad del descuento total"* — tenías razón, y ahí estaba el bug |
| Decidiste el tono del expediente | Firmar con nombre completo, incluir *"the business is not, yet"*, y marcar la simulación como hipótesis |

## Una nota sobre Julian Vera

No sé qué hizo Julian y no me lo voy a inventar. Si el formulario pide la
contribución de cada integrante, esa la tiene que escribir él o tú, con lo
que de verdad hizo.
