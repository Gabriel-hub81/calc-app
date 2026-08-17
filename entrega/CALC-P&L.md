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

Source: Google Cloud Billing report for the project
`gen-lang-client-0089539356`. These are billed amounts, not estimates.

| Period | Gross cost | Credits / savings | Net cost |
|---|---|---|---|
| June 2026 (from the 11th) | [PENDIENTE] | | [PENDIENTE] |
| July 2026 | [PENDIENTE] | | [PENDIENTE] |
| August 1–17, 2026 | $39.88 | $1.18 | **$38.70** |
| **Total for the period** | | | **[SUMA]** |

The cost is almost entirely Gemini API consumption — language parsing, vision
for receipts, and the daily evaluation harness. Infrastructure is a rounding
error by design: the Cloud Run service scales to zero between requests, the
five agents run as scheduled jobs rather than always-on processes, and
Firestore usage sits inside the free tier.

| Component | Note |
|---|---|
| Gemini API (language + vision + evaluation) | The large majority of the total |
| Cloud Run — service and 5 jobs | Scales to zero; no minimum instances configured |
| Firestore | Within free tier |
| Cloud Scheduler | 5 jobs; 3 free per billing account |
| Cloud Build, Artifact Registry, Cloud Logging | 19 container images; under $1/month |
| Domain / hosting | $0.00 — served on the default `run.app` domain |

### A note on our own estimate

Before pulling the billing report we reconstructed this figure bottom-up:
counted API calls in production logs, multiplied by a cost per call we had
**measured** by reading `usageMetadata` off real model responses:

| Operation | Input | Output | Thinking | Cost per call |
|---|---|---|---|---|
| Text question | 2,596 tok | 119 | 417 | $0.0087 |
| Receipt photo | 1,099 tok | 797 | 1,439 | $0.0218 |

That reconstruction produced roughly $5–8, and **it was wrong by about five
times.** The per-call figures hold; what the method missed was development
consumption that never appears in production request logs — chiefly the
accuracy evaluation harness, which runs 30 test cases against the live model
and was executed many times over three months of development.

We are reporting this rather than quietly replacing one number with the other,
because the gap is itself the finding: our per-user unit economics are sound,
but our *development* consumption was invisible to us until we looked at the
bill. That is exactly the kind of blind spot the `cost-watch` agent was built
to close, and it currently only watches production.

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

| | Amount |
|---|---|
| Revenue | $0.00 |
| Operating cost (August 1–17, billed) | $38.70 |
| Operating cost (June + July, billed) | [PENDIENTE] |
| Marketing | $0.00 |
| **Net** | **[SUMA NEGATIVA]** |

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
