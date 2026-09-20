# Opportunity Scout

Scout helps you decide which hackathon deserves your time. It compares source evidence with your skills, location and available hours, then offers an optional email shortlist you can reply to.

**September 20 release:** reliability changes are deployed on the existing Scout app. See [verification and release evidence](docs/reliability-review.md). [The public VibeApps submission exists](https://vibeapps.dev/s/opportunity-scout); older build-log failures describe earlier attempts. A real personalized digest and refined reply reached the authorized Gmail account; normal polling and formatted HTML/plain-text delivery were verified, and STOP restored the test profile to unsubscribed.

[Open the live app](https://graceful-spoonbill-850.convex.site) · [Source](https://github.com/himanshu748/opportunity-scout-convex) · [Build log](hackathon.md) · [Watch demo](https://drive.google.com/file/d/1Qx-wNIrZ9GYO3j78sQm42wcHX6a-z9Qp/view)

A React + TypeScript app with a public landing page and a Convex-backed opportunity workspace. The workspace uses Convex Auth, Firecrawl discovery, a Mastra advisor running an OpenAI model, and an AgentMail digest component.

## Run

```sh
npm ci
npm run dev -- --port 5174
```

The landing page is `/`; the workspace is `/app`. Copy `.env.example` to `.env.local` and configure a separate Convex deployment. Set private service credentials in Convex environment variables, never in `VITE_*` variables.

```sh
npx convex dev
npm run build
npm test
```

The committed lockfile pins dependencies. `postinstall` applies the AgentMail component patch that declares its isolated environment contract. The patch contains no credentials.

## Discovery and deadlines

Discovery rotates through 28 query themes over four days: sponsor sites, community posts, university events, GitHub, developer challenges, and niche boards. A daily Convex job at 01:30 UTC (07:00 IST) searches six rotating themes plus four daily grant/community queries, follows event links from source pages, and stores deduplicated candidates in a durable queue. A sequential leased worker drains due sources without parallel queue claims, with an hourly recovery job; each claim reads only the next due candidate. Asset and navigation URLs are filtered out. Devpost open-event feeds are imported directly only after verifying the exact submission countdown on each event page. An authenticated user can request a search with a 15-minute shared cooldown. This is broad public-web discovery, not an exhaustive index of the internet. Provider quotas and source accessibility limit coverage.

The catalog hides closed, expired, unconfirmed, and stale hackathons. Source checks must be no older than 48 hours. Deadline expiration is scheduled in Convex and enforced in the client. A 650 ms inert exit animation removes expired rows; reduced-motion users get immediate removal. Saved records are preserved but expired opportunities leave the active dashboard.

All Gas and the R Consortium grant have source-specific parsers tied to their verified 2026 submission windows. It checks the source wording before refreshing the listing and never rolls the deadline into another year. Other pages use Firecrawl structured extraction with a source-quoted submission deadline, date, time and a supported timezone. Announcement dates and unsupported date formats remain unconfirmed. Users should still inspect original rules.

## Accounts and recommendations

Convex Auth protects profiles, saved opportunities, and shortlist history. Mastra memory uses Convex storage through internal-only handlers. The advisor filters recorded opportunities against known constraints, then explains fit, tradeoffs, and next steps. Missing eligibility requirements remain unknown. The hosted advisor uses OpenAI GPT-4.1 mini through Convex AI Gateway. Usage is billed to the Convex team and subject to its spending limit; transient provider failures are surfaced in the UI. Recommendations do not establish eligibility or guarantee success.

## Email setup

Scout uses an explicitly authorized shared AgentMail inbox, configured with `AGENTMAIL_INBOX_ID`. Backend outbound delivery was verified as sent on 14 September 2026. The key cannot manage webhooks, so `SCOUT_EMAIL_POLLING=true` checks only Scout-created digest threads every 15 minutes. Existing RentPilot webhooks are unchanged. `SCOUT_EMAIL_ENABLED=true` enables the service; individual users must opt in through Preferences. STOP in a recognized digest thread turns off that user’s subscription. An authorized Gmail test received a personalized digest and a refined reply on September 20; see the release evidence for polling verification and limitations.

## Verification

Production build and 47 unit tests pass. Live checks exercised Convex sign-in, profile isolation, private storage, saving an opportunity, source discovery, and the advisor. Desktop/mobile checks confirm buttons use 4 px vertical/8 px horizontal padding and workspace icons are 16 px. An isolated synthetic deadline test verified automatic removal without writing a test opportunity to the real catalog.

Discovery counts are refreshed hourly instead of scanning the source queue every five minutes. The daily job runs on Convex even when the browser is closed. Deadline expiry remains independently scheduled.

Discovery uses a shared 15-minute worker lease across manual requests, cron recovery, and scheduled continuations. A crashed worker becomes recoverable after lease expiry; token-checked release cannot unlock a newer worker.

## Public hosting

The demo is served by the Convex static-hosting component on the existing development deployment. Auth routes and the AgentMail webhook remain on the same origin. For a separate production deployment, configure its secrets, auth keys, and source data before publishing.

```sh
npm run deploy:preview  # Build and publish the configured development deployment
npm run deploy         # Publish a separately configured production deployment
```

## Known limits

Current account capacity was not audited in this review; earlier free-plan warnings are historical, not a current billing diagnosis. The AI gateway can return rate limits. Public-web search is incomplete; X/Twitter ingestion is disabled. Listed prizes are distinct from source-confirmed USD cash pools. Remote participation does not establish geographic eligibility. Rolling grants without an exact closing date are currently excluded. A personalized digest and refined reply were received in the authorized Gmail test. The shared sender still displays RentPilot; its inbox settings and webhooks are unchanged.

## Convex AI Gateway cutover

The advisor, daily briefing, weekly digest, and digest-reply refinement share the same Mastra model route. `SCOUT_AI_PROVIDER=convex` selects Convex AI Gateway with a short-lived deployment token from `getServiceToken("ai-gateway")`. Tokens stay inside the action. `OPENAI_MODEL` remains `openai/gpt-4.1-mini`. Firecrawl discovery and AgentMail delivery remain their own services.

The successful September 17 Convex AI Gateway route is preserved. Do not change billing or provider selection as part of this reliability update. The route was rechecked successfully on September 20. An operator can recheck it with:

```sh
npx convex run advisor:smoke '{"provider":"convex"}'
```

For an explicitly approved future provider migration only (not needed for this update):

```sh
npx convex env set SCOUT_AI_PROVIDER convex
```

An unset provider preserves the existing Vercel/direct-OpenAI selection. An explicitly selected provider never silently falls back to another billing account. Roll back explicitly with `SCOUT_AI_PROVIDER=vercel` while the existing Vercel credential is available. The hosted route was activated on September 17 after paid-team access and both explicit-route and default-route connection checks succeeded.

### Discovery coverage

Daily discovery now combines Devpost's open feed, public HTML links from 14 event directories, and 16 rotating search queries (plus a topic query when requested). The platform-specific searches cover 12 platforms over two days. Directory fetches run independently of Firecrawl search quotas. All links are leads until an organizer or established event platform confirms an open submission window; an event's end date alone is insufficient. The lablab.ai adapter reads the explicit submission timeline and open offer metadata. Ambiguous sources stay in the verification queue, outside the active catalog. X/Twitter links are rejected.

The board's “Missing an opportunity?” form accepts authenticated community suggestions, deduplicates canonical URLs, and limits each account to five new links per day. It never publishes a submitted link directly. Exact numeric timezone offsets and explicit India, Japan, and Singapore timezone labels are supported by deadline verification. This expands coverage; it is not a claim to index every hackathon on the internet.

## Conservative event identity

Source records retain their original IDs. Automatic grouping requires an explicit year/edition, a non-generic organizer backed by source text, and a specific event URL on a supported platform. Names or years alone never establish identity. Ambiguous/multi-event links abstain. A reused URL with a different explicit year creates a different record. Sources without enough identity evidence stay separate; their displayed title is not a verified cross-source identity.

Each ingestion stores field evidence in append-only source observations. Linked sources keep separate values; deadline, reward, cash and geography disagreements are shown and block recommendation. Identity changes record reversible canonical pointers. Saves and shortlist references are never rewritten or deleted. Rolling back a grouping puts that source on an identity-review hold, preventing automatic re-merging.

## Decision and email bounds

Scout now specializes in hackathons. Existing grant/gig data is retained, but is outside the recommendation and main-board promise. The board's Best match sort applies to loaded records and says so. The advisor separately reads at most 250 active hackathon records with an index, ranks up to 25 eligible matches, and can recommend at most three. It validates source freshness, deadlines, recorded editions, geography, cash/currency evidence and conflicts again before persistence, queueing and every provider send attempt. This is validation against captured records no older than 48 hours, **not a fresh external scrape at every send**. Check original rules before committing.

Digest work is keyed by user and scheduled period independently of `nextDigestAt`. A ten-minute lease recovers crashed generation; failures retry at most three attempts within the period through a five-minute recovery cron. Reply events preserve processing state, input and authorization context, so deduplication no longer loses failed refinement work. Pending provider work uses one outbound ID and HTTP idempotency key; ambiguous terminal failures require receipt review instead of a new send. Mastra keeps the existing gateway and memory integrations with three model steps, zero SDK retries, a 120-second run budget and 1,800 output tokens per step.

Unsubscribe increments a consent version, cancels pending component messages, and invalidates work composed before the change. STOP parsing does not need AI and remains available while sending is disabled. The AgentMail patch checks consent and decision evidence immediately before each provider attempt and strips its private callback header. A send already accepted by the provider cannot be recalled. See the patch notes and limitations in the review document.
