# Opportunity Scout — All Gas build log

## What it does

Scout helps students and independent builders choose active hackathons, developer grants, and small paid gigs. It finds opportunities beyond a single board, keeps source evidence and confirmed deadlines, and builds a personal shortlist with reasons, tradeoffs, and a next step.

## Stack with a job to do

- Convex: authenticated profiles, private saves, indexed opportunity catalog, live updates, daily discovery scheduling, deadline expiry, delivery tracking, and concurrency control.
- Firecrawl component: web searches, source-page extraction, and discovery links. Direct platform feeds supplement discovery; only verified current listings enter the active board.
- OpenAI through Mastra: tool-grounded recommendations from the current catalog, checked against saved preferences. The model cannot recommend IDs outside its supplied candidates.
- AgentMail component: opted-in weekly digests and recognized replies in Scout-created threads. The authorized shared RentPilot inbox is used; its existing webhooks are untouched.

## September 14–15

Built the catalog, Convex Auth, profiles, per-user saves, evidence-linked advisor, and digest workflow. Added exact countdowns and automatic removal of expired opportunities. Corrected source validation and expanded discovery. Verified one authorized outbound email; a real recipient reply round trip remains unverified.

Investigated high database reads. The dashboard showed Scout using approximately 1.64 GB of the team's 1.70 GB database I/O, 99.7% reads. Replaced broad reads with indexed pagination, separated saved-record loading, cached shared counts, reduced cron frequency, and added a shared worker lease. Daily discovery runs at 01:30 UTC. A live test confirmed duplicate workers and incorrect unlock tokens are rejected. Usage reduction has not yet been measured over a full day.

## September 16

Refined the public landing page with independent display and control sizes, existing image assets, restrained entrance motion, and a real three-opportunity preview. The preview makes a single bounded request, not a realtime subscription. It removes expired or stale records locally while open.

Added direct links to a selected opportunity, Preferences, and digest setup. Added calendar export for active, confirmed deadlines with UTC timestamps, source links, and an advance reminder where there is enough time. Calendar text is escaped and folded safely; unknown or expired deadlines are rejected.

Validation: production build and 33 tests pass. Desktop/mobile checks found no horizontal overflow; images loaded, keyboard tabs worked, Preferences deep link opened correctly, and the calendar action reported a download. Workspace controls remain 4px vertical / 8px horizontal padding with 16px icons. Public primary links use 16px / 24px padding.

## Submission status — not yet complete

- Public app URL: https://graceful-spoonbill-850.convex.site (hosted development deployment).
- Public repository: https://github.com/himanshu748/opportunity-scout-convex
- Demo video: guided walkthrough in preparation from real hosted app captures.
- Social post: not yet published.
- Real email reply round trip: still requires verification.
- Convex account quota: previously exceeded; the new implementation cannot erase already consumed usage.

Official requirements: https://www.convex.dev/hackathons/all-gas

## September 17

Added grants as a first-class catalog category with confirmed application deadlines, evidence-backed geographic restrictions, and explicit remote-eligibility uncertainty. Daily discovery now runs ten queries (six rotating themes plus four grant/community searches), with up to eight Devpost feed pages. A live refresh queued 28 new source URLs with zero search failures; these are leads, not verified listings.

The dashboard now opens a prefilled daily briefing request. The Mastra/OpenAI advisor receives confirmed cash evidence, geographic constraints, and source timestamps for comparisons and practical next steps. Briefings run on request, not on every page load.

X/Twitter/t.co URLs are blocked before scraping, including existing queued URLs. X-only ingestion requires an authorized integration and applicable content-use rights; no claim of X coverage is made. Added regression tests for these boundaries and grant exclusions. 42 tests and the production build pass; Convex functions deployed. Provider/source failures still constrain catalog breadth.

Live browser verification: new category filters and briefing entry point render correctly; the catalog displayed 45 loaded active opportunities with additional pagination available. The full advisor request reached the OpenAI gateway but returned HTTP 429 free-tier rate limiting; its successful end-to-end output is not verified. Existing shortlist remains intact. Added exponential retry backoff capped at 24 hours for repeatedly failing sources. Public release and submission remain incomplete.

September 17, 12:25 IST: Retried the full daily briefing through the signed-in browser. The Mastra/OpenAI action succeeded, stored a new shortlist, and displayed three source-linked opportunities with deadlines, eligibility caveats, tradeoffs, next steps, and suggested plans. This resolves the earlier end-to-end verification gap; the gateway's free-tier rate limit can still recur.

September 17, release preparation: Fixed a Firecrawl integration error caused by Zod's `$schema` metadata being rejected as a Convex argument. Added a regression test that serializes the actual extraction schema through Convex. An official R Consortium grant now passes extraction, source validation, and catalog persistence, with its October 1, 2026, 23:59 US Eastern deadline. Requeued 326 failed source checks with bounded sequential processing. Published the frontend using Convex's static-hosting component and verified the public landing page and live catalog. 43 tests pass. This is a public development deployment; the account still reports a free-plan quota warning.

Hosted account checks passed: sign-up, save, unsave, and profile editing. GitHub Actions passed the clean install, 43 tests, and build on the published repository.

Hosted AI testing found a cross-event description mismatch. Added exact title and source-quote validation, rejection of obvious references to other candidate names, current-time context, and a deadline recheck before persistence. The regression test reproduces the mismatch. The hosted retry returned two accepted recommendations. These checks reduce obvious grounding errors; they do not prove all generated advice correct. 44 tests now pass.

Final source review found an extracted winner-announcement date incorrectly used as a submission deadline. Unconfirmed that listing, required source-backed deadline evidence with deterministic date/time/timezone checks, and added a daylight-saving regression test. The R Consortium grant uses its independently checked October 1 Eastern-time window. Old shortlists containing invalidated sources are hidden. 46 tests and the build pass.

Release follow-up: A fresh official R Consortium page check now succeeds through the source adapter without an LLM-derived timezone. Outbound AgentMail status was rechecked as sent. Live AI retries encountered the gateway free-tier 429 again, so reliable live judging still needs model capacity. The demo walkthrough labels its earlier successful 12:25 IST AI result. No submission or social announcement has been sent.

The user confirmed Vercel AI Gateway. Switched the configured OpenAI route from `openai/gpt-4o-mini` to `openai/gpt-4.1-mini`; the connection check and a complete hosted briefing succeeded. Cash and reward claims in generated prose are suppressed in favor of deterministic fields from verified opportunity records. Added a regression test for the observed incorrect financial claim. 47 tests and the build pass. No billing settings changed.
