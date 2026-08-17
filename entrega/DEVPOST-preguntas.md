# Devpost — respuestas a los campos largos

Cada sección corresponde a un campo del formulario. Copia el bloque que toca.

---

## How your project uses AI to impact the world — Money & Financial Access

More than half of Mexico's workforce earns its living in the informal economy.
They handle cash, issue no invoices, and are therefore invisible to every
financial system built on top of fiscal records — including the public price
transparency systems that work well elsewhere in Latin America. Brazil's
Menor Preço and Argentina's Precios Claros are both fed by electronic invoices.
The central market, the street stall, the corner store that sells on credit in
a spiral notebook: structurally excluded, permanently, because the mechanism is
tax reporting.

CALC gives that population a financial copilot they can actually talk to. Not
a form, not a spreadsheet, not an app that requires you to categorize a
transaction. You say *"vendí 40 tacos a 25 y gasté 300 en carne, cuánto gané"*
and it answers with your own numbers. AI is what makes that possible: nothing
short of a good language model can absorb real Mexican Spanish, with typos and
regional slang, and turn it into structured financial data.

Then AI does something the user never asked for. Five autonomous agents run
every day and bring information *to* them: wholesale prices from the
government's market system, a warning when something they buy has gone up, the
day's books closed before bed. Financial access is not only about being able
to open an account. It is about knowing your own numbers before you make a
decision — which, until now, has meant either paying an accountant or doing it
in your head.

---

## How do you measure impact?

**Theory of change.** People in the informal economy already do this math; they
do it in their heads, under time pressure, with incomplete information. The
constraint is not willingness — it is that the information arrives too late to
change a decision. If we deliver the right number *before* the purchase, the
same person makes a measurably better decision with no new discipline
required.

**Our hypotheses, stated so they can fail:**

1. *An alert before a purchase changes behavior; the same alert after the
   purchase does not.* Everything in the product is built around this, which is
   why the price agents run in the morning.
2. *People will not record transactions one by one.* We assume any product
   that requires per-transaction data entry will be abandoned. This is why
   receipt photography and natural language exist instead of forms.
3. *Willingness to pay lives on the seller's side, not the buyer's.* Nobody in
   three countries and twelve years has built a business charging shoppers to
   compare prices. We expect to be paid for costing, quoting and receivables —
   not for price comparison.

**Outputs we measure today, in production:**

| Output | Instrumented as |
|---|---|
| Alerts delivered before a purchase | `avisos_creados` per agent run |
| Whether the model stayed correct | `acierto_pct`, 12 cases graded daily |
| What one user costs to serve | `costo_por_usuario_mes_usd`, daily |
| Whether the wholesale radar found anything real | `productos_con_datos`, `oportunidad` |
| Whether a receipt could be trusted | balance status; a receipt that does not add up is never saved |

**Outcomes we expect, and how we would prove them.** Short term: the share of
alerts that arrive before the corresponding purchase, and the share a user
keeps rather than dismisses. Medium term: for a merchant, whether their
recorded margin improves after they can see their unit costs. Long term:
whether the wholesale price data we are accumulating becomes a public good for
a population no existing system covers.

**What we cannot yet claim.** We have no outcome data. We have three users,
all personal acquaintances, and no paying customer. The measurement
infrastructure is real and running; the measurements themselves are early.

---

## Underlying business model

**Who we sell to.** An individual who is running a business — a food stall, a
kitchen, a corner store. The transaction looks B2C; the value is B2B. That
distinction matters, because our research found willingness to pay attached to
running a business, not to household budgeting.

**How we acquire customers.** The price intelligence layer is the hook and we
do not intend to charge for it, ever. It is close to a public good, a free
government competitor already exists in the retail segment, and every attempt
to monetize shopper-side price comparison has failed. It earns attention; it
does not earn revenue.

**How we create value.** By answering the three questions a micro-merchant
asks daily and no existing tool answers in their language: *what does one unit
actually cost me*, *what do I quote the customer standing in front of me*, and
*who owes me money*. Fiados, apartados, abonos and tandas are the same data
object — person, amount committed, partial payments, balance, age of the debt —
and no product in this category treats it as a category at all.

**How we retain them.** The ledger they build is the switching cost, and it
compounds: the longer they use it, the better their own price history gets and
the more useful the daily alerts become.

**How we earn money.** A monthly subscription in pesos, charged to the
merchant. Payment rails that a cash business can actually use — this is a
design constraint, not a detail.

---

## How will you sustain operations?

