## Inspiration

In Mexico, most commerce happens in cash and leaves no paper trail. The woman
running a food stall, the corner-store owner extending credit in a spiral
notebook, the mother deciding between two bags of rice — they all do financial
math every single day, in their heads or on paper, and none of the software
built for "small business" was ever built for them.

What made us commit was a structural fact. Brazil and Argentina have excellent
public price-comparison systems, and both are fed by **fiscal receipts**. The
central market, the street market, the vendor who never issues an invoice — all
of them are excluded from that data by construction, and always will be,
because the mechanism is tax reporting. That data does not exist. Whoever
builds it, owns it.

## What it does

You talk to CALC the way you talk to a person, in the Spanish people actually
speak — typos, slang and all.

- **Ask anything with numbers in it.** *"cuánto es el 15% de 800 pesos"*,
  *"vendí 40 tacos a 25 y gasté 300 en carne, cuánto gané"*.
- **Photograph a receipt.** It transcribes every line — including discounts,
  coupons and items priced by weight — and refuses to save if the rows do not
  add up to the printed total.
- **Ask which one is cheaper.** Two bags of rice, 2 kg at $245 or 6.81 kg at
  $1,050? The big one *looks* like the deal and is 26% more expensive per kilo.
- **Get warned before you buy.** Five agents run on their own every day: one
  reads wholesale prices from the government's market system, one compares your
  own purchase history, one closes your books at night.

The alert arrives before the purchase, not after. An alert you read once you
have already paid is worthless.

## How we built it

- **Frontend** — React 19 PWA, mobile-first, with voice and camera input.
- **Backend** — Node.js and Express on Cloud Run, serving the API and the PWA
  from the same origin.
- **Language and vision** — Gemini (`gemini-3.5-flash`) for natural-language
  parsing and receipt transcription.
- **Arithmetic** — `mathjs`. This is the architectural decision the whole
  product rests on: **the model never does arithmetic.** Gemini turns language
  into a structured expression; code evaluates it. A language model is not a
  calculator, and money does not tolerate a plausible answer.
- **Data** — Firestore.
- **The agents** — five Cloud Run Jobs triggered by Cloud Scheduler. No laptop
  open, no session running, retries on failure, every run logged.
- **Wholesale prices** — SNIIM, the Mexican Ministry of Economy's market price
  system: 49 central markets, 222 products, no API. We parse the HTML of an
  ASP.NET page, defensively, and test against a real saved response so we find
  out the day the government changes the page.
- **Tests** — 167, including the invariants that matter: that a broken money
  JSON is never repaired by hand, that an agent never gives orders, that a
  receipt that does not balance cannot be saved.

## Challenges we ran into

**The cold start, which our own logs diagnosed.** Our price alert could only
compare a user's own history, so it needed three purchases of the same product
before it could say anything. In production that looked like
`avisos_creados=0`, day after day. Not a hypothesis — a measurement. The fix
was the fifth agent and the SNIIM integration.

**A government site that answers 503 to anything that isn't a browser.** The
data is public and free by mandate; the server simply rejects clients without
browser headers.

**A diagnosis that turned out to be wrong.** Receipts were coming back as
truncated JSON, and we assumed the model was running out of output budget. We
added logging for `finishReason` to confirm it — and the data said `STOP`, not
`MAX_TOKENS`. The model was stopping on its own, mid-word, deterministically at
temperature 0. Our hypothesis was wrong and the instrument proved it.

**A $3,500 receipt that was right and looked wrong.** Costco prints the weight
on the line *above* the item, so the model copied the line amount into the unit
price field — and 2.845 kg × $433.64 gives $1,233 for a row that reads $433.64.
The backend summed by line amount and said it balanced; the screen recomputed
and said it did not. Two sources of truth for the same number, and a user stuck
with a disabled save button and no way out. Then a second bug: a discount
living in the totals block, below the subtotal, that the model kept forgetting.

**Spanish that gives you away.** Our first market alert said *"papa está más
barato"*. Wrong gender. We put an article on all 28 products and rewrote the
message around a verb, which carries no gender.

## Accomplishments that we're proud of

- **Five agents that have run unattended every day**, with nobody at a
  keyboard. The execution history is a column of green checks.
- **The system refuses to save money it cannot verify.** Every receipt-scanning
  app we reviewed stores whatever the OCR returns. Ours does not.
- **An accuracy agent that knows the difference between being wrong and being
  blind.** On a day when Gemini was overloaded, two of its twelve test cases
  got no answer. It reported 10/10 correct with 2 unanswered instead of raising
  a false alarm.
- **Unit economics we measured, then verified against the invoice.** We read
  `usageMetadata` off real responses to get $0.0087 per text question and
  $0.0218 per receipt — and the billing report's output-token line matches that
  arithmetic.
- **An honest accuracy number.** Zero errors in 30 evaluated cases. We report
  it as *"0 errors in 30 cases; 95% upper bound on the error rate ≈ 10%"*,
  not as "100% accuracy", because the second version is what makes a technical
  judge stop believing everything else you wrote.

## What we learned

**Instrument before you diagnose.** Both of our confident hypotheses about the
receipt bug were wrong, and in both cases the fix came from adding a
measurement rather than from reasoning harder.

**Thinking tokens are billed as output, and they dominate.** 417 tokens of
thinking against 119 of visible answer — 43% of the cost of every question.
And our system prompt is 2,596 tokens riding along on every single call. The
biggest line on the bill was never the vision calls.

**Simulated users are hypotheses, not evidence.** We used a model to generate
six user personas and it was genuinely useful — for ordering what to go verify
in the street. The agreement between personas reflects the generator's internal
consistency, not the world. We label it that way everywhere it appears.

**Silence is a feature.** An agent that speaks every day gets ignored within a
week. Most days, the correct output is nothing at all.

## What's next for CALC

- **Receivables with a name.** Fiados, apartados, abonos and tandas are the
  same data object: person → amount owed → partial payments → balance → age of
  the debt. No app in this category treats it as a category at all.
- **Choose your own central market.** The agent already takes the market as a
  parameter; adding a second city is one scheduler entry, not new code.
- **Meat, grains and cooking oil.** SNIIM publishes those in separate sections
  we have not touched yet — that is what the taquero and the food-stall cook
  actually buy.
- **Cut the cost in half.** Cache the system prompt, and lower the thinking
  budget for questions that need no reasoning.
- **Field interviews, and a paying customer.** We have neither yet, and no
  amount of code substitutes for either.
