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

---

## Expense breakdown

Total billed: **$42.28 MXN (≈ $2.35 USD)** for the life of the project,
June 11 – August 17, 2026.

| Category | MXN | ≈ USD | % of total |
|---|---|---|---|
| Cost of goods sold (cost to serve) | $18.90 | $1.05 | **45%** |
| Research and development | $23.38 | $1.30 | **55%** |
| Sales and marketing | $0.00 | $0.00 | **0%** |
| General and administrative | $0.00 | $0.00 | **0%** |

Allocation method: every line is a count of Gemini API calls taken from
production logs, multiplied by a cost per call measured from `usageMetadata`
on real responses ($0.0087 per text call, $0.0218 per receipt). The residual
between the counted calls and the invoice is assigned to R&D, because
development and evaluation traffic does not appear in request logs. All
infrastructure fell inside free tiers and contributes $0.00 to every category.

### (1) COGS — 45%

| Driver | ≈ USD |
|---|---|
| Receipt photographs — 37 vision calls | $0.81 |
| Natural-language questions — 25 text calls | $0.22 |
| Agents producing user-facing output | $0.03 |
| Infrastructure serving those requests | $0.00 |

**Drivers.** Vision dominates: a receipt costs 2.5x a text question ($0.0218
vs $0.0087), so 37 photographs account for 77% of the cost to serve. Inside
each call the real driver is thinking tokens, which are billed at the output
rate — 417 tokens of thinking against 119 of visible answer on a text call,
1,439 against 797 on a receipt. A 2,596-token system prompt also rides along
on every text request. Infrastructure contributes nothing because the service
scales to zero and the agents are scheduled jobs rather than always-on
workers.

Strictly speaking there is no COGS, because there were no goods sold. We
report cost-to-serve as the closest analogue: this is the line that becomes
COGS the day someone pays.

### (2) Sales and marketing — 0%

No advertising, no paid acquisition, no referral incentives, no sponsorships.
**Driver: we have not attempted acquisition yet.** This is a real zero, and it
is the reason we have no arms-length revenue to report.

### (3) R&D — 55%

| Driver | ≈ USD |
|---|---|
| Accuracy evaluation agent — 12 cases graded daily against the live model | $0.73 |
| Development and testing traffic outside request logs | $0.57 |

**Drivers.** The largest single recurring expense in the entire business is an
agent that grades our own model every morning. That is deliberate: quality
degradation in a product that handles money must be detected the day it
happens, not the week a user complains. The second driver is iteration — every
change to receipt handling had to be re-tested against the real model, and 32
of our 34 commits landed in August, which is why 92% of all spending falls in
the final two weeks.

R&D exceeding COGS is the expected shape for a pre-revenue project ten weeks
old, and we would be worried if it were reversed.

### (4) G&A — 0%

No legal entity, no payroll, no office, no accounting software, no
administrative subscriptions billed to the project.

**Driver worth noting:** the function that would normally sit in G&A — knowing
what we spend and what each user costs — is performed by an agent
(`cost-watch`) that runs daily at zero marginal cost, because it does its
arithmetic in code and calls no model. Our finance function is automated and
free.

### A caveat on precision

The whole expense base is $2.35 USD. The percentages are directionally real
and the method is documented, but at this scale a handful of API calls moves a
category by several points. These figures describe how we spend, not how much.

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