**Resource allocation.** The entire project has cost **$42.28 MXN (≈ $2.35
USD)** to date, and nearly all of it is Gemini API consumption. Infrastructure
is effectively free and that is a design result: the web service scales to
zero between requests, and the five agents are scheduled jobs that wake, work
and exit rather than always-on processes. Our fixed monthly cost is about
$3.35 USD, dominated by the daily accuracy evaluation.

**Threats we can name.**

- *SNIIM has no API and no contract with us.* We parse HTML from a government
  site. It can change or disappear. We mitigate by caching daily, never
  querying it inside a user request, and failing to "no data" rather than to
  invented data — but the dependency is real.
- *Model availability and price.* We watched Gemini return 503s under load
  during this hackathon, and we shipped backoff and retry because of it. Price
  changes flow straight to our unit economics.
- *Cash.* Our users' defining trait is also our hardest commercial problem.
  A subscription requires a payment rail a cash business will actually use.
- *A free permanent competitor.* PROFECO publishes retail price data and
  cannot go out of business. We do not intend to compete on that layer.

**How operations change after the hackathon.** Three things, in order: verify
our assumptions with real interviews instead of simulated ones; build
receivables-with-a-name, which serves the most user profiles; and cut model
cost roughly in half using the two levers we have already identified.

---

## Which AI tools have you leveraged?

**In the product**

- **Gemini API (`gemini-3.5-flash`)** — natural-language parsing, receipt
  transcription via vision, and the wording of every agent message.

**Building it**

- **Claude Code** — our engineering collaborator throughout, and credited by
  name in the demo video alongside the two human authors. It wrote and reviewed
  code, and — more valuably — it repeatedly disproved our own diagnoses with
  measurements. When we assumed receipts were truncating because the model ran
  out of output budget, it added `finishReason` logging that showed the
  hypothesis was wrong.
- **A language model as a user researcher.** With no budget for field
  interviews before the deadline, we generated six user personas and put the
  product in front of each. **This does not replace a single real interview and
  we do not present it as customer evidence.** Its value was ordering what to
  go verify. It produced one finding we could check without leaving the desk —
  that the price alert could say nothing until a user accumulated months of
  history — and the production logs confirmed it: `avisos_creados=0`, every
  day. That defect became the fifth agent.

---

## Is the business model sustainable and viable?

**Five-year goal.** Roughly 50,000 paying micro-merchants at about $149 MXN per
month — approximately $5M USD in annual revenue. Mexico has several million
micro-businesses, so this represents on the order of 1% of the domestic market
before considering the rest of Spanish-speaking Latin America, where the same
structural gap exists.

**Path to profitability, from our actual P&L.** Our fixed cost is about $3.35
USD per month. Our variable cost per user is measured, not estimated: $0.0087
per text question and $0.0218 per receipt, which puts a heavy user at $6.83 per
month today and at roughly $3 after the two optimizations we have identified.
At $149 MXN (≈ $8.28), contribution per user is positive from the first
subscriber, and **fixed costs are covered at around three paying users.** This
is not an aggressive projection; it is arithmetic on a cost base that is
already tiny because of how the system is built.

**Why the model is achievable.** The expensive part — a system that understands
real Mexican Spanish, refuses to guess about money, and runs itself daily — is
built and in production. What remains is commercial, and commercial risk is
the kind we can test cheaply.

**Evidence of product-market fit: we do not have any.** Three people outside
the team have used CALC and all three are personal acquaintances, which
disqualifies them as arms-length evidence. Our persona research is a
hypothesis generator, not evidence. We would rather state this plainly than
dress up a simulation as traction.

**What preserves resources.** A system that costs $2.35 USD to run for three
months can survive a long search for product-market fit. That is the practical
argument for the architecture: scale-to-zero services, scheduled agents instead
of always-on workers, and an agent whose only job is to watch what each user
costs us.

---

## How does your business operate with AI?

Five agents run in production every day as Cloud Run Jobs triggered by Cloud
Scheduler. No laptop is open and no human starts them. Their execution history
is a column of green checks, one per agent per day, and it is what our demo
video opens with.

| Agent | Time | What it decides on its own |
|---|---|---|
| `market-watch` | 05:30 | Reads 28 products from the government wholesale system and decides whether any drop is worth telling anyone about |
| `accuracy-guard` | 06:30 | Grades the live model against 12 known cases and decides whether quality has degraded |
| `price-watch` | 07:00 | Compares each user's purchase history and decides whether to warn before the next purchase |
| `cost-watch` | 08:00 | Measures cost per user and decides whether spending is anomalous |
| `daily-close` | 21:00 | Closes the day's books and writes the summary in plain Spanish |

