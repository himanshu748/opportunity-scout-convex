# Opportunity Scout

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

Convex Auth protects profiles, saved opportunities, and shortlist history. Mastra memory uses Convex storage through internal-only handlers. The advisor filters recorded opportunities against known constraints, then explains fit, tradeoffs, and next steps. Missing eligibility requirements remain unknown. The hosted advisor uses OpenAI GPT-4.1 mini through Vercel AI Gateway. Its free tier can rate-limit requests; the UI reports this and asks the user to retry. Recommendations do not establish eligibility or guarantee success.

## Email setup

Scout uses an explicitly authorized shared AgentMail inbox, configured with `AGENTMAIL_INBOX_ID`. Backend outbound delivery was verified as sent on 14 September 2026. The key cannot manage webhooks, so `SCOUT_EMAIL_POLLING=true` checks only Scout-created digest threads every 15 minutes. Existing RentPilot webhooks are unchanged. `SCOUT_EMAIL_ENABLED=true` enables the service; individual users must opt in through Preferences. STOP in a recognized digest thread turns off that user’s subscription. A real recipient reply round trip has not yet been observed.

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

The account is above its free-plan quota and may experience service interruption until capacity is resolved. The AI gateway can return rate limits. Public-web search is incomplete; X/Twitter ingestion is disabled. Listed prizes are distinct from source-confirmed USD cash pools. Remote participation does not establish geographic eligibility. Rolling grants without an exact closing date are currently excluded. Email sending has been verified, but a real recipient reply round trip remains unverified.

## Convex AI Gateway cutover

The advisor, daily briefing, weekly digest, and digest-reply refinement share the same Mastra model route. `SCOUT_AI_PROVIDER=convex` selects Convex AI Gateway with a short-lived deployment token from `getServiceToken("ai-gateway")`. Tokens stay inside the action. `OPENAI_MODEL` remains `openai/gpt-4.1-mini`. Firecrawl discovery and AgentMail delivery remain their own services.

Convex AI Gateway requires a paid Convex team. Before changing the live route, redeem any billing promo on the correct team, confirm its credit terms, set a suitable spending limit, and verify access:

```sh
npx convex run advisor:smoke '{"provider":"convex"}'
```

Only after that succeeds, activate the route and test a full briefing:

```sh
npx convex env set SCOUT_AI_PROVIDER convex
```

An unset provider preserves the existing Vercel/direct-OpenAI selection. An explicitly selected provider never silently falls back to another billing account. Roll back explicitly with `SCOUT_AI_PROVIDER=vercel` while the existing Vercel credential is available. Hosted cutover is pending paid-team access; the demo accurately shows the prior Vercel-generated briefing.
