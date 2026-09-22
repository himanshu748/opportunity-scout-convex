# Catalog coverage review — September 22, 2026

## Why a hackathon can be missing

The public catalog intentionally requires a source-origin hackathon, an open submission window, a confirmed future deadline and a source check no older than 48 hours. Grants and gigs remain stored but are outside the board's current promise. Source discovery is incomplete; a URL in the queue is not an active event.

At the audit snapshot, 116 stored opportunity records split into 68 active hackathons, 14 other types, 27 marked closed, three stale records otherwise eligible, three unconfirmed records, and one past-deadline record still marked open. These are a dated audit, not evergreen inventory claims.

The three stale records were ML Empowerment Build Challenge 3.0, AI for Foundational Learning Hackathon and SUSTAIN-A-THON 2.0. The unconfirmed records were older directory/plugin sources for AssemblyAI, NCHC and X-Agent. Source records can refer to the same event: an unconfirmed directory record is not proof that a separately verified direct event record is missing.

The queue snapshot reported 2,087 sources pending verification, including 317 failed checks awaiting retry. That backlog is not 2,087 verified hackathons. No paid refresh, quota increase, provider-key change or manual promotion of unverified records was performed for this review.

## Changes

- Full-text search now uses the catalog search index before pagination. A match after the first page is discoverable without manually loading unrelated records.
- Active criteria are applied before pagination against a stable page snapshot. Server-time validation is repeated on returned records, so a client timestamp cannot revive stale, expired or future-checked data. Records aging out during a long session can still leave a short page; more results remain loadable.
- Browser testing caught an invalid-cursor reset caused by changing time bounds. The corrected query keeps its snapshot bounds stable across pages.
- Existing four-attempt worker batches alternate known-active refreshes with oldest-due discovery. Leases, retry handling and provider stop conditions remain unchanged. This improves scheduling fairness; it does not eliminate inaccessible sources or exhausted provider capacity.
- The dashboard separates verified inventory from queue status and explains pending source records. Remote-only filtering is explicit, and local filters/sorting state their loaded-record scope.
- Typography, spacing, search controls and detail-panel proportions were refined using Impeccable. Tablet layouts stack before the two columns become cramped; phone navigation remains reachable.

## Verification

- `npm test`: 23 files, 113 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- Regression cases cover stale-page starvation, matches beyond page one, advancing-time pagination, forged snapshot safety, coverage separation and queue fairness.
- Browser checks against the connected development backend: search for Convex returns the All Gas event; loading more goes from 50 to 68 results; remote-only reduces the fully loaded catalog to 42.
- Desktop 1440px and phone 390px rendered inspection completed. Phone document width stayed within the viewport.
- Impeccable's targeted detector completed without findings.
- Published backend and frontend to the existing `graceful-spoonbill-850` development deployment serving the public demo. Hosted JS `index-C1klCTGy.js` and CSS `index-B-J1BO1F.css` matched the local build. On the hosted recheck, the catalog had advanced to 69 verified-open records; load-more displayed all 69 and Convex search returned one matching record. This was observed, not manually seeded.
- Hosted desktop and phone checks had no horizontal overflow. The no-results recovery and keyboard Tab to Clear search were also checked. No provider call, email or account-data change was made by these UI checks.

## Remaining limits

This is not proof of exhaustive discovery or universal eligibility. The coverage query scans at most 1,000 open hackathon records and labels counts as limited beyond that bound. Queue counts are periodically refreshed and show their snapshot time. Search ranking comes from the search index; dropdown sorting and profile filters apply to loaded matches. Existing advisor, authentication and email flows were not re-exercised in this catalog-focused pass. No new event was represented as verified solely to increase the count.
