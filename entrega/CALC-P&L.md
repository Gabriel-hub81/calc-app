# CALC — Profit & Loss

**Period:** June 11 – August 17, 2026 (project inception to submission)
**Entity:** No legal entity incorporated. Pre-revenue project.
**Currency:** USD

---

## Revenue

| Month | Arms-length third-party revenue |
|---|---|
| June 2026 | $0.00 |
| July 2026 | $0.00 |
| August 2026 | $0.00 |
| **Total** | **$0.00** |

**We have no paying customers and no revenue.** We did not reach an
arms-length transaction before the deadline. Three people outside the team
have used the application, but they are personal acquaintances of the
founders, which excludes them from this line by the competition's own
definition. We are reporting that exclusion rather than working around it.

---

## Costs (excluding marketing)

Source: Google Cloud Billing report for project `gen-lang-client-0089539356`,
period June–August 2026. **Billed in Mexican pesos (MXN).** USD figures are
converted at 18 MXN/USD and are approximate; the MXN amount is the billed one.

| Period | Billed (MXN) | ≈ USD |
|---|---|---|
| June 11 – August 17, 2026 (full project life) | **$42.28 MXN** | **≈ $2.35** |
| *of which savings/credits applied* | –$1.18 MXN | |

### Cost by component

| Component | Billed (MXN) | Note |
|---|---|---|
| Gemini API — language, vision, evaluation | $42.28 | Effectively the entire bill |
| — of which output tokens, `gemini-3.5-flash` | $26.83 | Largest single SKU |
| Cloud Run — service and 5 scheduled jobs | $0.00 | Scales to zero; no minimum instances |
| Firestore | $0.00 | Within free tier |
| Cloud Scheduler, Cloud Build, Artifact Registry, Cloud Logging | $0.00 | Within free tier |
| Domain / hosting | $0.00 | Served on the default `run.app` domain |

**Total operating cost for the life of the project: $42.28 MXN (≈ $2.35 USD).**

Infrastructure cost is zero, and that is a design result rather than luck. The
web service scales to zero between requests. The five agents are scheduled
jobs, not always-on processes — they wake up, do their work, and exit. The one
thing we pay for is the one thing that does the work: the model.

### The bill validates our measurement

Before pulling the report we had computed our own cost per call by reading
`usageMetadata` off real model responses:

| Operation | Input | Output | Thinking | Cost per call |
|---|---|---|---|---|
| Text question | 2,596 tok | 119 | 417 | $0.0087 USD |
| Receipt photo | 1,099 tok | 797 | 1,439 | $0.0218 USD |

Cross-checking those against the invoice: the output-token SKU billed $26.83
MXN (≈ $1.49 USD), which at the published rate of $9.00 per million output
tokens works out to roughly 165,600 output tokens — about **309 text-call
equivalents** at 536 output-plus-thinking tokens per call. That is consistent
with the 112 calls counted in production logs plus development and evaluation
runs over three months.

The measured unit cost and the invoice agree. That matters more to us than the
size of the number: it means the per-user economics below rest on something we
can verify, not on a price list we read once.

## Marketing and customer acquisition

| Item | Amount |
|---|---|
| Advertising | $0.00 |
| Paid acquisition | $0.00 |
| Sponsorships, influencers, referral incentives | $0.00 |
| **Total marketing spend** | **$0.00** |

We have spent nothing on acquisition. This is a real zero, not an omission.

---

## Net result

| | MXN | ≈ USD |
|---|---|---|
| Revenue | $0.00 | $0.00 |
| Operating cost (June 11 – August 17, billed) | $42.28 | ≈ $2.35 |
| Marketing and customer acquisition | $0.00 | $0.00 |
| **Net result** | **–$42.28 MXN** | **≈ –$2.35** |

---

## Unit economics (what the number is for)

We built a cost-tracking agent (`cost-watch`) specifically so that pricing
would be a decision based on measurement rather than intuition. What it tells
us today:

| Assumed usage | Cost per user / month |
|---|---|
| Light — 3 questions/day, 2 receipts/week | ≈ $1.27 |
| Medium — 8 questions/day, 1 receipt/day | ≈ $3.04 |
| Heavy — 20 questions/day, 2 receipts/day | ≈ $6.83 |

The usage levels are assumptions and are labelled as such; the per-call costs
are measured. The finding that matters: a heavy user — which is precisely our
best target profile, a small food business that records everything — would
cost more than a $5.50/month subscription would bring in. Two cost levers are
already identified (the 2,596-token system prompt sent on every question, and
thinking tokens at 43% of per-call cost). We would rather know this before
setting a price than after.