What this achieves that a human founder could not: the alert that matters most
must arrive at 5:30 in the morning, before the market run, every single day,
forever. No founder does that reliably. The agents do it while we sleep, and
the one on August 16 fired at 5:30:01 a.m.

The second thing AI moves is trust. Our accuracy agent runs a surprise exam on
the live model daily, and if quality drops the job fails on purpose so the
alert fires. On a day when Gemini was overloaded, two of its twelve cases got
no answer — and it reported *10/10 correct with 2 unanswered* rather than
crying degradation. An automated system that cannot distinguish its own
blindness from a real error is worse than none.

---

## To what extent is AI live in production and executing key decisions?

Every one of these decisions is made by software in production today, with no
human in the loop:

- **Whether to interrupt a user at all.** Most days the correct output is
  silence. The price agent warns only when a change crosses both a percentage
  and a peso threshold, and stays quiet about any product it has mentioned in
  the last seven days.
- **Which single opportunity is worth reporting** out of 28 wholesale products,
  and how to word it so it never implies a retail price.
- **Whether the model is still trustworthy**, graded daily, with a deliberate
  job failure as the alarm.
- **Whether a receipt can be saved.** If the line items do not add up to the
  printed total, the save is blocked and a human is asked to look. We tested
  this with a real $3,500.70 supermarket receipt: 22 lines, three coupons, a
  discount buried in the totals block, meat priced by the kilo. It balanced to
  the cent.
- **Whether a spend is anomalous**, measured per user per day.

**And one decision AI is explicitly forbidden from making: the arithmetic.**
Gemini turns language into a structured expression; `mathjs` evaluates it; the
number the user sees comes from code. When a receipt returns malformed JSON,
CALC asks again — it never repairs a money object by hand. Agents inform and
are prohibited from commanding: an agent that says "don't buy this" when it
might be wrong destroys the trust that makes the rest work.

Knowing where to *stop* using the model is as much a design decision as
knowing where to use it.

---

## Which Google Cloud products did you use, and how?

| Product | How we use it |
|---|---|
| **Cloud Run** | One service hosting both the REST API and the React PWA on the same origin. Scales to zero between requests. |
| **Cloud Run Jobs** | The five autonomous agents. Each wakes, works, logs a structured summary, and exits. |
| **Cloud Scheduler** | Triggers all five agents on cron, in `America/Mexico_City`. This is what makes them autonomous rather than manual. |
| **Firestore** | Users' entries, price history, agent notices, usage counters, and the shared wholesale-price cache. |
| **Cloud Logging** | Every agent run emits one structured JSON line. This is our telemetry and our evidence — it is how we discovered the cold-start defect. |
| **Cloud Build** | Container builds for the service and the agents image. |
| **Artifact Registry** | Stores those images. |
| **Secret Manager** | Holds the Gemini API key. It is never in the repository and never in an environment file in production. |
| **Cloud Billing** | The report that validated our measured cost per call against what we were actually charged. |

---

## Which LLMs are used, and how is the Gemini API used?

**Gemini is the only LLM in the product.** Model: `gemini-3.5-flash`, called
through the Gemini API (`@google/genai`). There is no other model in any code
path. Four distinct uses:

1. **Natural-language parsing** (`parseTexto`). The user's Spanish becomes
   structured JSON: an intent, and either an arithmetic expression, a set of
   items to record, a query, or a set of options to compare. Gemini also
   reports the spelling corrections it made, which we show back to the user.
   **It is instructed never to compute anything.**
2. **Receipt transcription** (`parseReceipt`). Gemini Vision reads a photo of a
   receipt into line items with quantity, unit price and amount — including
   discounts as negative rows and items priced by weight. It is instructed to
   transcribe and never to reconcile: *"if the ticket says something, that is
   what you report. Validation is another system's job."*
3. **Wording the agents' messages.** Each agent computes its numbers in code,
   then asks Gemini to phrase one short, warm sentence in Mexican Spanish
   using *exactly* those numbers. Guardrails reject the output and fall back to
   a written message if the model gives an order, exceeds a length limit, or —
   for market alerts — drops the name of the central market, which would make
   a wholesale price look like a store price.
4. **Grading itself.** The accuracy agent calls the live Gemini API with 12
   known cases every morning and compares the answers against expected values.

The boundary is the same everywhere: **Gemini structures language; code
computes money.** A language model is not a calculator, and money does not
tolerate a plausible answer.
