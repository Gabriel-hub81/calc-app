# CALC — Human work, agent work, and what we refuse to automate

**Build with Gemini XPRIZE 2026 · Money & Financial Access**
Gabriel Vera · Julian Vera · Claude Code

---

CALC is a financial copilot for Latin America's informal economy. You talk to
it the way you talk to a person — in the Spanish people actually speak, typos
and all — and it answers with your own numbers. It is used by market vendors,
home cooks, corner-store owners: the people who handle cash every day and for
whom no accounting software was ever designed.

The competition asks how the business runs on AI. Our answer is specific, and
it includes a boundary we drew on purpose.

## The daily division of labor

| Every day, the humans | Every day, the agents |
|---|---|
| Decide what CALC is allowed to do with money | Read wholesale prices for 28 products from the government's market system (05:30) |
| Talk to real users and watch them fail | Grade the model against 12 known cases and raise an alarm if accuracy drops (06:30) |
| Choose what to build next, and what not to | Compare each user's purchase history and warn before the next purchase (07:00) |
| Write the code, review the agents' output | Measure what each user costs to serve, and flag spending spikes (08:00) |
| Decide pricing, positioning, priorities | Close the day's books and write it in plain Spanish (21:00) |

The five agents run as Cloud Run Jobs triggered by Cloud Scheduler. No laptop
is open. No session is running. Their execution history — a column of green
checks, one per agent per day — is the most honest evidence we can offer, and
it is what the demo video opens with.

They are not scripts on a timer. Each one makes a judgment: whether there is
anything worth saying at all. Most days, the correct output is silence. The
price watcher stays quiet unless a change crosses both a percentage and a peso
threshold, because an agent that speaks every day is ignored within a week.

## What the agents changed about the product

The clearest example is a defect the agents found in themselves.

Our price alert could only compare a user's own purchase history, so it needed
three purchases of the same product before it could say anything. In the logs
that looked like `avisos_creados=0`, day after day. The cold-start problem was
not a hypothesis; it was measured, in production, by our own telemetry.

The fix was a fifth agent. Every morning it queries SNIIM, the Mexican Ministry
of Economy's wholesale price system — 49 central markets, 222 products, no API,
so we parse the HTML of an ASP.NET page — caches the result, and writes at most
one alert. The morning it went live it found strawberries down 26% at the
Iztapalapa central market and told our user before she went shopping. She had
never scanned a receipt. It worked on day one.

That data matters beyond us. Brazil and Argentina have excellent public price
comparison systems, and both are fed by **fiscal receipts**. The informal
economy — the central market, the street market, the vendor who never issues an
invoice — is structurally excluded from them and always will be, because the
mechanism is tax reporting. Nobody has that data. Whoever builds it, owns it.

## The line we drew

**The model never does arithmetic.** Gemini interprets language and produces a
structured expression; `mathjs` evaluates it; the number the user sees comes
from code. This is not a performance optimization. A language model is not a
calculator, and money does not tolerate a plausible answer.

The same rule shapes everything downstream. When a receipt photo comes back as
truncated JSON, CALC asks again — it never repairs a money object by hand.
When the rows on a receipt do not add up to the printed total, it refuses to
save and asks a human to look. We tested this last week with a real
$3,500.70 supermarket receipt: 22 line items, three coupons, a discount buried
in the totals block, and meat priced by the kilo. It transcribed all of it and
balanced to the cent. Had it not balanced, the save button would have stayed
disabled. Every receipt-scanning app we reviewed simply stores whatever the OCR
returns.

Our accuracy agent embodies the same discipline. On August 16, with the model
overloaded and returning 503s, two of its twelve test cases got no response.
It did not cry degradation. It reported 10/10 correct with 2 unanswered —
distinguishing its own blindness from a real error. An agent that cannot tell
those apart is worse than no agent.

## Where the economics go from here

Nobody has built a business charging shoppers to compare prices — not in three
countries, not in twelve years. The companies that made money in this category
made it on the other side of the counter, and the one that sold shopper data
to brands compromised exactly the promise we care about: you cannot tell
someone a brand went up 18% while that brand pays you.

So the opportunity we see is the seller's side, and it is not price comparison.
It is costing (what does one taco actually cost me), quoting (what do I tell
the customer standing in front of me), and receivables with a name attached —
fiados, apartados, abonos, tandas are the same data object, and no app in this
category treats them as a category at all.

## What is not true yet

We have no paying customers and no revenue. We did not get a stranger to pay
before the deadline. The business is not run end-to-end by agents; it is run by
two people who built agents to do the parts that should never wait for a human
to wake up.

We would rather show a working system with an empty ledger than a demo with
invented numbers.

*(Word count: 833 prose, 981 including headings and tables — within the 500–1000 range)*
