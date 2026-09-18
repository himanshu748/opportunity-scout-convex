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
- Demo video: [78-second narrated walkthrough](https://drive.google.com/file/d/1Qx-wNIrZ9GYO3j78sQm42wcHX6a-z9Qp/view) with Deepgram Aura 2 narration, captions, current discovery and cash views, and a fresh briefing generated through Convex AI Gateway. Edited from real browser captures and exported at 1080p/60fps. Google Drive link viewing is enabled.
- Social videos: [X](https://x.com/jhahimanshu653/status/2100529730101612800) and [LinkedIn](https://www.linkedin.com/feed/update/urn:li:ugcPost:7506295370432352256/). Both include the native 78-second demo, captions, paragraph breaks, sponsor tags, and an explanation of Mastra's role.
- Real email reply round trip: still requires verification.
- Convex account: Starter and AI Gateway enabled on September 17. The team monthly disable threshold is $5; earlier usage remains billed against the team's limits.
- Astra/Product Hunt: [launch](https://www.producthunt.com/products/opportunity-scout?launch=opportunity-scout) successfully scheduled for September 18, 2026 at 12:01 AM Pacific (12:31 PM IST), with the GPT-6 Astra challenge selected. See the [launch package](launch/product-hunt.md).
- All Gas submission: VibeApps returned a server error on three completed submission attempts. No All Gas submission receipt exists yet.

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

September 17, 13:18 IST: The final hosted GPT-4.1 mini request succeeded and persisted three source-linked recommendations. Confirmed cash came from source records, including the RevenueCat pool, with unconfirmed totals labelled clearly. The 64-second captioned walkthrough uses this fresh hosted result.

September 17, gateway preparation: Added an explicit Convex AI Gateway route shared by the Mastra advisor, daily briefings, weekly digest generation, and reply refinement. It uses Convex's deployment-scoped service token and an OpenAI-compatible endpoint without adding dependencies. All 50 tests, TypeScript, build, formatting checks, and the Convex push passed. The hosted Convex probe returned AiGatewayDisabled because this team is on Free. The existing Vercel route returned Connected, so it remains active until the team enables paid gateway access. No claim of a completed Convex gateway cutover is made.

The Drive demo was replaced in place with a 72.8-second 1080p/60fps edit using fresh higher-resolution hosted captures, Deepgram Aura 2 narration, and captions. Public link permissions were retained. Drive playback and the selected 1080p quality were verified; its earlier player setting was 360p. The saved AI briefing shown in this demo was generated through Vercel before any gateway cutover.

September 17, launch update: Activated Convex AI Gateway for the shared Mastra/OpenAI route. Both the provider smoke check and a fresh hosted briefing succeeded. The user's AI/web-development preferences persisted, and saving the Convex All Gas opportunity was verified in the signed-in account. Weekly email remains opt-in.

The one authorized launch email arrived in the recipient's Gmail inbox from the existing RentPilot inbox. This verifies outbound delivery, not a recipient reply round trip or a personalized weekly digest. Added a fixed launch-test idempotency key so checking the same run does not send duplicates.

Replaced the Drive video in place with a 78.43-second narrated, captioned edit showing the current gateway briefing, community source submission, cash evidence, saves, and preferences. Verified the local media streams and full decode; the upload returned the same Drive ID with the new 7,447,994-byte file. Prepared Product Hunt copy and actual-product gallery images for the September 18 Build with Astra challenge. Local build metadata confirms 41 recorded Scout turns used GPT-6 Astra; the deployed recommendation model remains GPT-4.1 mini.

September 17, launch scheduling: Product Hunt displayed “Successfully Scheduled!” and its prelaunch dashboard reports Scheduled for the September 18 launch. The challenge response describes Astra's build contribution and explicitly identifies GPT-4.1 mini as the runtime model. Native video posts were published on X and LinkedIn with all five company tags, including Mastra. X playback completed; LinkedIn playback and captions were verified. The first X receipt did not persist and is not used as evidence. The final X revision uses the current @mastra handle.

The All Gas form returned `[CONVEX M(stories:submit)] Server Error` on two attempts (request IDs `bc15d25162069ac9` and `d41f74a29e633bd2`). This remains an incomplete submission, despite the app, public repository, demo, and social posts being available.

September 17, demo upload: Published the approved demo as an [unlisted YouTube video](https://www.youtube.com/watch?v=vnmZcJOoM6o), with English timed captions. Verified 1080p playback. Product Hunt accepted the video into its gallery, and its prelaunch dashboard marks Video / Loom complete. Saved all six tool shoutouts and checked the official Astra launch guide. Retried the All Gas form with the new YouTube URL, screenshot, repository and social links; Vibe Apps again returned Server Error (request ID `404252f3c4cb5dd5`). No receipt was issued.

September 17, prize and personalization audit: Audited all 47 active hackathons. Expanded deterministic Devpost prize parsing to reconcile each award amount times its winner count, inspect detailed non-cash benefits, and retain native currencies. OpenCV's $20,250 headline includes $8,250 in compute grants; Scout displays $12,000 cash. The catalog now has 19 hackathons with published cash amounts, 21 with non-cash awards, six with conflicting reward details, and one without a verifiable amount. Unspecified dollar currencies remain explicit rather than being assumed USD. AssemblyAI's $5,000 cash/$5,000 credits split is now extracted from its organizer metadata. This verifies published claims, not payout guarantees.

Saved profiles now default the board to Best match for me, with skill-match reasons and known conflicts beside each card. Matching is bounded to loaded records to preserve database efficiency; the UI discloses that scope. The existing Mastra advisor and optional digest already used account-scoped preferences. Added standard AI/Web topic aliases. Live signed-in verification ranked Convex first for the user's React/TypeScript profile, and confirmed cash sorting and the OpenCV breakdown. 66 tests, TypeScript, build, formatting and Convex deployment passed. A live daily-source adapter smoke test imported eight events with zero failures. Backend and frontend are deployed.

### September 18: discovery coverage and dashboard hierarchy

- Added a direct Devfolio importer using published registration-window timestamps from organizer pages. The first live run imported 20 open events with zero failures; it runs with daily discovery.
- Added date-only deadline evidence and a Hack2Skill page adapter. Calendar dates appear with “time unspecified”; they never become an exact countdown, AI timestamp or calendar appointment. To avoid overdue listings when timezone is unknown, these records leave the board before the earliest possible start of the closing date.
- Live catalog after checks: 69 hackathons, one grant and one gig. Includes AI for Foundational Learning on Hack2Skill (September 27 date-only deadline, INR 1,000,000 cash awards). No stale records in the queried catalog.
- Refined dashboard hierarchy: pale blue navigation, warm neutral workspace, reduced header spacing, inline search, fewer introductory elements and an AI briefing navigation tab.
- DoraHacks direct request returned HTTP 405; no new direct integration is claimed. Browser visual verification was blocked by the test-browser environment, so responsive visual QA remains unverified.
