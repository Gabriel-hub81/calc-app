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

| Item | Amount | Basis |
|---|---|---|
| Gemini API (language + vision) | $3 – $6 | Bottom-up, see method below |
| Cloud Run (service + 5 jobs) | $0.00 | Within free tier |
| Firestore | $0.00 | Within free tier |
| Cloud Scheduler | $0.20 / month | 5 jobs; 3 free per billing account |
| Cloud Build, Artifact Registry, Cloud Logging | < $1.00 | Container images and build minutes |
| Domain / hosting | $0.00 | Served on the default `run.app` domain |
| **Total operating cost** | **≈ $5 – $8** | For the full life of the project |

### How the Gemini figure was calculated

We did not estimate this from a price list. We ran real CALC requests and read
`usageMetadata` off the model's own responses on August 16, 2026:

| Operation | Input | Output | Thinking | Cost per call |
|---|---|---|---|---|
| Text question | 2,596 tok | 119 | 417 | **$0.0087** |
| Receipt photo | 1,099 tok | 797 | 1,439 | **$0.0218** |

At the published `gemini-3.5-flash` rate of $1.50 per million input tokens and
$9.00 per million output tokens, with thinking tokens billed as output.

Calls counted in production logs:

| Source | Calls | Cost |
|---|---|---|
| Accuracy-guard agent (12 cases × 7 runs) | 84 text | $0.73 |
| User text requests (`/calculate`) | 25 text | $0.22 |
| User receipt photos (`/receipt`) | 37 vision | $0.81 |
| Market-watch and daily-close agents | 3 text | $0.03 |
| **Subtotal, individually logged** | | **$1.79** |
| Development and evaluation runs before usage instrumentation existed | not individually logged | est. $2 – $4 |

**The authoritative figure is the Google Cloud billing report**, not this
reconstruction. This bottom-up calculation is offered as a cross-check and as
evidence that we measure our unit economics rather than guess at them.

---

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
| Operating cost | ≈ $5 – $8 |
| Marketing | $0.00 |
| **Net** | **≈ –$5 to –$8** |

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
